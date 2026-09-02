import dbga_adapter
import dbga_snapshot
import dbga_gates

def field_path(prefix, name):
    label = name or ""
    if not prefix:
        return label
    return prefix + "." + label


def is_narrow_char(type_info):
    return (
        type_info is not None
        and type_info.category == dbga_adapter.CHAR
        and type_info.size == 1
    )


def is_narrow_char_array(type_info):
    return type_info.category == dbga_adapter.ARRAY and is_narrow_char(type_info.target)


def _read_text_bytes(adapter, address, limit):
    for length in (limit, dbga_gates.PAGE_SIZE - (address % dbga_gates.PAGE_SIZE)):
        if length <= 0 or length > limit:
            continue
        try:
            return adapter.read_bytes(address, length)
        except Exception:
            continue
    return None


def text_from_pointer(adapter, address, limit):
    if address == 0:
        return dbga_snapshot.opaque_value("null")
    if address < dbga_gates.ZERO_PAGE:
        return dbga_snapshot.opaque_value("unreadable", address=address)

    raw = _read_text_bytes(adapter, address, limit)
    if raw is None:
        return dbga_snapshot.opaque_value("unreadable", address=address)
    return dbga_snapshot.text_value(*dbga_adapter.cut_text(raw))


def text_from_array(adapter, address, type_info, limit):
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


def scalar_value(adapter, reference, type_info):
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
