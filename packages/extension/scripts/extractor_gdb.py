"""
Percorre estruturas de dados dinâmicas dentro do processo depurado, usando a
API Python nativa do GDB (gdb.Value), e escreve o resultado no schema formal
nodes/edges no caminho informado pelo chamador.

O caminho de saída é decidido pelo backend (ExtractorInvoker) e chega como
argumento, este script não conhece a convenção de nomes do arquivo.

Uso manual (GDB Debug Console):
    (gdb) python import sys
    (gdb) python sys.path.insert(0, "/caminho/absoluto/ate/esta/pasta")
    (gdb) python import extractor_gdb
    (gdb) python extractor_gdb.dump_structs("/tmp/snapshot.json")
"""

import gdb

import snapshot


def dump_structs(out_path, root_var="head"):
    """
    Percorre a lista encadeada apontada pela variável `root_var` do frame atual
    e grava o snapshot em `out_path`.

    Retorna o caminho do arquivo escrito ou None em caso de erro.
    """
    try:
        root = gdb.parse_and_eval(root_var)
    except gdb.error as e:
        print(f"[extractor_gdb] error reading '{root_var}': {e}")
        return None

    builder = snapshot.SnapshotBuilder()
    cursor = root

    while int(cursor) != 0:
        if not builder.visit(int(cursor), cursor["value"]):
            break
        cursor = cursor["next"]

    snapshot.write_atomic(out_path, builder.build())

    print(f"[extractor_gdb] snapshot written on: {out_path}")
    return out_path
