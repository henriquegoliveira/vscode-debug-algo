import lldb

import dbga_adapter
import dbga_snapshot
import dbga_traversal

CHAR_TYPE_NAMES = frozenset(["char", "signed char", "unsigned char"])

VERSION_PREFIX = "lldb version "

TYPE_CLASS_CATEGORIES = {
    lldb.eTypeClassPointer: dbga_adapter.POINTER,
    lldb.eTypeClassReference: dbga_adapter.REFERENCE,
    lldb.eTypeClassStruct: dbga_adapter.RECORD,
    lldb.eTypeClassClass: dbga_adapter.RECORD,
    lldb.eTypeClassUnion: dbga_adapter.UNION,
    lldb.eTypeClassArray: dbga_adapter.ARRAY,
    lldb.eTypeClassEnumeration: dbga_adapter.ENUM,
    lldb.eTypeClassFunction: dbga_adapter.FUNCTION,
    lldb.eTypeClassMemberPointer: dbga_adapter.POINTER,
}

WIDE_CHAR_BASIC_TYPES = frozenset(
    _basic
    for _basic in (
        getattr(lldb, _name, None)
        for _name in (
            "eBasicTypeChar8",
            "eBasicTypeChar16",
            "eBasicTypeChar32",
            "eBasicTypeWChar",
            "eBasicTypeSignedWChar",
            "eBasicTypeUnsignedWChar",
        )
    )
    if _basic is not None
)

REAL_BASIC_TYPES = frozenset(
    _basic
    for _basic in (
        getattr(lldb, _name, None)
        for _name in (
            "eBasicTypeHalf",
            "eBasicTypeFloat",
            "eBasicTypeDouble",
            "eBasicTypeLongDouble",
            "eBasicTypeFloatComplex",
            "eBasicTypeDoubleComplex",
            "eBasicTypeLongDoubleComplex",
        )
    )
    if _basic is not None
)

RECORD_TYPE_CLASSES = (
    lldb.eTypeClassStruct,
    lldb.eTypeClassClass,
    lldb.eTypeClassUnion,
)

SIGNED_CATEGORIES = (
    dbga_adapter.INT,
    dbga_adapter.CHAR,
    dbga_adapter.ENUM,
    dbga_adapter.BOOL,
)


class LldbAdapter(dbga_adapter.Adapter):
    debugger_name = "LLDB"

    def __init__(self):
        self._debugger = lldb.debugger
        self._target = self._debugger.GetSelectedTarget()
        self._process = self._target.GetProcess()
        self._executable = None
        self._user_cu_names = set()
        self._records = {}
        self._enums = {}

        executable = self._target.GetExecutable()
        if executable.IsValid():
            self._executable = executable.GetFilename()

    def debugger_version(self):
        try:
            raw = self._debugger.GetVersionString()
        except Exception:
            return None
        if not raw:
            return None

        first = str(raw).splitlines()[0].strip()
        if first.lower().startswith(VERSION_PREFIX):
            first = first[len(VERSION_PREFIX) :].strip()
        return first or None

    def frames(self):
        collected = []
        self._user_cu_names = set()

        thread = self._process.GetSelectedThread()
        if not thread.IsValid():
            thread = self._process.GetThreadAtIndex(0)
        if not thread.IsValid():
            return collected

        for level in range(thread.GetNumFrames()):
            frame = thread.GetFrameAtIndex(level)
            if not frame.IsValid():
                break
            user = self._is_user_code(frame)
            file_name, line = _frame_location(frame)
            if user and file_name is not None:
                self._user_cu_names.add(file_name)
            collected.append(
                dbga_adapter.FrameInfo(
                    level,
                    _function_name(frame),
                    user,
                    frame,
                    file_name,
                    line,
                )
            )

        return collected

    def _is_user_code(self, frame):
        if self._executable is None:
            return False
        if not frame.GetLineEntry().IsValid():
            return False
        return frame.GetModule().GetFileSpec().GetFilename() == self._executable

    def globals(self):
        cu_names = self._user_cu_names
        if not cu_names:
            return []

        try:
            found = self._target.FindGlobalVariables(".*", 1 << 20, lldb.eMatchTypeRegex)
        except Exception:
            return []

        seen = set()
        collected = []
        for value in found:
            name = value.GetName()
            if not name:
                continue
            if name.startswith("::"):
                name = name[2:]
            if name in seen:
                continue
            source = _declaration_file(value)
            if source is None or source not in cu_names:
                continue
            if value.GetLoadAddress() == lldb.LLDB_INVALID_ADDRESS:
                continue
            if _is_const_scalar(value.GetType()):
                continue
            seen.add(name)
            valid = bool(value.IsValid()) and bool(value.GetError().Success())
            collected.append(
                (dbga_adapter.VarInfo(name, dbga_adapter.GLOBAL, value, valid), source)
            )

        return collected

    def variables(self, frame):
        handle = frame.handle

        try:
            arguments = handle.GetVariables(True, False, False, True)
        except Exception:
            return []

        argument_names = set()
        for value in arguments:
            argument_names.add(value.GetName())

        seen = set()
        collected = []

        for value in _block_values(handle):
            name = value.GetName()
            if name is None or name in seen:
                continue
            seen.add(name)

            origin = (
                dbga_adapter.PARAMETER if name in argument_names else dbga_adapter.LOCAL
            )
            valid = bool(value.IsValid()) and bool(value.GetError().Success())
            collected.append(dbga_adapter.VarInfo(name, origin, value, valid))

        return collected

    def type_of(self, ref):
        return self._type_info(ref.GetType())

    def _type_info(self, sb_type):
        canonical = self._authoritative(sb_type.GetCanonicalType())
        category = self._category(canonical)

        size = canonical.GetByteSize()
        alignment = _attribute(canonical, "GetByteAlign")

        signed = None
        if category in SIGNED_CATEGORIES:
            signed = bool(canonical.GetTypeFlags() & lldb.eTypeIsSigned)

        element_count = None
        if category == dbga_adapter.ARRAY:
            element_count = _array_length(canonical)

        return dbga_adapter.TypeInfo(
            self,
            category,
            dbga_adapter.canonical_type_name(canonical.GetName()),
            size or None,
            alignment or None,
            signed,
            element_count,
            canonical,
        )

    def _authoritative(self, canonical):
        if canonical.GetTypeClass() not in RECORD_TYPE_CLASSES:
            return canonical

        name = canonical.GetName()
        if not name:
            return canonical

        cached = self._records.get(name)
        if cached is None:
            found = self._target.FindFirstType(name)
            cached = found if found.IsValid() and found.GetName() == name else canonical
            self._records[name] = cached

        return cached

    def _category(self, canonical):
        type_class = canonical.GetTypeClass()

        mapped = TYPE_CLASS_CATEGORIES.get(type_class)
        if mapped is not None:
            return mapped

        if type_class != lldb.eTypeClassBuiltin:
            return dbga_adapter.UNKNOWN

        basic = canonical.GetBasicType()
        if basic == lldb.eBasicTypeVoid:
            return dbga_adapter.VOID
        if basic == lldb.eBasicTypeBool:
            return dbga_adapter.BOOL
        if basic in WIDE_CHAR_BASIC_TYPES:
            return dbga_adapter.CHAR
        if basic in REAL_BASIC_TYPES:
            return dbga_adapter.REAL

        plain = dbga_adapter.canonical_type_name(canonical.GetName())
        if plain in CHAR_TYPE_NAMES:
            return dbga_adapter.CHAR
        return dbga_adapter.INT

    def resolve_target(self, type_info):
        handle = type_info.handle

        try:
            if type_info.category == dbga_adapter.POINTER:
                return self._type_info(handle.GetPointeeType())
            if type_info.category == dbga_adapter.REFERENCE:
                return self._type_info(handle.GetDereferencedType())
            if type_info.category == dbga_adapter.ARRAY:
                return self._type_info(handle.GetArrayElementType())
        except Exception:
            return None

        return None

    def resolve_fields(self, type_info):
        if type_info.category not in (dbga_adapter.RECORD, dbga_adapter.UNION):
            return []

        handle = type_info.handle
        collected = []

        try:
            base_count = handle.GetNumberOfDirectBaseClasses()
        except Exception:
            base_count = 0

        for index in range(base_count):
            base = handle.GetDirectBaseClassAtIndex(index)
            if not base.IsValid():
                continue
            collected.append(_field_info(base, True, index))

        try:
            field_count = handle.GetNumberOfFields()
        except Exception:
            field_count = 0

        for index in range(field_count):
            member = handle.GetFieldAtIndex(index)
            if not member.IsValid():
                continue
            collected.append(_field_info(member, False, base_count + index))

        return collected

    def address_of(self, ref):
        address = ref.GetLoadAddress()
        if address == lldb.LLDB_INVALID_ADDRESS:
            return None
        return int(address)

    def pointer_value(self, ref):
        return int(ref.GetValueAsUnsigned())

    def referenced(self, ref):
        referent = ref.Dereference()
        if not referent.IsValid():
            return None
        return referent

    def dynamic_type_of(self, ref):
        try:
            dynamic = ref.GetDynamicValue(lldb.eDynamicCanRunTarget)
        except Exception:
            return None
        if not dynamic.IsValid():
            return None

        resolved = dynamic.GetType()
        if not resolved.IsValid():
            return None
        if resolved.GetName() == ref.GetType().GetName():
            return None

        return self._type_info(resolved)

    def field(self, ref, field_descriptor):
        return ref.GetChildAtIndex(field_descriptor, lldb.eNoDynamicValues, True)

    def element(self, ref, index):
        return ref.GetChildAtIndex(index, lldb.eNoDynamicValues, True)

    def object_at(self, address, type_info):
        return self._target.CreateValueFromAddress(
            "dbga", lldb.SBAddress(address, self._target), type_info.handle
        )

    def readable(self, address, size):
        error = lldb.SBError()
        try:
            self._process.ReadMemory(int(address), int(size), error)
        except Exception:
            return False
        return bool(error.Success())

    def read_int(self, ref):
        canonical = ref.GetType().GetCanonicalType()
        if canonical.GetTypeFlags() & lldb.eTypeIsSigned:
            return int(ref.GetValueAsSigned())
        return int(ref.GetValueAsUnsigned())

    def read_bool(self, ref):
        return bool(ref.GetValueAsUnsigned())

    def read_enum(self, ref):
        return self.read_int(ref)

    def enumerators(self, type_info):
        name = type_info.name
        if name and name in self._enums:
            return self._enums[name]

        collected = []
        handle = type_info.handle
        try:
            signed = bool(handle.GetTypeFlags() & lldb.eTypeIsSigned)
            members = handle.GetEnumMembers()
            for index in range(members.GetSize()):
                member = members.GetTypeEnumMemberAtIndex(index)
                value = member.GetValueAsSigned() if signed else member.GetValueAsUnsigned()
                collected.append((member.GetName(), int(value)))
        except Exception:
            collected = []

        if name:
            self._enums[name] = collected
        return collected

    def value_bytes(self, ref):
        data = ref.GetData()
        if not data.IsValid():
            return None
        return bytes(bytearray(data.uint8))

    def read_bytes(self, address, length):
        error = lldb.SBError()
        raw = self._process.ReadMemory(int(address), int(length), error)
        if not error.Success():
            raise ValueError(error.GetCString() or "leitura de memoria falhou")
        return bytes(raw)

    def eval(self, frame, expression):
        try:
            value = frame.handle.EvaluateExpression(expression)
        except Exception:
            return None
        if not value.IsValid() or not value.GetError().Success():
            return None
        return value


def _function_name(frame):
    raw = frame.GetFunctionName()
    if not raw:
        return "??"

    name = str(raw)
    cut = name.find("(")
    if cut >= 0:
        name = name[:cut]
    name = name.strip()
    while name.startswith("::"):
        name = name[2:]

    return name or "??"


_SCALAR_TYPE_FLAG = getattr(lldb, "eTypeIsScalar", 0)


def _is_const_scalar(sb_type):
    canonical = sb_type.GetCanonicalType()
    if _SCALAR_TYPE_FLAG:
        is_scalar = bool(canonical.GetTypeFlags() & _SCALAR_TYPE_FLAG)
    else:
        is_scalar = canonical.GetTypeClass() in (
            lldb.eTypeClassBuiltin,
            lldb.eTypeClassEnumeration,
        )
    if not is_scalar:
        return False

    name = canonical.GetName() or ""
    return "const" in name.replace("*", " ").replace("&", " ").split()


def _frame_location(frame):
    entry = frame.GetLineEntry()
    if not entry.IsValid():
        return None, 0
    spec = entry.GetFileSpec()
    name = spec.GetFilename() if spec.IsValid() else None
    return name, int(entry.GetLine() or 0)


def _declaration_file(value):
    declaration = value.GetDeclaration()
    if not declaration.IsValid():
        return None
    spec = declaration.GetFileSpec()
    if not spec.IsValid():
        return None
    return spec.GetFilename()


def _block_values(frame_handle):
    collected = []

    block = frame_handle.GetBlock()
    while block.IsValid():
        try:
            found = block.GetVariables(frame_handle, True, True, True, lldb.eNoDynamicValues)
        except Exception:
            break
        for value in found:
            collected.append(value)
        block = block.GetParent()

    return collected


def _attribute(source, name):
    try:
        accessor = getattr(source, name)
    except Exception:
        return None
    try:
        return accessor()
    except Exception:
        return None


def _array_length(canonical):
    try:
        element = canonical.GetArrayElementType()
        total = canonical.GetByteSize()
        unit = element.GetByteSize()
    except Exception:
        return None
    if not unit:
        return None
    return max(0, int(total // unit))


def _field_info(member, is_base, child_index):
    offset_bits = member.GetOffsetInBits()
    bitsize = 0
    if not is_base and member.IsBitfield():
        bitsize = member.GetBitfieldSizeInBits()

    return dbga_adapter.FieldInfo(
        child_index,
        member.GetName(),
        int(offset_bits),
        bitsize,
        is_base,
        False,
    )


def dump_structs(out_path, options=None):
    try:
        adapter = LldbAdapter()
        snapshot = dbga_traversal.extract(
            adapter, dbga_traversal.Config.from_dict(options)
        )
    except Exception as error:
        snapshot = dbga_snapshot.minimal_snapshot(
            LldbAdapter.debugger_name, _fallback_version(), error
        )

    dbga_snapshot.write_atomic(out_path, snapshot)

    return out_path


def _fallback_version():
    try:
        raw = lldb.debugger.GetVersionString()
    except Exception:
        return None
    if not raw:
        return None
    first = str(raw).splitlines()[0].strip()
    if first.lower().startswith(VERSION_PREFIX):
        first = first[len(VERSION_PREFIX) :].strip()
    return first or None
