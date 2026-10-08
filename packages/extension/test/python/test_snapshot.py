import json
import os

import pytest

import dbga_snapshot
from dbga_snapshot import SnapshotBuilder, int_value, minimal_snapshot, to_address, write_atomic
from dbga_traversal import Config


def test_addresses_are_lower_case_hex_of_64_bits():
    assert to_address(0x555555559010) == "0x555555559010"
    assert to_address(-1) == "0xffffffffffffffff"


def test_integers_beyond_double_precision_also_carry_hex():
    assert int_value(42, True) == {"t": "int", "v": 42, "signed": True}
    assert int_value(2**63, False)["hex"] == "0x8000000000000000"


def test_optional_fields_are_omitted_rather_than_null():
    builder = SnapshotBuilder("GDB", "17.2", Config())
    builder.opaque_node(0x10, "void")
    builder.edge(0x10, "next", None)

    snapshot = builder.build()

    assert "type" not in snapshot["nodes"][0]
    assert "type" not in snapshot["edges"][0]


def list_snapshot():
    builder = SnapshotBuilder("LLDB", "22.1.4", Config())
    builder.frame(0, "push", "/src/list.c", 12)
    builder.root("head", "push", 0, "parameter", "Node *", "pointer", 0x7FFE10, 0x10, 1, 0x10, "ok")
    for address, value, after in [(0x10, 1, 0x20), (0x20, 2, 0x30)]:
        fields = [{"name": "value", "type": "int", "value": int_value(value, True)}]
        builder.record_node(address, "Node", "struct", 16, fields, [], ["next"], ["value"])
        builder.edge(address, "next", after, "Node *")
    return builder.build()


def test_build_closes_dangling_edges_with_unexpanded_nodes():
    snapshot = list_snapshot()

    assert snapshot["nodes"][-1] == {"kind": "opaque", "id": "0x30", "reason": "notExpanded"}


def test_build_summarises_each_record_type():
    snapshot = list_snapshot()

    assert snapshot["meta"]["observedTypes"] == [
        {
            "type": "Node",
            "pointerFields": ["next"],
            "scalarFields": ["value"],
            "count": 2,
            "maxDegree": 1,
        }
    ]
    assert snapshot["meta"]["version"] == 2
    assert snapshot["meta"]["truncated"] is False


def test_a_second_node_at_the_same_address_is_an_error_not_a_duplicate():
    builder = SnapshotBuilder("GDB", "17.2", Config())
    builder.opaque_node(0x10, "void")
    builder.opaque_node(0x10, "unreadable")

    snapshot = builder.build()

    assert len(snapshot["nodes"]) == 1
    assert snapshot["meta"]["errors"] == [
        {"scope": "node", "reference": "0x10", "message": "addressCollision"}
    ]


def test_truncation_reasons_are_recorded_once():
    builder = SnapshotBuilder("GDB", "17.2", Config())
    builder.truncate("nodeLimit")
    builder.truncate("nodeLimit")

    meta = builder.build()["meta"]

    assert meta["truncated"] is True
    assert meta["truncationReasons"] == ["nodeLimit"]


def test_minimal_snapshot_reports_the_exception():
    snapshot = minimal_snapshot("GDB", None, ValueError("bad frame"))

    assert snapshot["meta"]["errors"] == [
        {"scope": "general", "reference": "ValueError", "message": "ValueError: bad frame"}
    ]
    assert snapshot["roots"] == snapshot["nodes"] == snapshot["edges"] == snapshot["frames"] == []


def test_write_atomic_replaces_the_file_and_leaves_no_temporary(tmp_path):
    target = tmp_path / "dbg-algo-snapshot-1234.json"
    target.write_text("old")

    write_atomic(str(target), list_snapshot())

    assert json.loads(target.read_text())["meta"]["debugger"] == "LLDB"
    assert os.listdir(tmp_path) == [target.name]


def test_write_atomic_refuses_nan_and_cleans_up(tmp_path):
    target = tmp_path / "dbg-algo-snapshot-1234.json"

    with pytest.raises(ValueError):
        write_atomic(str(target), {"v": float("nan")})

    assert os.listdir(tmp_path) == []


def test_write_atomic_retries_a_busy_target(tmp_path, monkeypatch):
    target = tmp_path / "dbg-algo-snapshot-1234.json"
    real_replace = os.replace
    calls = []

    def busy_once(source, destination):
        calls.append(destination)
        if len(calls) == 1:
            raise PermissionError("in use")
        real_replace(source, destination)

    monkeypatch.setattr(dbga_snapshot.os, "replace", busy_once)
    monkeypatch.setattr(dbga_snapshot, "REPLACE_BACKOFF_SECONDS", 0)

    write_atomic(str(target), list_snapshot())

    assert len(calls) == 2
    assert os.listdir(tmp_path) == [target.name]


@pytest.mark.parametrize(
    "options, nodes",
    [
        (None, 2000),
        ({"limits": {"maxNodes": 50}}, 50),
        ({"limits": {"maxNodes": 0}}, 2000),
        ({"limits": {"maxNodes": -3}}, 2000),
        ({"limits": {"maxNodes": True}}, 2000),
        ({"limits": {"maxNodes": "50"}}, 2000),
        ({"limits": {"maxNodes": 12.5}}, 2000),
    ],
)
def test_config_accepts_only_positive_integer_limits(options, nodes):
    assert Config.from_dict(options).max_nodes == nodes


def test_config_reads_filters_and_annotations():
    config = Config.from_dict({"rootFilter": ["head", 3], "dynamicArrays": ["v@n"]})

    assert config.root_filter == {"head", "3"}
    assert config.dynamic_arrays == ["v@n"]
    assert Config.from_dict({"rootFilter": []}).root_filter is None
