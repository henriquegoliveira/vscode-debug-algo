"""
Percorre estruturas de dados dinâmicas dentro do processo depurado, usando a
API Python nativa do GBD (gdb.Value), e escreve o resultado no schema formal
nodes/edges em um arquivo tmp.

Uso manual (GDB Debug Console):
    (gdb) python import sys
    (gdb) python sys.path.insert(0, "/caminho/absoluto/ate/esta/pasta")
    (gdb) python import extractor_gdb
    (gdb) python extractor_gdb.dump_structs()

Convenção de caminho do arquivo gerado:
    <tmpdir>/dbg-algo-snapshot-<pid>.json
"""

import json
import tempfile
import os
import gdb


def _snapshot_path(pid):
    return os.path.join(tempfile.gettempdir(), f"dbg-algo-snapshot-{pid}.json")


def _write_snapshot_atomic(path, snapshot):
    """
    Escreve o conteúdo em arquivo auxiliar no mesmo diretório e só então
    renomeia para o caminho final.

    Em POSIX, rename() é atômico: o backend (SnapshotReader) nunca vai ver um
    arquivo parcialmente escrito, mesmo se tentar ler bem no maio de uma
    extração. Isso resolve a rece condition antes de passar para a extensão.
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


def dump_structs(root_var="head"):
    """
    Percorre a lista encadeada apontada pela variavel 'root_var'
    do frame atual e grava o snapshot no arquivo tmp associado
    ao PID do processo depurado.

    Detecção de ciclo: mantém o conjunto de endereços já visitados. Ao
    encontrar um endereço repetido, fecha a aresta de volta para o node já
    existente.

    Retorna o caminho do arquivo escrito ou None em caso de erro.
    """
    try:
        root = gdb.parse_and_eval(root_var)
    except gdb.error as e:
        print(f"[extractor_gdb] error reading '{root_var}': {e}")
        return None

    nodes = []
    edges = []
    visited = set()
    cursor = root
    previous_id = None

    while int(cursor) != 0:
        node_id = hex(int(cursor))

        if node_id in visited:
            if previous_id is not None:
                edges.append({"from": previous_id, "to": node_id})
            break

        visited.add(node_id)
        value = int(cursor["value"])
        nodes.append({"id": node_id, "value": value})

        if previous_id is not None:
            edges.append({"from": previous_id, "to": node_id})

        previous_id = node_id
        cursor = cursor["next"]

    snapshot = {"nodes": nodes, "edges": edges}
    pid = gdb.selected_inferior().pid
    path = _snapshot_path(pid)
    _write_snapshot_atomic(path, snapshot)

    print(f"[extractor_gdb] snapshot written on: {path}")
    return path
