import lldb

import snapshot


def dump_structs(out_path, root_var="head"):
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
