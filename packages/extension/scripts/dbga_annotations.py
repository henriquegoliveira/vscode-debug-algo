import dbga_adapter
import dbga_gates
import dbga_nodes

MAX_ANNOTATED_LENGTH = 1 << 20


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

    if element_type is None or dbga_nodes.cell_kind(element_type) == dbga_nodes.CELL_OPAQUE:
        return None
    if element_type.category in (dbga_adapter.VOID, dbga_adapter.FUNCTION):
        return None
    if not element_type.size or element_type.size <= 0:
        return None
    return element_type


def resolve_annotations(builder, frontier, adapter, frames, config):
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

        gate = dbga_gates.gate_reason(adapter, address, element_type)
        if gate is not None:
            dbga_gates.push_gate_failure(frontier, address, gate, element_type, 0)
            continue

        resolved[address] = (element_type, length)
        frontier.push(address, element_type, 0)

    return resolved


def visit_annotated(builder, frontier, adapter, address, element_type, length, depth, config):
    kind = dbga_nodes.cell_kind(element_type)
    cell = dbga_nodes.memory_cell(adapter, address, element_type)

    if kind == dbga_nodes.CELL_POINTER:
        cells = []
        truncated = dbga_nodes.pointer_cells(
            builder, frontier, adapter, cell, address, "", element_type, length, depth, config
        )
    else:
        cells, truncated = dbga_nodes.read_cells(builder, adapter, cell, element_type, length, config, kind)

    builder.array_node(
        address,
        "%s[%d]" % (element_type.name, length),
        element_type.name,
        length,
        cells,
        kind == dbga_nodes.CELL_POINTER,
        truncated,
        "annotated",
    )
