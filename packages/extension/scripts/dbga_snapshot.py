import json
import os
import tempfile
import time
import traceback

SCHEMA_VERSION = 2

REPLACE_ATTEMPTS = 5
REPLACE_BACKOFF_SECONDS = 0.01

MASK64 = 0xFFFFFFFFFFFFFFFF

JSON_SAFE_INT = 2**53


def to_address(value):
    return hex(int(value) & MASK64)


def int_value(value, signed):
    value = int(value)
    result = {"t": "int", "v": value, "signed": bool(signed)}
    if value > JSON_SAFE_INT or value < -JSON_SAFE_INT:
        result["hex"] = to_address(value)
    return result


def real_value(value, special=None):
    result = {"t": "real", "v": value}
    if special is not None:
        result["special"] = special
    return result


def bool_value(value):
    return {"t": "bool", "v": bool(value)}


def char_value(value, text):
    return {"t": "char", "v": int(value), "text": text}


def enum_value(value, name):
    return {"t": "enum", "v": int(value), "name": name}


def text_value(value, truncated):
    return {"t": "text", "v": value, "truncated": bool(truncated)}


def opaque_value(reason, address=None, detail=None):
    result = {"t": "opaque", "reason": reason}
    if address is not None:
        result["address"] = to_address(address)
    if detail is not None:
        result["detail"] = detail
    return result


def field(name, type_name, value):
    return {"name": name, "type": type_name, "value": value}


def inline_array(name, element_type, length, cells, truncated, expanded):
    return {
        "name": name,
        "elementType": element_type,
        "length": int(length),
        "cells": cells,
        "truncated": bool(truncated),
        "expanded": bool(expanded),
    }


class SnapshotBuilder(object):
    def __init__(self, debugger_name, debugger_version, config):
        self._debugger = debugger_name
        self._debugger_version = debugger_version
        self._config = config
        self._roots = []
        self._nodes = []
        self._nodes_by_id = {}
        self._type_shape = {}
        self._edges = []
        self._visited = set()
        self._errors = []
        self._truncation_reasons = []
        self._frames = []
        self._frames_scanned = 0
        self._frames_skipped = 0

    def already_visited(self, address):
        return to_address(address) in self._visited

    def mark_visited(self, address):
        self._visited.add(to_address(address))

    def has_node(self, address):
        return to_address(address) in self._nodes_by_id

    def node_count(self):
        return len(self._nodes)

    def edge_count(self):
        return len(self._edges)

    def frame_scanned(self):
        self._frames_scanned += 1

    def frame_skipped(self):
        self._frames_skipped += 1

    def frame(self, level, function, file, line):
        self._frames.append(
            {
                "level": int(level),
                "function": function if function is not None else "",
                "file": file if file is not None else "",
                "line": int(line or 0),
            }
        )

    def truncate(self, reason):
        if reason not in self._truncation_reasons:
            self._truncation_reasons.append(reason)

    def error(self, scope, reference, message):
        entry = {"scope": scope, "message": str(message)}
        if reference is not None:
            entry["reference"] = str(reference)
        self._errors.append(entry)

    def root(
        self,
        name,
        function,
        frame_level,
        origin,
        type_name,
        category,
        address,
        target,
        indirections,
        node,
        status,
        value=None,
    ):
        entry = {
            "name": name,
            "function": function,
            "frameLevel": int(frame_level),
            "origin": origin,
            "type": type_name,
            "category": category,
            "address": None if address is None else to_address(address),
            "target": None if target is None else to_address(target),
            "indirections": int(indirections),
            "node": None if node is None else to_address(node),
            "status": status,
        }
        if value is not None:
            entry["value"] = value
        self._roots.append(entry)
        return entry

    def _register(self, node):
        node_id = node["id"]
        existing = self._nodes_by_id.get(node_id)
        if existing is not None:
            self.error("node", node_id, "addressCollision")
            return existing
        self._nodes_by_id[node_id] = node
        self._nodes.append(node)
        return node

    def record_node(
        self,
        address,
        type_name,
        aggregate,
        size_bytes,
        fields,
        arrays,
        pointer_fields,
        scalar_fields,
        uncertain=False,
    ):
        if type_name is not None and type_name not in self._type_shape:
            self._type_shape[type_name] = (list(pointer_fields), list(scalar_fields))

        node = {
            "kind": "record",
            "id": to_address(address),
            "type": type_name,
            "aggregate": aggregate,
            "sizeBytes": int(size_bytes or 0),
            "fields": fields,
            "arrays": arrays,
        }
        if uncertain:
            node["uncertain"] = True
        return self._register(node)

    def array_node(
        self, address, type_name, element_type, length, cells, cells_are_pointers, truncated, origin
    ):
        node = {
            "kind": "array",
            "id": to_address(address),
            "type": type_name,
            "elementType": element_type,
            "length": int(length),
            "cells": cells,
            "cellsArePointers": bool(cells_are_pointers),
            "truncated": bool(truncated),
            "origin": origin,
        }
        return self._register(node)

    def opaque_node(self, address, reason, type_name=None, detail=None, value=None):
        node = {"kind": "opaque", "id": to_address(address), "reason": reason}
        if type_name is not None:
            node["type"] = type_name
        if detail is not None:
            node["detail"] = detail
        if value is not None:
            node["value"] = value
        return self._register(node)

    def edge(self, source, name, target, type_name=None):
        entry = {
            "from": to_address(source),
            "field": name,
            "to": None if target is None else to_address(target),
        }
        if type_name is not None:
            entry["type"] = type_name
        self._edges.append(entry)
        return entry

    def _observed_types(self):
        degrees = {}
        for entry in self._edges:
            if entry["to"] is None:
                continue
            degrees[entry["from"]] = degrees.get(entry["from"], 0) + 1

        counts = {}
        maximums = {}
        for node in self._nodes:
            if node["kind"] != "record":
                continue
            type_name = node["type"]
            counts[type_name] = counts.get(type_name, 0) + 1
            degree = degrees.get(node["id"], 0)
            if degree > maximums.get(type_name, 0):
                maximums[type_name] = degree

        collected = []
        for type_name in sorted(counts):
            pointer_fields, scalar_fields = self._type_shape.get(type_name, ([], []))
            collected.append(
                {
                    "type": type_name,
                    "pointerFields": list(pointer_fields),
                    "scalarFields": list(scalar_fields),
                    "count": counts[type_name],
                    "maxDegree": maximums.get(type_name, 0),
                }
            )
        return collected

    def _close_dangling(self):
        reason = "nodeLimit" if self._truncation_reasons else "notExpanded"
        pending = []
        for entry in self._edges:
            if entry["to"] is not None and entry["to"] not in self._nodes_by_id:
                pending.append(entry["to"])
        for entry in self._roots:
            if entry["node"] is not None and entry["node"] not in self._nodes_by_id:
                pending.append(entry["node"])
        for node_id in pending:
            if node_id not in self._nodes_by_id:
                self.opaque_node(int(node_id, 16), reason)

    def build(self):
        self._close_dangling()
        observed_types = self._observed_types()
        return {
            "meta": {
                "version": SCHEMA_VERSION,
                "debugger": self._debugger,
                "debuggerVersion": self._debugger_version,
                "generatedAt": int(time.time() * 1000),
                "truncated": len(self._truncation_reasons) > 0,
                "truncationReasons": list(self._truncation_reasons),
                "framesScanned": self._frames_scanned,
                "framesSkipped": self._frames_skipped,
                "observedTypes": observed_types,
                "errors": self._errors,
            },
            "roots": self._roots,
            "nodes": self._nodes,
            "edges": self._edges,
            "frames": self._frames,
        }


def minimal_snapshot(debugger_name, debugger_version, exception):
    return {
        "meta": {
            "version": SCHEMA_VERSION,
            "debugger": debugger_name,
            "debuggerVersion": debugger_version,
            "generatedAt": int(time.time() * 1000),
            "truncated": False,
            "truncationReasons": [],
            "framesScanned": 0,
            "framesSkipped": 0,
            "observedTypes": [],
            "errors": [
                {
                    "scope": "general",
                    "reference": type(exception).__name__,
                    "message": "".join(traceback.format_exception_only(type(exception), exception)).strip(),
                }
            ],
        },
        "roots": [],
        "nodes": [],
        "edges": [],
        "frames": [],
    }


def _replace_with_retry(tmp_path, path):
    for attempt in range(REPLACE_ATTEMPTS):
        try:
            os.replace(tmp_path, path)
            return
        except OSError:
            if attempt == REPLACE_ATTEMPTS - 1:
                raise
            time.sleep(REPLACE_BACKOFF_SECONDS * (2**attempt))


def write_atomic(path, snapshot):
    directory = os.path.dirname(path)
    fd, tmp_path = tempfile.mkstemp(dir=directory, prefix=".dbg-algo-snapshot-", suffix=".tmp")

    try:
        with os.fdopen(fd, "w") as handle:
            json.dump(snapshot, handle, allow_nan=False)
        _replace_with_retry(tmp_path, path)
    except Exception:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        raise
