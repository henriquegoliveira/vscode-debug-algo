import time

import dbga_adapter
import dbga_snapshot
import dbga_annotations
import dbga_gates
import dbga_nodes
import dbga_roots

class Config(object):
    def __init__(self):
        self.max_nodes = 2000
        self.max_edges = 6000
        self.max_depth = 64
        self.max_frames = 32
        self.max_vars_per_frame = 128
        self.max_globals = 128
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
            config.max_cells = _bounded_int(limits.get("maxCells"), config.max_cells)

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


def _frames_through_main(frames):
    trimmed = []
    for frame in frames:
        trimmed.append(frame)
        if frame.function == "main":
            break
    return trimmed


def _file_scope_globals(builder, adapter, config):
    try:
        found = list(adapter.globals())
    except Exception:
        return []
    found.sort(key=lambda pair: pair[0].name)
    if len(found) > config.max_globals:
        builder.truncate("globalLimit")
        found = found[: config.max_globals]
    return found


def extract(adapter, config):
    builder = dbga_snapshot.SnapshotBuilder(
        adapter.debugger_name, adapter.debugger_version(), config
    )
    frontier = dbga_gates.Frontier()
    deadline = time.monotonic() + config.time_budget_seconds
    frames = _frames_through_main(adapter.frames())
    annotations = dbga_annotations.resolve_annotations(builder, frontier, adapter, frames, config)

    for frame in frames:
        if frame.level >= config.max_frames:
            builder.truncate("frameLimit")
            break
        if not frame.user_code:
            builder.frame_skipped()
            continue

        builder.frame_scanned()
        builder.frame(frame.level, frame.function, frame.file, frame.line)

        try:
            variables = adapter.variables(frame)
        except Exception as error:
            builder.error("frame", frame.function, error)
            continue

        if len(variables) > config.max_vars_per_frame:
            builder.truncate("varLimit")
            variables = variables[: config.max_vars_per_frame]

        for var in variables:
            if config.root_filter is not None and var.name not in config.root_filter:
                continue
            try:
                dbga_roots.classify_root(builder, frontier, adapter, frame, var, config)
            except Exception as error:
                builder.error("root", var.name, error)

    for var, source in _file_scope_globals(builder, adapter, config):
        if config.root_filter is not None and var.name not in config.root_filter:
            continue
        shim = dbga_adapter.FrameInfo(-1, source, True, None, source, 0)
        try:
            dbga_roots.classify_root(builder, frontier, adapter, shim, var, config)
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


def visit(builder, frontier, adapter, address, type_info, depth, config, reason=None, annotations=None):
    if reason is not None:
        builder.opaque_node(address, reason[0], None if type_info is None else type_info.name, reason[1])
        return
    annotated = None if annotations is None else annotations.get(address)
    if annotated is not None:
        dbga_annotations.visit_annotated(builder, frontier, adapter, address, annotated[0], annotated[1], depth, config)
        return
    if type_info is not None and type_info.category in (dbga_adapter.RECORD, dbga_adapter.UNION):
        dbga_nodes.visit_record(builder, frontier, adapter, address, type_info, depth, config)
        return
    if type_info is not None and type_info.category == dbga_adapter.ARRAY:
        dbga_nodes.visit_array(builder, frontier, adapter, address, type_info, depth, config)
        return
    if type_info is not None and type_info.category in dbga_adapter.SCALAR_CATEGORIES:
        dbga_nodes.visit_scalar(builder, adapter, address, type_info)
        return
    builder.opaque_node(address, "notExpanded", None if type_info is None else type_info.name)
