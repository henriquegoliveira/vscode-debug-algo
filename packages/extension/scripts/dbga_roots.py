import dbga_adapter
import dbga_snapshot
import dbga_gates
import dbga_values

def classify_root(builder, frontier, adapter, frame, var, config):
    type_info = adapter.type_of(var.ref)
    if var.valid:
        type_info = dbga_gates.refined_type(adapter, var.ref, type_info)
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

    if indirections == 1 and dbga_values.is_narrow_char(type_info.target):
        emit(value, None, "notFollowed", dbga_values.text_from_pointer(adapter, value, config.max_text))
        return

    if indirections == 2:
        inner_type = type_info.target
        reason = dbga_gates.gate_reason(adapter, value, inner_type)
        if reason is not None:
            dbga_gates.push_gate_failure(frontier, value, reason, inner_type, 1)
            emit(value, value, "unreadable")
            return
        inner = adapter.object_at(value, inner_type)
        node, status = dbga_gates.follow_pointer(builder, frontier, adapter, adapter.pointer_value(inner), inner_type.target, 1, config)
        emit(value, node, status)
        return

    node, status = dbga_gates.follow_pointer(builder, frontier, adapter, value, type_info.target, 1, config)
    emit(value, node, status)


def _reference_root(builder, frontier, adapter, frame, var, type_info, config):
    referent = adapter.referenced(var.ref)
    if referent is None:
        builder.root(
            var.name, frame.function, frame.level, var.origin, type_info.name,
            "reference", None, None, 0, None, "unreadable",
        )
        return

    referent_type = dbga_gates.refined_type(adapter, referent, adapter.type_of(referent))
    address = adapter.address_of(referent)
    node, status = dbga_gates.adopt(builder, frontier, adapter, address, referent_type, 1, config)
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
    if dbga_values.is_narrow_char_array(type_info):
        payload = dbga_values.text_from_array(adapter, address, type_info, config.max_text)

    node, status = dbga_gates.adopt(builder, frontier, adapter, address, type_info, 0, config)
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
        dbga_values.scalar_value(adapter, var.ref, type_info),
    )
