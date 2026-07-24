"""
Uso: Gera a estrurua esperada do proprio binario:

    python3 tests/extension/extraction/gen_expected_file.py \\
        linked_list_simple linked_list_simple.c gdb
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from conftest import EXTRACTORS  # noqa: E402


def main() -> None:
    if len(sys.argv) != 4:
        print(__doc__)
        sys.exit(1)

    binary_name, source_name, debugger = sys.argv[1:4]
    snapshot = EXTRACTORS[debugger](binary_name, source_name)

    nodes = snapshot["nodes"]
    edges = snapshot["edges"]
    ids = [n["id"] for n in nodes]

    cycle_back_to_index = None
    if len(edges) == len(nodes):
        last_edge = edges[-1]
        cycle_back_to_index = ids.index(last_edge["to"])

    expected = {
        "values": [n["value"] for n in nodes],
        "cycle_back_to_index": cycle_back_to_index,
    }
    print(json.dumps(expected, indent=2))


if __name__ == "__main__":
    main()
