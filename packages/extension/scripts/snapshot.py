"""
Construção e escrita do snapshot, compartilhado entre os extratores de GDB e LLDB.

Este módulo concentra tudo que não depende da API do depurador: a montagem dos
dicts, o rastreio de ciclo e a escrita atômica em disco.
Cada extrator fica responsável apenas por navegar os ponteiros com a API nativa
do seu depurador (`gdb.Value` ou `lldb.SBValue`) e alimentar o `SnapshotBuilder`.
"""

import json
import os
import tempfile


class SnapshotBuilder:
    """
    Acumula nodes e edges durante a travessia, detectando ciclos.

    A regra de ciclo é a mesma nos dois extratores: mantém o conjunto de
    endereços já visitados e, ao reencontrar um endereço, fecha a aresta de
    volta para o node existente e para a travessia -- sem duplicar node e sem
    entrar em loop infinito.
    """

    def __init__(self):
        self._nodes = []
        self._edges = []
        self._visited = set()
        self._previous_id = None

    def visit(self, address, value):
        """
        Registra o node encontrado em `address` com o escalar `value` e liga-o
        ao node anterior da travessia.

        Retorna False quando `address` já havia sido visitado, ou seja, quando
        a estrutura é cíclica. A aresta de volta já foi registrada nesse caso, e
        o chamador deve interromper a travessia.
        """
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
        """Devolve o snapshot no formato do schema."""
        return {"nodes": self._nodes, "edges": self._edges}


def write_atomic(path, snapshot):
    """
    Escreve o snapshot em arquivo auxiliar no mesmo diretório e só então
    renomeia para o caminho final.

    Em POSIX, rename() é atômico: o backend (SnapshotReader) nunca vai ver um
    arquivo parcialmente escrito, mesmo se tentar ler bem no meio de uma
    extração. Isso resolve a race condition antes de passar para a extensão.
    """
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
