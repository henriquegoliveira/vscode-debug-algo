import collections
import sys

import dbga_adapter

WINDOWS = sys.platform.startswith(("win32", "cygwin", "msys"))

ZERO_PAGE = 0x10000 if WINDOWS else 0x1000
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


REFINABLE_CATEGORIES = (
    dbga_adapter.POINTER,
    dbga_adapter.REFERENCE,
    dbga_adapter.RECORD,
    dbga_adapter.UNION,
)


def refined_type(adapter, ref, type_info):
    if type_info is None or type_info.category not in REFINABLE_CATEGORIES:
        return type_info
    try:
        dynamic = adapter.dynamic_type_of(ref)
    except Exception:
        return type_info
    return type_info if dynamic is None else dynamic


def gate_reason(adapter, address, type_info):
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


def push_gate_failure(frontier, address, gate, type_info, depth):
    frontier.push(address, type_info, depth, GATE_NODE_REASON.get(gate, ("error", gate)))


def follow_pointer(builder, frontier, adapter, address, pointee_type, depth, config):
    if address == 0:
        return None, "null"
    if pointee_type is not None and pointee_type.category == dbga_adapter.CHAR:
        return None, "notFollowed"

    if pointee_type is not None and pointee_type.category == dbga_adapter.VOID:
        return terminal_node(frontier, adapter, address, pointee_type, "void", depth)
    if pointee_type is not None and pointee_type.category == dbga_adapter.FUNCTION:
        return terminal_node(frontier, adapter, address, pointee_type, "functionPointer", depth)

    return adopt(builder, frontier, adapter, address, pointee_type, depth, config)


def terminal_node(frontier, adapter, address, type_info, reason, depth):
    gate = gate_reason(adapter, address, None)
    if gate is not None:
        push_gate_failure(frontier, address, gate, type_info, depth)
        return address, "unreadable"
    frontier.push(address, type_info, depth, (reason, None))
    return address, "ok"


def adopt(builder, frontier, adapter, address, type_info, depth, config):
    if address is None:
        return None, "unreadable"

    gate = gate_reason(adapter, address, type_info)
    if gate is not None:
        push_gate_failure(frontier, address, gate, type_info, depth)
        return address, "unreadable"

    frontier.push(address, type_info, depth)
    return address, "ok"
