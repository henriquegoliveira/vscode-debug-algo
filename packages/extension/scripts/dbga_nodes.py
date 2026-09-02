import dbga_adapter
import dbga_snapshot
import dbga_gates
import dbga_values

def visit_scalar(builder, adapter, address, type_info):
    try:
        value = dbga_values.scalar_value(adapter, adapter.object_at(address, type_info), type_info)
    except Exception:
        value = None

    if value is not None and value.get("t") == "opaque":
        value = None

    builder.opaque_node(address, "notExpanded", type_info.name, value=value)


def visit_record(builder, frontier, adapter, address, type_info, depth, config):
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
                    dbga_values.field_path(prefix, info.name), "", dbga_snapshot.opaque_value("error", detail=str(error))
                )
            )
            continue

        if info.is_base:
            _collect(builder, frontier, adapter, child, child_type, node_address, prefix, fields, arrays, pointers, depth, config, counter)
            continue

        name = dbga_values.field_path(prefix, info.name)

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
        fields.append(dbga_snapshot.field(name, child_type.name, dbga_values.scalar_value(adapter, child, child_type)))


def _pointer_field(builder, frontier, adapter, node_address, name, child, child_type, fields, pointers, depth, config, counter):
    child_type = dbga_gates.refined_type(adapter, child, child_type)
    pointee = child_type.target

    if pointee is not None and pointee.category == dbga_adapter.CHAR:
        counter[0] += 1
        if dbga_values.is_narrow_char(pointee):
            payload = dbga_values.text_from_pointer(adapter, adapter.pointer_value(child), config.max_text)
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

    node, _status = dbga_gates.follow_pointer(builder, frontier, adapter, value, pointee, depth + 1, config)
    builder.edge(node_address, name, value if node is None else node, child_type.name)


CELL_SCALAR = "scalar"
CELL_TEXT = "text"
CELL_POINTER = "pointer"
CELL_OPAQUE = "opaque"


def cell_kind(element_type):
    if element_type is None or element_type.is_aggregate():
        return CELL_OPAQUE
    if element_type.category == dbga_adapter.POINTER:
        return CELL_TEXT if dbga_values.is_narrow_char(element_type.target) else CELL_POINTER
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


def memory_cell(adapter, address, element_type):
    size = element_type.size

    def cell(index):
        return adapter.object_at(address + index * size, element_type)

    return cell


def read_cells(builder, adapter, cell, element_type, count, config, kind):
    limit, truncated = _cell_limit(builder, count, config)
    cells = []

    for index in range(limit):
        try:
            reference = cell(index)
            if kind == CELL_TEXT:
                cells.append(
                    dbga_values.text_from_pointer(adapter, adapter.pointer_value(reference), config.max_text)
                )
            else:
                cells.append(dbga_values.scalar_value(adapter, reference, element_type))
        except Exception as error:
            cells.append(dbga_snapshot.opaque_value("error", detail=str(error)))

    return cells, truncated


def pointer_cells(builder, frontier, adapter, cell, source, label, element_type, count, depth, config):
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

        node, _status = dbga_gates.follow_pointer(builder, frontier, adapter, value, pointee, depth + 1, config)
        builder.edge(source, name, value if node is None else node, element_type.name)

    return truncated


def _inline_array(builder, frontier, adapter, node_address, name, child, child_type, arrays, pointers, depth, config):
    element_type = child_type.target
    element_name = "" if element_type is None else element_type.name
    count = child_type.element_count or 0
    kind = cell_kind(element_type)

    if count <= 0 or kind == CELL_OPAQUE:
        arrays.append(dbga_snapshot.inline_array(name, element_name, count, [], False, False))
        return

    if kind == CELL_POINTER:
        pointers.append(name)
        truncated = pointer_cells(
            builder, frontier, adapter, _element_cell(adapter, child), node_address, name,
            element_type, count, depth, config,
        )
        arrays.append(dbga_snapshot.inline_array(name, element_name, count, [], truncated, True))
        return

    cells, truncated = read_cells(
        builder, adapter, _element_cell(adapter, child), element_type, count, config, kind
    )
    arrays.append(dbga_snapshot.inline_array(name, element_name, count, cells, truncated, True))


def visit_array(builder, frontier, adapter, address, type_info, depth, config):
    element_type = type_info.target
    count = type_info.element_count

    if element_type is None or count is None or count <= 0:
        builder.opaque_node(address, "notExpanded", type_info.name)
        return

    if element_type.category in (dbga_adapter.RECORD, dbga_adapter.UNION):
        expand_elements(builder, frontier, adapter, address, element_type, count, depth, config)
        return

    kind = cell_kind(element_type)
    if kind == CELL_OPAQUE:
        builder.opaque_node(address, "notExpanded", type_info.name)
        return

    reference = adapter.object_at(address, type_info)

    if kind == CELL_POINTER:
        cells = []
        truncated = pointer_cells(
            builder, frontier, adapter, _element_cell(adapter, reference), address, "",
            element_type, count, depth, config,
        )
    else:
        cells, truncated = read_cells(
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


def expand_elements(builder, frontier, adapter, address, element_type, count, depth, config):
    size = element_type.size
    if not size or size <= 0:
        builder.opaque_node(address, "notExpanded", element_type.name)
        return

    visit_record(builder, frontier, adapter, address, element_type, depth, config)

    for index in range(1, count):
        if builder.node_count() >= config.max_nodes:
            builder.truncate("nodeLimit")
            return
        dbga_gates.adopt(builder, frontier, adapter, address + index * size, element_type, depth, config)
