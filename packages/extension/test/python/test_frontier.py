import importlib
import itertools

import pytest

import dbga_adapter
import dbga_gates
from dbga_adapter import TypeInfo
from dbga_gates import Frontier


def type_info(category, name, size=16, alignment=8):
    return TypeInfo(None, category, name, size, alignment, False, None, None)


NODE = type_info(dbga_adapter.RECORD, "Node")
INT = type_info(dbga_adapter.INT, "int", 4, 4)
VOID = type_info(dbga_adapter.VOID, "void", 1, 1)

ADDRESS = 0x555555559010

OBSERVATIONS = [
    (NODE, 3, None),
    (INT, 1, None),
    (VOID, 0, ("void", None)),
    (NODE, 5, ("unreadable", None)),
    (NODE, 2, None),
]


def winner(observations):
    frontier = Frontier()
    for type_, depth, reason in observations:
        frontier.push(ADDRESS, type_, depth, reason)
    assert len(frontier) == 1
    return frontier.pop()


def test_an_expandable_aggregate_beats_every_other_observation():
    assert winner(OBSERVATIONS) == (ADDRESS, NODE, 2, None)


def test_the_result_does_not_depend_on_the_scan_order():
    results = {winner(order)[1:] for order in itertools.permutations(OBSERVATIONS)}

    assert len(results) == 1


@pytest.mark.parametrize(
    "weaker, stronger",
    [
        ((INT, 0, None), (NODE, 9, None)),
        ((VOID, 0, ("void", None)), (INT, 9, None)),
        ((NODE, 0, ("error", "invalidSize")), (NODE, 9, ("zeroPage", None))),
        ((NODE, 4, None), (NODE, 1, None)),
    ],
)
def test_rank_then_depth(weaker, stronger):
    assert winner([weaker, stronger])[1:] == stronger
    assert winner([stronger, weaker])[1:] == stronger


def test_each_address_is_queued_once_in_first_seen_order():
    frontier = Frontier()
    frontier.push(0x30, NODE, 1)
    frontier.push(0x10, NODE, 1)
    frontier.push(0x30, NODE, 0)

    assert [frontier.pop()[0], frontier.pop()[0]] == [0x30, 0x10]
    assert len(frontier) == 0


@pytest.mark.parametrize(
    "address, type_, expected",
    [
        (0, NODE, "null"),
        (0x8, NODE, "zeroPage"),
        (0x555555559014, NODE, "misaligned"),
        (0x555555559010, type_info(dbga_adapter.RECORD, "Big", 1 << 21), "invalidSize"),
        (0x555555559010, type_info(dbga_adapter.RECORD, "Empty", 0), "invalidSize"),
    ],
)
def test_gates_refuse_before_any_memory_read(address, type_, expected):
    assert dbga_gates.gate_reason(None, address, type_) == expected


def test_an_untyped_pointer_only_passes_the_address_gates():
    assert dbga_gates.gate_reason(None, 0x555555559013, None) is None


@pytest.mark.parametrize("platform, zero_page", [("linux", 0x1000), ("win32", 0x10000)])
def test_the_zero_page_follows_the_debugger_host(monkeypatch, platform, zero_page):
    monkeypatch.setattr("sys.platform", platform)
    try:
        reloaded = importlib.reload(dbga_gates)

        assert reloaded.ZERO_PAGE == zero_page
        assert reloaded.gate_reason(None, zero_page - 8, NODE) == "zeroPage"
    finally:
        monkeypatch.undo()
        importlib.reload(dbga_gates)
