import math
import struct

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
SCALAR_CATEGORIES = (INT, REAL, BOOL, CHAR, ENUM)

LOCAL = "local"
PARAMETER = "parameter"
GLOBAL = "global"

_UNRESOLVED = object()

ELABORATED_KEYWORDS = ("struct", "class", "union", "enum")
TYPE_QUALIFIERS = ("const", "volatile")

_IDENTIFIER_EXTRA = "_$:"
_OPEN_PUNCTUATION = ("(", "[")
_CLOSE_PUNCTUATION = (")", "]", ",")
_INDIRECTION = ("*", "&")


def _is_identifier(token):
    if not token:
        return False
    head = token[0]
    return head.isalpha() or head.isdigit() or head in _IDENTIFIER_EXTRA


def _tokenize_type_name(name):
    tokens = []
    current = []

    for char in name:
        if char.isalnum() or char in _IDENTIFIER_EXTRA:
            current.append(char)
            continue
        if current:
            tokens.append("".join(current))
            current = []
        if not char.isspace():
            tokens.append(char)

    if current:
        tokens.append("".join(current))

    return tokens


def _strip_keywords(tokens):
    kept = []
    index = 0

    while index < len(tokens):
        token = tokens[index]

        if token in TYPE_QUALIFIERS:
            index += 1
            continue
        if (
            token in ELABORATED_KEYWORDS
            and index + 1 < len(tokens)
            and _is_identifier(tokens[index + 1])
        ):
            index += 1
            continue

        kept.append(token)
        index += 1

    return kept


def _needs_space(previous, token):
    if previous in _OPEN_PUNCTUATION:
        return False
    if token in _CLOSE_PUNCTUATION or token in _OPEN_PUNCTUATION:
        return False
    if token in _INDIRECTION:
        return previous not in _INDIRECTION
    if previous in _INDIRECTION:
        return _is_identifier(token)
    return _is_identifier(previous) and _is_identifier(token)


_TYPE_SYNONYMS = {
    "_Bool": ("bool",),
    "__float128": ("long", "double"),
}


def _apply_type_synonyms(tokens):
    expanded = []
    for token in tokens:
        expanded.extend(_TYPE_SYNONYMS.get(token, (token,)))
    return expanded


def canonical_type_name(name):
    if name is None:
        return None

    text = str(name)
    tokens = _apply_type_synonyms(_strip_keywords(_tokenize_type_name(text)))
    if not tokens:
        return text.strip()

    parts = []
    previous = None
    for token in tokens:
        if previous is not None and _needs_space(previous, token):
            parts.append(" ")
        parts.append(token)
        previous = token

    return "".join(parts)


X87_SIZES = (10, 12, 16)

SURROGATE_RANGE = (0xD800, 0xDFFF)

MAX_CODE_POINT = 0x10FFFF


def _classify_real(value):
    if math.isnan(value):
        return None, "nan"
    if math.isinf(value):
        return None, "-inf" if value < 0 else "inf"
    return value, None


def _decode_x87(raw):
    mantissa = int.from_bytes(raw[0:8], "little")
    tail = int.from_bytes(raw[8:10], "little")
    sign = -1.0 if tail & 0x8000 else 1.0
    exponent = tail & 0x7FFF

    if exponent == 0x7FFF:
        if mantissa & ((1 << 63) - 1):
            return None, "nan"
        return None, "-inf" if sign < 0 else "inf"

    try:
        if exponent == 0:
            scaled = mantissa * (2.0 ** -16382) * (2.0 ** -63)
        else:
            scaled = mantissa * (2.0 ** (exponent - 16383 - 63))
    except OverflowError:
        return None, "-inf" if sign < 0 else "inf"

    return _classify_real(sign * scaled)


def decode_real(raw, size):
    if raw is None:
        return None, None

    if size == 4 and len(raw) >= 4:
        return _classify_real(struct.unpack("<f", bytes(raw[:4]))[0])
    if size == 8 and len(raw) >= 8:
        return _classify_real(struct.unpack("<d", bytes(raw[:8]))[0])
    if size in X87_SIZES and len(raw) >= 10:
        return _decode_x87(bytes(raw[:10]))

    return None, None


def char_text(value, width):
    size = width if width in (1, 2, 4) else 4
    point = int(value) & ((1 << (size * 8)) - 1)

    if size == 1:
        if 0x20 <= point <= 0x7E:
            return chr(point)
        return "\\x%02x" % point

    printable = (
        point <= MAX_CODE_POINT
        and not (SURROGATE_RANGE[0] <= point <= SURROGATE_RANGE[1])
        and chr(point).isprintable()
    )
    if printable:
        return chr(point)
    if point <= 0xFFFF:
        return "\\u%04x" % point
    return "\\U%08x" % point


def cut_text(raw):
    if raw is None:
        return "", False

    body = bytes(raw)
    cut = body.find(b"\x00")
    if cut >= 0:
        return body[:cut].decode("utf-8", "replace"), False
    return body.decode("utf-8", "replace"), True



INTEGER_CATEGORIES = (INT, ENUM, BOOL)

ANNOTATION_SYNTAX = "annotationSyntax"
ANNOTATION_CALL = "annotationCall"

_ANNOTATION_IDENTIFIER_EXTRA = "_$:"


def _is_annotation_identifier(text):
    if not text:
        return False
    if not (text[0].isalpha() or text[0] == "_"):
        return False
    for char in text:
        if not (char.isalnum() or char in _ANNOTATION_IDENTIFIER_EXTRA):
            return False
    return True


def _split_function(text):
    index = 0
    while index < len(text):
        if text[index] != ":":
            index += 1
            continue
        if index + 1 < len(text) and text[index + 1] == ":":
            index += 2
            continue
        return text[:index], text[index + 1 :]
    return None, text


def _calls_function(text):
    previous = None
    for char in text:
        if char.isspace():
            continue
        if char == "(" and previous is not None:
            if previous.isalnum() or previous in _ANNOTATION_IDENTIFIER_EXTRA:
                return True
        previous = char
    return False


def parse_annotation(text):
    head, separator, length = str(text).strip().partition("@")
    if not separator:
        return None, ANNOTATION_SYNTAX

    function, path = _split_function(head)
    path = path.strip()
    length = length.strip()

    if not path or not length:
        return None, ANNOTATION_SYNTAX
    if function is not None:
        function = function.strip()
        if not _is_annotation_identifier(function):
            return None, ANNOTATION_SYNTAX

    if _calls_function(path) or _calls_function(length):
        return None, ANNOTATION_CALL

    return (function, path, length), None


class FrameInfo(object):
    __slots__ = ("level", "function", "user_code", "handle", "file", "line")

    def __init__(self, level, function, user_code, handle, file=None, line=0):
        self.level = level
        self.function = function
        self.user_code = user_code
        self.handle = handle
        self.file = file
        self.line = line


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

    def debugger_version(self):
        raise NotImplementedError

    def frames(self):
        raise NotImplementedError

    def variables(self, frame):
        raise NotImplementedError

    def globals(self):
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

    def read_bool(self, ref):
        raise NotImplementedError

    def read_enum(self, ref):
        raise NotImplementedError

    def enumerators(self, type_info):
        raise NotImplementedError

    def value_bytes(self, ref):
        raise NotImplementedError

    def read_bytes(self, address, length):
        raise NotImplementedError

    def eval(self, frame, expression):
        raise NotImplementedError
