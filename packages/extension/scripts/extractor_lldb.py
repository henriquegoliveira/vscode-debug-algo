"""
Percorre estruturas de dados dinâmicas dentro do processo depurado, usando a
API Python nativa do LLDB (lldb.SBValue), e escreve o resultado no schema formal
nodes/edges em um arquivo tmp.

Uso manual (LLDB Debug Console):
    (lldb) script import sys
    (lldb) script sys.path.insert(0, "/caminho/absoluto/ate/esta/pasta")
    (lldb) script import extractor_lldb
    (lldb) script extractor_lldb.dump_structs()

Convenção de caminho do arquivo gerado:
    <tmpdir>/dbg-algo-snapshot-<pid>.json
"""

import json
import tempfile
import os
import lldb


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
    Percorre a lista encadeada apontada pela variável `root_var` do frame
    selecionado e grava o snapshot no arquivo temporário associado ao PID
    do processo depurado.

    Mesma regra de ciclo do extractor_gdb.py: ao encontrar um endereço já
    visitado, fecha a aresta de volta e para -- sem duplicar node, sem loop
    infinito.

    Retorna o caminho do arquivo escrito (ou None em caso de erro).
    """

    target = lldb.debugger.GetSelectedTarget()
    if target is None:
        print("[extractor_lldb] no target selected")
        return None

    process = target.GetProcess()
    thread = process.GetSelectedThread()
    frame = thread.GetSelectedFrame()

    root = frame.FindVariable(root_var)
    if not root.IsValid():
        print(f"[extractor_lldb] error reading '{root_var}'")
        return None

    nodes = []
    edges = []
    visited = set()
    cursor = root
    previous_id = None

    while cursor.IsValid() and cursor.GetValueAsUnsigned() != 0:
        address = cursor.GetValueAsUnsigned()
        node_id = hex(address)

        if node_id in visited:
            if previous_id is not None:
                edges.append({"from": previous_id, "to": node_id})
            break

        visited.add(node_id)
        value_member = cursor.GetChildMemberWithName("value")
        value = value_member.GetValueAsSigned()
        nodes.append({"id": node_id, "value": value})

        if previous_id is not None:
            edges.append({"from": previous_id, "to": node_id})

        previous_id = node_id
        cursor = cursor.GetChildMemberWithName("next")

    snapshot = {"nodes": nodes, "edges": edges}

    pid = process.GetProcessID()
    path = _snapshot_path(pid)
    _write_snapshot_atomic(path, snapshot)

    print(f"[extractor_lldb] snapshot written on: {path}")
    return path
