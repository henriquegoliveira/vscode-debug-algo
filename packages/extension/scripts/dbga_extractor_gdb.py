import gdb

import dbga_adapter
import dbga_snapshot
import dbga_traversal

CHAR_TYPE_NAMES = frozenset(["char", "signed char", "unsigned char", "wchar_t"])

ANONYMOUS_MARKER = "{...}"

MEMORY_ERRORS = (gdb.MemoryError, gdb.error, OverflowError, ValueError)


class GdbAdapter(dbga_adapter.Adapter):
    debugger_name = "GDB"

    def __init__(self):
        self._inferior = gdb.selected_inferior()
        self._enums = {}
        try:
            self._progspace = gdb.current_progspace().filename
        except Exception:
            self._progspace = None

    def debugger_version(self):
        version = _attribute(gdb, "VERSION")
        if version is not None:
            return str(version)
        try:
            return gdb.execute("show version", to_string=True).splitlines()[0].strip() or None
        except Exception:
            return None

    def frames(self):
        collected = []
        try:
            frame = gdb.newest_frame()
        except gdb.error:
            return collected

        while frame is not None and frame.is_valid():
            collected.append(
                dbga_adapter.FrameInfo(
                    frame.level(),
                    frame.name() or "??",
                    self._is_user_code(frame),
                    frame,
                )
            )
            try:
                frame = frame.older()
            except gdb.error:
                break

        return collected

    def _is_user_code(self, frame):
        if self._progspace is None:
            return False
        try:
            sal = frame.find_sal()
        except gdb.error:
            return False
        if sal is None or sal.symtab is None:
            return False
        objfile = sal.symtab.objfile
        return objfile is not None and objfile.filename == self._progspace

    def variables(self, frame):
        handle = frame.handle
        try:
            block = handle.block()
        except (gdb.error, RuntimeError):
            return []

        seen = set()
        collected = []

        while block is not None:
            for symbol in block:
                if not (symbol.is_variable or symbol.is_argument):
                    continue
                if symbol.name in seen:
                    continue
                seen.add(symbol.name)

                origin = dbga_adapter.PARAMETER if symbol.is_argument else dbga_adapter.LOCAL
                try:
                    value = symbol.value(handle)
                    valid = not value.is_optimized_out and not _attribute(value, "is_unavailable")
                except gdb.error:
                    value = None
                    valid = False
                if value is None:
                    continue

                collected.append(dbga_adapter.VarInfo(symbol.name, origin, value, valid))

            if block.function is not None:
                break
            block = block.superblock

        return collected

    def type_of(self, ref):
        return self._type_info(ref.type)

    def _type_info(self, gdb_type):
        stripped = gdb_type.strip_typedefs()

        size = _attribute(stripped, "sizeof")
        alignment = _attribute(stripped, "alignof")
        signed = _attribute(stripped, "is_signed")

        element_count = None
        if stripped.code == gdb.TYPE_CODE_ARRAY:
            try:
                low, high = stripped.range()
                element_count = max(0, high - low + 1)
            except (gdb.error, RuntimeError, TypeError):
                element_count = None

        return dbga_adapter.TypeInfo(
            self,
            self._category(stripped),
            dbga_adapter.canonical_type_name(_declared_name(gdb_type)),
            size,
            alignment,
            signed,
            element_count,
            stripped,
        )

    def _category(self, stripped):
        code = stripped.code

        if code == gdb.TYPE_CODE_PTR:
            return dbga_adapter.POINTER
        if code == gdb.TYPE_CODE_REF or code == getattr(gdb, "TYPE_CODE_RVALUE_REF", -1):
            return dbga_adapter.REFERENCE
        if code == gdb.TYPE_CODE_STRUCT:
            return dbga_adapter.RECORD
        if code == gdb.TYPE_CODE_UNION:
            return dbga_adapter.UNION
        if code == gdb.TYPE_CODE_ARRAY:
            return dbga_adapter.ARRAY
        if code == gdb.TYPE_CODE_CHAR:
            return dbga_adapter.CHAR
        if code == gdb.TYPE_CODE_INT:
            plain = dbga_adapter.canonical_type_name(_declared_name(stripped))
            return dbga_adapter.CHAR if plain in CHAR_TYPE_NAMES else dbga_adapter.INT
        if code == gdb.TYPE_CODE_FLT:
            return dbga_adapter.REAL
        if code == gdb.TYPE_CODE_BOOL:
            return dbga_adapter.BOOL
        if code == gdb.TYPE_CODE_ENUM:
            return dbga_adapter.ENUM
        if code == gdb.TYPE_CODE_FUNC:
            return dbga_adapter.FUNCTION
        if code == gdb.TYPE_CODE_VOID:
            return dbga_adapter.VOID

        return dbga_adapter.UNKNOWN

    def resolve_target(self, type_info):
        if type_info.category not in (
            dbga_adapter.POINTER,
            dbga_adapter.REFERENCE,
            dbga_adapter.ARRAY,
        ):
            return None
        try:
            return self._type_info(type_info.handle.target())
        except (gdb.error, RuntimeError):
            return None

    def resolve_fields(self, type_info):
        if type_info.category not in (dbga_adapter.RECORD, dbga_adapter.UNION):
            return []

        try:
            raw = type_info.handle.fields()
        except (gdb.error, TypeError):
            return []

        collected = []
        for entry in raw:
            offset_bits = _attribute(entry, "bitpos")
            if offset_bits is None:
                continue
            collected.append(
                dbga_adapter.FieldInfo(
                    entry,
                    entry.name,
                    offset_bits,
                    entry.bitsize,
                    bool(entry.is_base_class),
                    bool(entry.artificial),
                )
            )
        return collected

    def address_of(self, ref):
        address = ref.address
        if address is None:
            return None
        return int(address)

    def pointer_value(self, ref):
        return int(ref)

    def referenced(self, ref):
        try:
            return ref.referenced_value()
        except gdb.error:
            return None

    def dynamic_type_of(self, ref):
        try:
            dynamic = ref.dynamic_type
        except (gdb.error, RuntimeError):
            return None
        if dynamic is None or str(dynamic) == str(ref.type):
            return None
        return self._type_info(dynamic)

    def field(self, ref, field_descriptor):
        return ref[field_descriptor]

    def element(self, ref, index):
        return ref[index]

    def object_at(self, address, type_info):
        return gdb.Value(address).cast(type_info.handle.pointer()).dereference()

    def readable(self, address, size):
        try:
            self._inferior.read_memory(address, size)
        except MEMORY_ERRORS:
            return False
        return True

    def read_int(self, ref):
        return int(ref)

    def read_bool(self, ref):
        return bool(int(ref))

    def read_enum(self, ref):
        return int(ref)

    def enumerators(self, type_info):
        name = type_info.name
        if name and name in self._enums:
            return self._enums[name]

        collected = []
        try:
            for entry in type_info.handle.fields():
                if entry.name is None:
                    continue
                collected.append((entry.name.rpartition("::")[2], int(entry.enumval)))
        except (gdb.error, TypeError, AttributeError):
            collected = []

        if name:
            self._enums[name] = collected
        return collected

    def value_bytes(self, ref):
        raw = _attribute(ref, "bytes")
        if raw is not None:
            return bytes(raw)
        address = self.address_of(ref)
        size = _attribute(ref.type.strip_typedefs(), "sizeof")
        if address is None or not size:
            return None
        return self.read_bytes(address, size)

    def read_bytes(self, address, length):
        return self._inferior.read_memory(address, length).tobytes()

    def eval(self, frame, expression):
        try:
            frame.handle.select()
            return gdb.parse_and_eval(expression)
        except (gdb.error, ValueError):
            return None


def _declared_name(gdb_type):
    stripped = gdb_type.strip_typedefs()
    code = stripped.code

    if code == gdb.TYPE_CODE_PTR:
        target = stripped.target()
        if target.code != gdb.TYPE_CODE_FUNC:
            return _declared_name(target) + " *"
    elif code == gdb.TYPE_CODE_REF or code == getattr(gdb, "TYPE_CODE_RVALUE_REF", -1):
        return _declared_name(stripped.target()) + " &"
    elif code == gdb.TYPE_CODE_ARRAY:
        try:
            low, high = stripped.range()
            return "%s[%d]" % (_declared_name(stripped.target()), max(0, high - low + 1))
        except Exception:
            pass

    rendered = str(stripped)
    if ANONYMOUS_MARKER in rendered:
        return str(gdb_type)
    return rendered


def _attribute(source, name):
    try:
        return getattr(source, name)
    except Exception:
        return None


def dump_structs(out_path, options=None):
    try:
        adapter = GdbAdapter()
        snapshot = dbga_traversal.extract(adapter, dbga_traversal.Config.from_dict(options))
    except Exception as error:
        version = _attribute(gdb, "VERSION")
        snapshot = dbga_snapshot.minimal_snapshot(
            GdbAdapter.debugger_name, None if version is None else str(version), error
        )

    dbga_snapshot.write_atomic(out_path, snapshot)

    return out_path
