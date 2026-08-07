"""
Percorre estruturas de dados dinâmicas dentro do processo depurado, usando a
API Python nativa do LLDB (lldb.SBValue), e escreve o resultado no schema formal
nodes/edges no caminho informado pelo chamador.

O caminho de saída é decidido pelo backend (ExtractorInvoker) e chega como
argumento, este script não conhece a convenção de nomes do arquivo.

Uso manual (LLDB Debug Console):
    (lldb) script import sys
    (lldb) script sys.path.insert(0, "/caminho/absoluto/ate/esta/pasta")
    (lldb) script import extractor_lldb
    (lldb) script extractor_lldb.dump_structs("/tmp/snapshot.json")
"""

import lldb

import snapshot


def dump_structs(out_path, root_var="head"):
    """
    Percorre a lista encadeada apontada pela variável `root_var` do frame
    selecionado e grava o snapshot em `out_path`.

    Retorna o caminho do arquivo escrito ou None em caso de erro.
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

    builder = snapshot.SnapshotBuilder()
    cursor = root

    while cursor.IsValid() and cursor.GetValueAsUnsigned() != 0:
        value = cursor.GetChildMemberWithName("value").GetValueAsSigned()
        if not builder.visit(cursor.GetValueAsUnsigned(), value):
            break
        cursor = cursor.GetChildMemberWithName("next")

    snapshot.write_atomic(out_path, builder.build())

    print(f"[extractor_lldb] snapshot written on: {out_path}")
    return out_path
