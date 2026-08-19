import json
import os
import tempfile


class SnapshotBuilder:
    def __init__(self):
        self._nodes = []
        self._edges = []
        self._visited = set()
        self._previous_id = None

    def visit(self, address, value):
        node_id = hex(address)

        if node_id in self._visited:
            self._link_from_previous(node_id)
            return False

        self._visited.add(node_id)
        self._nodes.append({"id": node_id, "value": int(value)})
        self._link_from_previous(node_id)
        self._previous_id = node_id
        return True

    def _link_from_previous(self, node_id):
        if self._previous_id is not None:
            self._edges.append({"from": self._previous_id, "to": node_id})

    def build(self):
        return {"nodes": self._nodes, "edges": self._edges}


def write_atomic(path, snapshot):
    directory = os.path.dirname(path)
    fd, tmp_path = tempfile.mkstemp(
        dir=directory, prefix=".dbg-algo-snapshot-", suffix=".tmp"
    )

    try:
        with os.fdopen(fd, "w") as f:
            json.dump(snapshot, f)
        os.replace(tmp_path, path)
    except Exception:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        raise
