import gdb

import snapshot


def dump_structs(out_path, root_var="head"):
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
