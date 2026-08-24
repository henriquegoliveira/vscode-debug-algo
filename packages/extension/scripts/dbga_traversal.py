import collections
import time

import dbga_adapter
import dbga_snapshot

ZERO_PAGE = 0x1000
PAGE_SIZE = 0x1000
MAX_OBJECT_SIZE = 1 << 20
MAX_ANNOTATED_LENGTH = 1 << 20

GATE_NODE_REASON = {
    "zeroPage": ("zeroPage", None),
    "misaligned": ("misaligned", None),
    "unreadable": ("unreadable", None),
    "invalidSize": ("error", "invalidSize"),
}


class Frontier(object):
    def __init__(self):
        self._order = collections.deque()
        self._entries = {}

    def push(self, address, type_info, depth, reason=None):
        candidate = (type_info, depth, reason)
        existing = self._entries.get(address)

        if existing is None:
            self._entries[address] = candidate
            self._order.append(address)
            return

        if _should_replace(existing, candidate):
            self._entries[address] = candidate

    def pop(self):
        address = self._order.popleft()
        type_info, depth, reason = self._entries[address]
        return address, type_info, depth, reason

    def __len__(self):
        return len(self._order)


EXPANDABLE_RANK = 30
INDIVISIBLE_RANK = 20

TERMINAL_RANK = {
    "zeroPage": 10,
    "misaligned": 10,
    "unreadable": 10,
    "void": 5,
    "functionPointer": 5,
    "notExpanded": 2,
    "error": 1,
}


def _observation_rank(entry):
    type_info, _depth, reason = entry

    if reason is not None:
        return TERMINAL_RANK.get(reason[0], 0)
    if type_info is not None and type_info.is_aggregate():
        return EXPANDABLE_RANK
    return INDIVISIBLE_RANK


def _should_replace(existing, candidate):
    existing_rank = _observation_rank(existing)
    candidate_rank = _observation_rank(candidate)

    if candidate_rank != existing_rank:
        return candidate_rank > existing_rank

    return candidate[1] < existing[1]


class Config(object):
    def __init__(self):
        self.max_nodes = 2000
        self.max_edges = 6000
        self.max_depth = 64
        self.max_frames = 32
        self.max_vars_per_frame = 128
        self.max_cells = 64
        self.max_fields = 64
        self.max_text = 200
        self.time_budget_seconds = 2.0
        self.root_filter = None
        self.dynamic_arrays = []

    @classmethod
    def from_dict(cls, data):
        config = cls()
        if not isinstance(data, dict):
            return config

        limits = data.get("limits")
        if isinstance(limits, dict):
            config.max_nodes = _bounded_int(limits.get("maxNodes"), config.max_nodes)
            config.max_edges = _bounded_int(limits.get("maxEdges"), config.max_edges)

        root_filter = data.get("rootFilter")
        if isinstance(root_filter, list) and len(root_filter) > 0:
            config.root_filter = set(str(name) for name in root_filter)

        dynamic_arrays = data.get("dynamicArrays")
        if isinstance(dynamic_arrays, list):
            config.dynamic_arrays = [str(entry) for entry in dynamic_arrays]

        return config


def _bounded_int(candidate, fallback):
    if isinstance(candidate, bool) or not isinstance(candidate, int):
        return fallback
    if candidate <= 0:
        return fallback
    return candidate


def extract(adapter, config):
    builder = dbga_snapshot.SnapshotBuilder(
        adapter.debugger_name, adapter.debugger_version(), config
    )
    frontier = Frontier()
    deadline = time.monotonic() + config.time_budget_seconds
    frames = adapter.frames()
    annotations = _resolve_annotations(builder, frontier, adapter, frames, config)

    for frame in frames:
        if frame.level >= config.max_frames:
            builder.truncate("frameLimit")
            break
        if not frame.user_code:
            builder.frame_skipped()
            continue

        builder.frame_scanned()

        try:
            variables = adapter.variables(frame)
        except Exception as error:
            builder.error("frame", frame.function, error)
            continue

        if len(variables) > config.max_vars_per_frame:
            variables = variables[: config.max_vars_per_frame]

        for var in variables:
            if config.root_filter is not None and var.name not in config.root_filter:
                continue
            try:
                classify_root(builder, frontier, adapter, frame, var, config)
            except Exception as error:
                builder.error("root", var.name, error)

    while len(frontier) > 0:
        if time.monotonic() > deadline:
            builder.truncate("timeBudget")
            break

        address, type_info, depth, reason = frontier.pop()

        if builder.already_visited(address):
            continue
        if depth > config.max_depth:
            builder.truncate("depthLimit")
            builder.mark_visited(address)
            builder.opaque_node(address, "depthLimit", type_info.name)
            continue
        if builder.node_count() >= config.max_nodes:
            builder.truncate("nodeLimit")
            break

        builder.mark_visited(address)

        try:
            visit(
                builder, frontier, adapter, address, type_info, depth, config, reason, annotations
            )
        except Exception as error:
            if builder.has_node(address):
                builder.error("node", dbga_snapshot.to_address(address), error)
            else:
                builder.opaque_node(address, "error", type_info.name, str(error))

    return builder.build()


REFINABLE_CATEGORIES = (
    dbga_adapter.POINTER,
    dbga_adapter.REFERENCE,
    dbga_adapter.RECORD,
    dbga_adapter.UNION,
)


def _refined_type(adapter, ref, type_info):
    if type_info is None or type_info.category not in REFINABLE_CATEGORIES:
        return type_info
    try:
        dynamic = adapter.dynamic_type_of(ref)
    except Exception:
        return type_info
    return type_info if dynamic is None else dynamic


def classify_root(builder, frontier, adapter, frame, var, config):
    type_info = adapter.type_of(var.ref)
    if var.valid:
        type_info = _refined_type(adapter, var.ref, type_info)
    category = _root_category(type_info)

    if not var.valid:
        builder.root(
            var.name,
            frame.function,
            frame.level,
            var.origin,
            type_info.name,
            category,
            None,
            None,
            0,
            None,
            "optimizedOut",
            dbga_snapshot.opaque_value("optimizedOut"),
        )
        return

    if category == "reference":
        _reference_root(builder, frontier, adapter, frame, var, type_info, config)
    elif category == "pointer":
        _pointer_root(builder, frontier, adapter, frame, var, type_info, config)
    elif category == "aggregate":
        _aggregate_root(builder, frontier, adapter, frame, var, type_info, config)
    else:
        _scalar_root(builder, adapter, frame, var, type_info)


def _root_category(type_info):
    if type_info.category == dbga_adapter.POINTER:
        return "pointer"
    if type_info.category == dbga_adapter.REFERENCE:
        return "reference"
    if type_info.is_aggregate():
        return "aggregate"
    return "scalar"


def _indirection_depth(type_info):
    depth = 0
    current = type_info
    while current is not None and current.category == dbga_adapter.POINTER:
        depth += 1
        current = current.target
    return depth, current


def _pointer_root(builder, frontier, adapter, frame, var, type_info, config):
    slot = adapter.address_of(var.ref)
    indirections, _final = _indirection_depth(type_info)
    value = adapter.pointer_value(var.ref)

    def emit(target, node, status, payload=None):
        builder.root(
            var.name,
            frame.function,
            frame.level,
            var.origin,
            type_info.name,
            "pointer",
            slot,
            target,
            indirections,
            node,
            status,
            payload,
        )

    if indirections >= 3:
        emit(value, None, "deepIndirection")
        return

    if value == 0:
        emit(value, None, "null")
        return

    if indirections == 1 and _is_narrow_char(type_info.target):
        emit(value, None, "notFollowed", _text_from_pointer(adapter, value, config.max_text))
        return

    if indirections == 2:
        inner_type = type_info.target
        reason = _gate(adapter, value, inner_type)
        if reason is not None:
            _push_gate_failure(frontier, value, reason, inner_type, 1)
            emit(value, value, "unreadable")
            return
        inner = adapter.object_at(value, inner_type)
        node, status = _follow(builder, frontier, adapter, adapter.pointer_value(inner), inner_type.target, 1, config)
        emit(value, node, status)
        return

    node, status = _follow(builder, frontier, adapter, value, type_info.target, 1, config)
    emit(value, node, status)


def _reference_root(builder, frontier, adapter, frame, var, type_info, config):
    referent = adapter.referenced(var.ref)
    if referent is None:
        builder.root(
            var.name, frame.function, frame.level, var.origin, type_info.name,
            "reference", None, None, 0, None, "unreadable",
        )
        return

    referent_type = _refined_type(adapter, referent, adapter.type_of(referent))
    address = adapter.address_of(referent)
    node, status = _adopt(builder, frontier, adapter, address, referent_type, 1, config)
    builder.root(
        var.name, frame.function, frame.level, var.origin, type_info.name,
        "reference", None, None, 0, node, status,
    )


def _aggregate_root(builder, frontier, adapter, frame, var, type_info, config):
    address = adapter.address_of(var.ref)
    if address is None:
        builder.root(
            var.name, frame.function, frame.level, var.origin, type_info.name,
            "aggregate", None, None, 0, None, "optimizedOut",
            dbga_snapshot.opaque_value("optimizedOut"),
        )
        return

    payload = None
    if _is_narrow_char_array(type_info):
        payload = _text_from_array(adapter, address, type_info, config.max_text)

    node, status = _adopt(builder, frontier, adapter, address, type_info, 0, config)
    builder.root(
        var.name, frame.function, frame.level, var.origin, type_info.name,
        "aggregate", address, None, 0, node, status, payload,
    )


def _scalar_root(builder, adapter, frame, var, type_info):
    builder.root(
        var.name,
        frame.function,
        frame.level,
        var.origin,
        type_info.name,
        "scalar",
        adapter.address_of(var.ref),
        None,
        0,
        None,
        "ok",
        _scalar_value(adapter, var.ref, type_info),
    )


def _gate(adapter, address, type_info):
    if address == 0:
        return "null"
    if address < ZERO_PAGE:
        return "zeroPage"
    if type_info is None:
        return None

    alignment = type_info.alignment
    if alignment and address % alignment != 0:
        return "misaligned"

    size = type_info.size
    if not size or size <= 0 or size > MAX_OBJECT_SIZE:
        return "invalidSize"
    if not adapter.readable(address, size):
        return "unreadable"

    return None


def _push_gate_failure(frontier, address, gate, type_info, depth):
    frontier.push(address, type_info, depth, GATE_NODE_REASON.get(gate, ("error", gate)))


def _follow(builder, frontier, adapter, address, pointee_type, depth, config):
    if address == 0:
        return None, "null"
    if pointee_type is not None and pointee_type.category == dbga_adapter.CHAR:
        return None, "notFollowed"

    if pointee_type is not None and pointee_type.category == dbga_adapter.VOID:
        return _terminal(frontier, adapter, address, pointee_type, "void", depth)
    if pointee_type is not None and pointee_type.category == dbga_adapter.FUNCTION:
        return _terminal(frontier, adapter, address, pointee_type, "functionPointer", depth)

    return _adopt(builder, frontier, adapter, address, pointee_type, depth, config)


def _terminal(frontier, adapter, address, type_info, reason, depth):
    gate = _gate(adapter, address, None)
    if gate is not None:
        _push_gate_failure(frontier, address, gate, type_info, depth)
        return address, "unreadable"
    frontier.push(address, type_info, depth, (reason, None))
    return address, "ok"


def _adopt(builder, frontier, adapter, address, type_info, depth, config):
    if address is None:
        return None, "unreadable"

    gate = _gate(adapter, address, type_info)
    if gate is not None:
        _push_gate_failure(frontier, address, gate, type_info, depth)
        return address, "unreadable"

    frontier.push(address, type_info, depth)
    return address, "ok"


def visit(builder, frontier, adapter, address, type_info, depth, config, reason=None, annotations=None):
    if reason is not None:
        builder.opaque_node(address, reason[0], None if type_info is None else type_info.name, reason[1])
        return
    annotated = None if annotations is None else annotations.get(address)
    if annotated is not None:
        _visit_annotated(builder, frontier, adapter, address, annotated[0], annotated[1], depth, config)
        return
    if type_info is not None and type_info.category in (dbga_adapter.RECORD, dbga_adapter.UNION):
        _visit_record(builder, frontier, adapter, address, type_info, depth, config)
        return
    if type_info is not None and type_info.category == dbga_adapter.ARRAY:
        _visit_array(builder, frontier, adapter, address, type_info, depth, config)
        return
    builder.opaque_node(address, "notExpanded", None if type_info is None else type_info.name)


def _visit_record(builder, frontier, adapter, address, type_info, depth, config):
    reference = adapter.object_at(address, type_info)
    fields = []
    arrays = []
    pointers = []
    counter = [0]

    _collect(builder, frontier, adapter, reference, type_info, address, "", fields, arrays, pointers, depth, config, counter)

    is_union = type_info.category == dbga_adapter.UNION
    builder.record_node(
        address,
        type_info.name,
        "union" if is_union else "struct",
        type_info.size,
        fields,
        arrays,
        pointers,
        [entry["name"] for entry in fields],
        is_union,
    )


def _collect(builder, frontier, adapter, reference, type_info, node_address, prefix, fields, arrays, pointers, depth, config, counter):
    for info in type_info.fields:
        if info.is_artificial:
            continue
        if counter[0] >= config.max_fields:
            builder.truncate("fieldLimit")
            return

        try:
            child = adapter.field(reference, info.descriptor)
            child_type = adapter.type_of(child)
        except Exception as error:
            counter[0] += 1
            fields.append(
                dbga_snapshot.field(
                    _path(prefix, info.name), "", dbga_snapshot.opaque_value("error", detail=str(error))
                )
            )
            continue

        if info.is_base:
            _collect(builder, frontier, adapter, child, child_type, node_address, prefix, fields, arrays, pointers, depth, config, counter)
            continue

        name = _path(prefix, info.name)

        category = child_type.category

        if category in (dbga_adapter.RECORD, dbga_adapter.UNION):
            _collect(builder, frontier, adapter, child, child_type, node_address, name, fields, arrays, pointers, depth, config, counter)
            continue

        if category == dbga_adapter.ARRAY:
            _inline_array(builder, frontier, adapter, node_address, name, child, child_type, arrays, pointers, depth, config)
            continue

        if category == dbga_adapter.POINTER:
            _pointer_field(builder, frontier, adapter, node_address, name, child, child_type, fields, pointers, depth, config, counter)
            continue

        counter[0] += 1
        fields.append(dbga_snapshot.field(name, child_type.name, _scalar_value(adapter, child, child_type)))


def _pointer_field(builder, frontier, adapter, node_address, name, child, child_type, fields, pointers, depth, config, counter):
    child_type = _refined_type(adapter, child, child_type)
    pointee = child_type.target

    if pointee is not None and pointee.category == dbga_adapter.CHAR:
        counter[0] += 1
        if _is_narrow_char(pointee):
            payload = _text_from_pointer(adapter, adapter.pointer_value(child), config.max_text)
        else:
            payload = dbga_snapshot.opaque_value("unknownType")
        fields.append(dbga_snapshot.field(name, child_type.name, payload))
        return

    if builder.edge_count() >= config.max_edges:
        builder.truncate("edgeLimit")
        return

    pointers.append(name)

    value = adapter.pointer_value(child)
    if value == 0:
        builder.edge(node_address, name, None, child_type.name)
        return

    node, _status = _follow(builder, frontier, adapter, value, pointee, depth + 1, config)
    builder.edge(node_address, name, value if node is None else node, child_type.name)


CELL_SCALAR = "scalar"
CELL_TEXT = "text"
CELL_POINTER = "pointer"
CELL_OPAQUE = "opaque"


def _cell_kind(element_type):
    if element_type is None or element_type.is_aggregate():
        return CELL_OPAQUE
    if element_type.category == dbga_adapter.POINTER:
        return CELL_TEXT if _is_narrow_char(element_type.target) else CELL_POINTER
    return CELL_SCALAR


def _cell_limit(builder, count, config):
    if count > config.max_cells:
        builder.truncate("cellLimit")
        return config.max_cells, True
    return count, False


def _element_cell(adapter, reference):
    def cell(index):
        return adapter.element(reference, index)

    return cell


def _memory_cell(adapter, address, element_type):
    size = element_type.size

    def cell(index):
        return adapter.object_at(address + index * size, element_type)

    return cell


def _read_cells(builder, adapter, cell, element_type, count, config, kind):
    limit, truncated = _cell_limit(builder, count, config)
    cells = []

    for index in range(limit):
        try:
            reference = cell(index)
            if kind == CELL_TEXT:
                cells.append(
                    _text_from_pointer(adapter, adapter.pointer_value(reference), config.max_text)
                )
            else:
                cells.append(_scalar_value(adapter, reference, element_type))
        except Exception as error:
            cells.append(dbga_snapshot.opaque_value("error", detail=str(error)))

    return cells, truncated


def _pointer_cells(builder, frontier, adapter, cell, source, label, element_type, count, depth, config):
    limit, truncated = _cell_limit(builder, count, config)
    pointee = element_type.target

    for index in range(limit):
        if builder.edge_count() >= config.max_edges:
            builder.truncate("edgeLimit")
            return truncated

        name = "%s[%d]" % (label, index)

        try:
            value = adapter.pointer_value(cell(index))
        except Exception as error:
            builder.error("edge", name, error)
            continue

        if value == 0:
            builder.edge(source, name, None, element_type.name)
            continue

        node, _status = _follow(builder, frontier, adapter, value, pointee, depth + 1, config)
        builder.edge(source, name, value if node is None else node, element_type.name)

    return truncated


def _inline_array(builder, frontier, adapter, node_address, name, child, child_type, arrays, pointers, depth, config):
    element_type = child_type.target
    element_name = "" if element_type is None else element_type.name
    count = child_type.element_count or 0
    kind = _cell_kind(element_type)

    if count <= 0 or kind == CELL_OPAQUE:
        arrays.append(dbga_snapshot.inline_array(name, element_name, count, [], False, False))
        return

    if kind == CELL_POINTER:
        pointers.append(name)
        truncated = _pointer_cells(
            builder, frontier, adapter, _element_cell(adapter, child), node_address, name,
            element_type, count, depth, config,
        )
        arrays.append(dbga_snapshot.inline_array(name, element_name, count, [], truncated, True))
        return

    cells, truncated = _read_cells(
        builder, adapter, _element_cell(adapter, child), element_type, count, config, kind
    )
    arrays.append(dbga_snapshot.inline_array(name, element_name, count, cells, truncated, True))


def _visit_array(builder, frontier, adapter, address, type_info, depth, config):
    element_type = type_info.target
    count = type_info.element_count

    if element_type is None or count is None or count <= 0:
        builder.opaque_node(address, "notExpanded", type_info.name)
        return

    if element_type.category in (dbga_adapter.RECORD, dbga_adapter.UNION):
        _expand_elements(builder, frontier, adapter, address, element_type, count, depth, config)
        return

    kind = _cell_kind(element_type)
    if kind == CELL_OPAQUE:
        builder.opaque_node(address, "notExpanded", type_info.name)
        return

    reference = adapter.object_at(address, type_info)

    if kind == CELL_POINTER:
        cells = []
        truncated = _pointer_cells(
            builder, frontier, adapter, _element_cell(adapter, reference), address, "",
            element_type, count, depth, config,
        )
    else:
        cells, truncated = _read_cells(
            builder, adapter, _element_cell(adapter, reference), element_type, count, config, kind
        )

    builder.array_node(
        address,
        type_info.name,
        element_type.name,
        count,
        cells,
        kind == CELL_POINTER,
        truncated,
        "static",
    )


ANNOTATION_UNRESOLVED = "annotationUnresolved"
ANNOTATION_NOT_POINTER = "annotationNotPointer"
ANNOTATION_NON_INTEGER_LENGTH = "annotationNonIntegerLength"
ANNOTATION_LENGTH = "annotationLength"
ANNOTATION_DUPLICATE = "annotationDuplicate"
ANNOTATION_NOT_SUPPORTED = "annotationNotSupported"


def _annotation_frames(frames, function):
    if function is None:
        return [frame for frame in frames if frame.user_code]
    return [frame for frame in frames if frame.user_code and frame.function == function]


def _annotation_pointer(adapter, frames, path):
    for frame in frames:
        reference = adapter.eval(frame, path)
        if reference is None:
            continue
        try:
            return frame, reference, adapter.type_of(reference)
        except Exception:
            continue
    return None, None, None


def _annotation_length(adapter, frame, expression):
    reference = adapter.eval(frame, expression)
    if reference is None:
        return None, ANNOTATION_UNRESOLVED

    try:
        type_info = adapter.type_of(reference)
    except Exception:
        return None, ANNOTATION_UNRESOLVED

    if type_info is None or type_info.category not in dbga_adapter.INTEGER_CATEGORIES:
        return None, ANNOTATION_NON_INTEGER_LENGTH

    try:
        length = int(adapter.read_int(reference))
    except Exception:
        return None, ANNOTATION_UNRESOLVED

    if length <= 0 or length > MAX_ANNOTATED_LENGTH:
        return None, ANNOTATION_LENGTH
    return length, None


def _annotated_element(type_info):
    element_type = type_info.target

    if element_type is None or _cell_kind(element_type) == CELL_OPAQUE:
        return None
    if element_type.category in (dbga_adapter.VOID, dbga_adapter.FUNCTION):
        return None
    if not element_type.size or element_type.size <= 0:
        return None
    return element_type


def _resolve_annotations(builder, frontier, adapter, frames, config):
    resolved = {}

    for text in config.dynamic_arrays:
        parsed, reason = dbga_adapter.parse_annotation(text)
        if reason is not None:
            builder.error("annotation", text, reason)
            continue

        function, path, size = parsed
        frame, reference, type_info = _annotation_pointer(
            adapter, _annotation_frames(frames, function), path
        )

        if frame is None:
            builder.error("annotation", text, ANNOTATION_UNRESOLVED)
            continue
        if type_info is None or type_info.category != dbga_adapter.POINTER:
            builder.error("annotation", text, ANNOTATION_NOT_POINTER)
            continue

        length, reason = _annotation_length(adapter, frame, size)
        if reason is not None:
            builder.error("annotation", text, reason)
            continue

        element_type = _annotated_element(type_info)
        if element_type is None:
            builder.error("annotation", text, ANNOTATION_NOT_SUPPORTED)
            continue

        address = adapter.pointer_value(reference)
        if address in resolved:
            builder.error("annotation", text, ANNOTATION_DUPLICATE)
            continue

        gate = _gate(adapter, address, element_type)
        if gate is not None:
            _push_gate_failure(frontier, address, gate, element_type, 0)
            continue

        resolved[address] = (element_type, length)
        frontier.push(address, element_type, 0)

    return resolved


def _visit_annotated(builder, frontier, adapter, address, element_type, length, depth, config):
    kind = _cell_kind(element_type)
    cell = _memory_cell(adapter, address, element_type)

    if kind == CELL_POINTER:
        cells = []
        truncated = _pointer_cells(
            builder, frontier, adapter, cell, address, "", element_type, length, depth, config
        )
    else:
        cells, truncated = _read_cells(builder, adapter, cell, element_type, length, config, kind)

    builder.array_node(
        address,
        "%s[%d]" % (element_type.name, length),
        element_type.name,
        length,
        cells,
        kind == CELL_POINTER,
        truncated,
        "annotated",
    )


def _expand_elements(builder, frontier, adapter, address, element_type, count, depth, config):
    size = element_type.size
    if not size or size <= 0:
        builder.opaque_node(address, "notExpanded", element_type.name)
        return

    _visit_record(builder, frontier, adapter, address, element_type, depth, config)

    for index in range(1, count):
        if builder.node_count() >= config.max_nodes:
            builder.truncate("nodeLimit")
            return
        _adopt(builder, frontier, adapter, address + index * size, element_type, depth, config)


def _path(prefix, name):
    label = name or ""
    if not prefix:
        return label
    return prefix + "." + label


def _is_narrow_char(type_info):
    return (
        type_info is not None
        and type_info.category == dbga_adapter.CHAR
        and type_info.size == 1
    )


def _is_narrow_char_array(type_info):
    return type_info.category == dbga_adapter.ARRAY and _is_narrow_char(type_info.target)


def _read_text_bytes(adapter, address, limit):
    for length in (limit, PAGE_SIZE - (address % PAGE_SIZE)):
        if length <= 0 or length > limit:
            continue
        try:
            return adapter.read_bytes(address, length)
        except Exception:
            continue
    return None


def _text_from_pointer(adapter, address, limit):
    if address == 0:
        return dbga_snapshot.opaque_value("null")
    if address < ZERO_PAGE:
        return dbga_snapshot.opaque_value("unreadable", address=address)

    raw = _read_text_bytes(adapter, address, limit)
    if raw is None:
        return dbga_snapshot.opaque_value("unreadable", address=address)
    return dbga_snapshot.text_value(*dbga_adapter.cut_text(raw))


def _text_from_array(adapter, address, type_info, limit):
    length = min(type_info.element_count or 0, limit)
    if address is None or length <= 0:
        return dbga_snapshot.opaque_value("unreadable", address=address)

    raw = _read_text_bytes(adapter, address, length)
    if raw is None:
        return dbga_snapshot.opaque_value("unreadable", address=address)
    return dbga_snapshot.text_value(*dbga_adapter.cut_text(raw))


def _real_value(adapter, reference, type_info):
    value, special = dbga_adapter.decode_real(adapter.value_bytes(reference), type_info.size)
    if value is None and special is None:
        return dbga_snapshot.opaque_value("unknownType")
    return dbga_snapshot.real_value(value, special)


def _enum_value(adapter, reference, type_info):
    raw = adapter.read_enum(reference)
    for name, value in adapter.enumerators(type_info):
        if value == raw:
            return dbga_snapshot.enum_value(raw, name)
    return dbga_snapshot.enum_value(raw, None)


def _scalar_value(adapter, reference, type_info):
    category = type_info.category
    try:
        if category == dbga_adapter.INT:
            return dbga_snapshot.int_value(adapter.read_int(reference), type_info.signed)
        if category == dbga_adapter.BOOL:
            return dbga_snapshot.bool_value(adapter.read_bool(reference))
        if category == dbga_adapter.CHAR:
            point = adapter.read_int(reference)
            return dbga_snapshot.char_value(point, dbga_adapter.char_text(point, type_info.size))
        if category == dbga_adapter.ENUM:
            return _enum_value(adapter, reference, type_info)
        if category == dbga_adapter.REAL:
            return _real_value(adapter, reference, type_info)
    except Exception as error:
        return dbga_snapshot.opaque_value("error", detail=str(error))
    return dbga_snapshot.opaque_value("unknownType")
