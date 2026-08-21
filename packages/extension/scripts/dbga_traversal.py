import collections
import time

import dbga_adapter
import dbga_snapshot

ZERO_PAGE = 0x1000
PAGE_SIZE = 0x1000
MAX_OBJECT_SIZE = 1 << 20

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
        self.max_cells = 512
        self.max_fields = 64
        self.max_text = 200
        self.max_value_nesting = 3
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

    for frame in adapter.frames():
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
            visit(builder, frontier, adapter, address, type_info, depth, config, reason)
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


def visit(builder, frontier, adapter, address, type_info, depth, config, reason=None):
    if reason is not None:
        builder.opaque_node(address, reason[0], None if type_info is None else type_info.name, reason[1])
        return
    if type_info is not None and type_info.category in (dbga_adapter.RECORD, dbga_adapter.UNION):
        _visit_record(builder, frontier, adapter, address, type_info, depth, config)
        return
    builder.opaque_node(address, "notExpanded", None if type_info is None else type_info.name)


def _visit_record(builder, frontier, adapter, address, type_info, depth, config):
    reference = adapter.object_at(address, type_info)
    fields = []
    arrays = []
    counter = [0]

    _collect(builder, frontier, adapter, reference, type_info, address, "", fields, arrays, depth, config, counter)

    is_union = type_info.category == dbga_adapter.UNION
    builder.record_node(
        address,
        type_info.name,
        "union" if is_union else "struct",
        type_info.size,
        fields,
        arrays,
        is_union,
    )


def _collect(builder, frontier, adapter, reference, type_info, node_address, prefix, fields, arrays, depth, config, counter):
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
            _collect(builder, frontier, adapter, child, child_type, node_address, prefix, fields, arrays, depth, config, counter)
            continue

        name = _path(prefix, info.name)

        category = child_type.category

        if category in (dbga_adapter.RECORD, dbga_adapter.UNION):
            _collect(builder, frontier, adapter, child, child_type, node_address, name, fields, arrays, depth, config, counter)
            continue

        if category == dbga_adapter.ARRAY:
            element = child_type.target
            arrays.append(
                dbga_snapshot.inline_array(
                    name,
                    "" if element is None else element.name,
                    child_type.element_count or 0,
                    [],
                    False,
                    False,
                )
            )
            continue

        if category == dbga_adapter.POINTER:
            _pointer_field(builder, frontier, adapter, node_address, name, child, child_type, fields, depth, config, counter)
            continue

        counter[0] += 1
        fields.append(dbga_snapshot.field(name, child_type.name, _scalar_value(adapter, child, child_type)))


def _pointer_field(builder, frontier, adapter, node_address, name, child, child_type, fields, depth, config, counter):
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

    value = adapter.pointer_value(child)
    if value == 0:
        builder.edge(node_address, name, None, child_type.name)
        return

    node, _status = _follow(builder, frontier, adapter, value, pointee, depth + 1, config)
    builder.edge(node_address, name, value if node is None else node, child_type.name)


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
