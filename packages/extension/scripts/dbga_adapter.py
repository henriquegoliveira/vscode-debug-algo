POINTER = "pointer"
REFERENCE = "reference"
RECORD = "record"
UNION = "union"
ARRAY = "array"
INT = "int"
REAL = "real"
BOOL = "bool"
CHAR = "char"
ENUM = "enum"
FUNCTION = "function"
VOID = "void"
UNKNOWN = "unknown"

AGGREGATE_CATEGORIES = (RECORD, UNION, ARRAY)

LOCAL = "local"
PARAMETER = "parameter"

_UNRESOLVED = object()


class FrameInfo(object):
    __slots__ = ("level", "function", "user_code", "handle")

    def __init__(self, level, function, user_code, handle):
        self.level = level
        self.function = function
        self.user_code = user_code
        self.handle = handle


class VarInfo(object):
    __slots__ = ("name", "origin", "ref", "valid")

    def __init__(self, name, origin, ref, valid):
        self.name = name
        self.origin = origin
        self.ref = ref
        self.valid = valid


class FieldInfo(object):
    __slots__ = ("descriptor", "name", "offset_bits", "bitsize", "is_base", "is_artificial")

    def __init__(self, descriptor, name, offset_bits, bitsize, is_base, is_artificial):
        self.descriptor = descriptor
        self.name = name
        self.offset_bits = offset_bits
        self.bitsize = bitsize
        self.is_base = is_base
        self.is_artificial = is_artificial


class TypeInfo(object):
    __slots__ = (
        "adapter",
        "category",
        "name",
        "size",
        "alignment",
        "signed",
        "element_count",
        "handle",
        "_target",
        "_fields",
    )

    def __init__(self, adapter, category, name, size, alignment, signed, element_count, handle):
        self.adapter = adapter
        self.category = category
        self.name = name
        self.size = size
        self.alignment = alignment
        self.signed = signed
        self.element_count = element_count
        self.handle = handle
        self._target = _UNRESOLVED
        self._fields = _UNRESOLVED

    @property
    def target(self):
        if self._target is _UNRESOLVED:
            self._target = self.adapter.resolve_target(self)
        return self._target

    @property
    def fields(self):
        if self._fields is _UNRESOLVED:
            self._fields = self.adapter.resolve_fields(self)
        return self._fields

    def is_aggregate(self):
        return self.category in AGGREGATE_CATEGORIES


class Adapter(object):
    debugger_name = None

    def frames(self):
        raise NotImplementedError

    def variables(self, frame):
        raise NotImplementedError

    def type_of(self, ref):
        raise NotImplementedError

    def resolve_target(self, type_info):
        raise NotImplementedError

    def resolve_fields(self, type_info):
        raise NotImplementedError

    def address_of(self, ref):
        raise NotImplementedError

    def pointer_value(self, ref):
        raise NotImplementedError

    def referenced(self, ref):
        raise NotImplementedError

    def dynamic_type_of(self, ref):
        raise NotImplementedError

    def field(self, ref, field_descriptor):
        raise NotImplementedError

    def element(self, ref, index):
        raise NotImplementedError

    def object_at(self, address, type_info):
        raise NotImplementedError

    def readable(self, address, size):
        raise NotImplementedError

    def read_int(self, ref):
        raise NotImplementedError

    def read_real(self, ref):
        raise NotImplementedError

    def read_bool(self, ref):
        raise NotImplementedError

    def read_enum(self, ref):
        raise NotImplementedError

    def read_text(self, address, limit):
        raise NotImplementedError

    def eval_int(self, frame, expression):
        raise NotImplementedError
