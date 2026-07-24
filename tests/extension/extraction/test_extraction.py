"""
Testes de extracao: valida que extractor_gdb.py e extractor_lldb.py
produzem snapshots corretos (schema valido + forma estrutural certa) contra
os targets, via GDB e LLDB.
"""

import pytest
import jsonschema

from tests.extension.extraction.conftest import EXTRACTORS, load_expected

TARGETS = [
    ("gdb", "linked_list_simple", "linked_list_simple.c"),
    ("gdb", "linked_list_cyclic", "linked_list_cyclic.c"),
    ("lldb", "linked_list_simple", "linked_list_simple.c"),
    ("lldb", "linked_list_cyclic", "linked_list_cyclic.c"),
]


@pytest.mark.parametrize(
    "debugger,binary_name,source_name",
    TARGETS,
    ids=[f"{d}-{b}" for d, b, _ in TARGETS],
)
def test_extraction_matches_schema(
    compiled_targets, schema, debugger, binary_name, source_name
):
    snapshot = EXTRACTORS[debugger](binary_name, source_name)
    jsonschema.validate(instance=snapshot, schema=schema)


@pytest.mark.parametrize(
    "debugger,binary_name,source_name",
    TARGETS,
    ids=[f"{d}-{b}" for d, b, _ in TARGETS],
)
def test_extraction_matches_expected_shape(
    compiled_targets, debugger, binary_name, source_name
):
    snapshot = EXTRACTORS[debugger](binary_name, source_name)
    expected = load_expected(binary_name)
    assert_matches_shape(snapshot, expected)


def assert_matches_shape(snapshot: dict, expected: dict) -> None:
    """
    expected = {
        "values": [10, 20, 30],       # valores na ordem de travessia, a partir da raiz
        "cycle_back_to_index": None,  # ou um indice de "values", se a lista fechar ciclo
    }
    """
    values = expected["values"]
    cycle_back_to_index = expected["cycle_back_to_index"]

    nodes = snapshot["nodes"]
    edges = snapshot["edges"]

    assert len(nodes) == len(
        values
    ), f"esperava {len(values)} nodes ({values}), veio {len(nodes)}: {[n['value'] for n in nodes]}"
    assert [
        n["value"] for n in nodes
    ] == values, "os valores nao vieram na ordem esperada de travessia"

    ids = [n["id"] for n in nodes]
    assert len(set(ids)) == len(ids), "ha ids duplicados em 'nodes'"

    expected_edge_count = (
        len(values) - 1 + (1 if cycle_back_to_index is not None else 0)
    )
    assert (
        len(edges) == expected_edge_count
    ), f"esperava {expected_edge_count} edges, veio {len(edges)}: {edges}"

    for i in range(len(values) - 1):
        assert edges[i] == {
            "from": ids[i],
            "to": ids[i + 1],
        }, f"edge {i} deveria ligar node {i} ({values[i]}) ao node {i + 1} ({values[i + 1]})"

    if cycle_back_to_index is not None:
        assert edges[-1] == {"from": ids[-1], "to": ids[cycle_back_to_index]}, (
            f"esperava que o ciclo fechasse do ultimo node de volta pro node "
            f"de indice {cycle_back_to_index} ({values[cycle_back_to_index]})"
        )
