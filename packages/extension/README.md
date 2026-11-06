# DebugAlgo (Preview)

See your linked lists, trees and graphs in C and C++ while you debug. Every time the debugger stops,
DebugAlgo reads the program's structures and redraws what changed.

You can try it without installing anything in the [interactive demo](https://henriquegoliveira.github.io/vscode-debug-algo/): a red-black tree in C, pause by pause, in the same panel as the extension.

## What it does

- Draws lists (singly and doubly linked, circular, with or without a head node), trees and graphs
  with cycles from the program's variables. You change nothing in your code.
- Marks what changed since the previous pause: node created, pointer relinked, value changed.
- Keeps the last pauses. You can go back to them without resuming the program.
- Clicking a node shows its fields, values and address.
- Besides the graph, there is a recursion view, with one card per call on the stack, and a sorting
  view, which shows the array as a track.
- Opens the same screen in the browser, which helps when projecting it in a class.

## What you need

- VS Code 1.95 or newer.
- GCC or G++.
- A debugger with Python: GDB, used by Microsoft's C/C++ extension, or CodeLLDB, which already ships
  its own LLDB with Python.

## Installation

### Linux

1. Install the compiler and GDB:

   | Distribution    | Command                                |
   | --------------- | -------------------------------------- |
   | Debian / Ubuntu | `sudo apt install build-essential gdb` |
   | Fedora          | `sudo dnf install gcc gcc-c++ gdb`     |
   | Arch            | `sudo pacman -S gcc gdb`               |

   Avoid the `gdb-minimal` package, which comes without Python. To check, run
   `gdb -batch -ex "python print('ok')"`. If it prints `ok`, you are set.

2. In VS Code, install the
   [C/C++](https://marketplace.visualstudio.com/items?itemName=ms-vscode.cpptools) extension. If you
   prefer LLDB, install [CodeLLDB](https://marketplace.visualstudio.com/items?itemName=vadimcn.vscode-lldb)
   instead of it or alongside it.
3. Install DebugAlgo.

### Windows

On Windows the shortest path is CodeLLDB, which already comes with a debugger and Python. The
compiler comes from MSYS2.

1. Install [MSYS2](https://www.msys2.org/). In the "MSYS2 UCRT64" terminal, run:

   ```
   pacman -S --needed base-devel mingw-w64-ucrt-x86_64-toolchain
   ```

2. Add `C:\msys64\ucrt64\bin` to the Windows PATH.
3. In VS Code, install
   [CodeLLDB](https://marketplace.visualstudio.com/items?itemName=vadimcn.vscode-lldb) and
   DebugAlgo.

Want to use GDB? The GDB in the UCRT64 toolchain has Python and works with the C/C++ extension. Just
do not use the GDB from the MSYS environment (`/usr/bin/gdb`): it converts paths to the Linux format
and extraction fails.

### Project setup

Create a `.vscode/` folder in your project with the two files below. With them, F5 builds the open C
file and starts debugging.

`.vscode/tasks.json`

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "build",
      "type": "shell",
      "command": "gcc",
      "args": ["-g", "-O0", "${file}", "-o", "${fileDirname}/${fileBasenameNoExtension}"],
      "problemMatcher": ["$gcc"],
      "windows": {
        "command": "C:/msys64/ucrt64/bin/gcc.exe",
        "args": ["-g", "-O0", "${file}", "-o", "${fileDirname}/${fileBasenameNoExtension}.exe"]
      }
    }
  ]
}
```

`.vscode/launch.json`

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "GDB",
      "type": "cppdbg",
      "request": "launch",
      "program": "${fileDirname}/${fileBasenameNoExtension}",
      "cwd": "${fileDirname}",
      "MIMode": "gdb",
      "preLaunchTask": "build",
      "windows": {
        "program": "${fileDirname}/${fileBasenameNoExtension}.exe",
        "miDebuggerPath": "C:/msys64/ucrt64/bin/gdb.exe"
      }
    },
    {
      "name": "LLDB",
      "type": "lldb",
      "request": "launch",
      "program": "${fileDirname}/${fileBasenameNoExtension}",
      "cwd": "${fileDirname}",
      "preLaunchTask": "build",
      "windows": {
        "program": "${fileDirname}/${fileBasenameNoExtension}.exe"
      }
    }
  ]
}
```

For C++, replace `gcc` with `g++`. On Windows, also add `-static` to the `g++` arguments; without it,
the program cannot find the MSYS2 libraries and does not even start.

The `-O0` is not decoration. With optimization, the compiler keeps variables in registers and the
debugger cannot read them.

## How to use it

1. Set a breakpoint (F9) on a line where the structure already exists.
2. Start debugging (F5) and pick GDB or LLDB.
3. In the Command Palette (Ctrl+Shift+P), run **DebugAlgo: Open Visualizer**.

The panel opens next to the editor and follows every pause, whether from F10, F11 or the next
breakpoint.

## Arrays allocated with malloc

A pointer does not know the size of the block it points to. So `int *v = malloc(n * sizeof(int))`
shows up in the graph as a single element. To see the whole array, tell DebugAlgo where the size is.
There are two ways:

- click the node and fill in the "read pointer as array" section of the side panel;
- select the variable name in the editor and run **DebugAlgo: Annotate Dynamic Array (v@n)**.

The annotation has the form `pointer@size`, such as `v@n` or `v@10`. The size can be a number or the
name of the variable that holds it. If the same name appears in more than one function, put the
function in front: `insert:v@n`. Annotations are saved in the `debugAlgo.dynamicArrays` setting.

## When something goes wrong

| What you see                                       | What to do                                                                                          |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| DebugAlgo asks for the C/C++ extension or CodeLLDB | Install one of the two; the message itself has the buttons.                                         |
| The session's debugger has no Python               | Use CodeLLDB, or a GDB with Python (on Windows, the one from MSYS2 UCRT64).                         |
| Nothing was written to disk after the pause        | Check that GDB has Python (`gdb --configuration`) and that the system temporary folder is writable. |
| Variables show up as optimized out, or vanish      | Build with `-g -O0`.                                                                                |
| The panel does not change                          | It only updates when the program pauses, and only in `cppdbg` or `lldb` sessions.                   |
| Truncated graph warning                            | The structure went over the node limit. Raise `debugAlgo.limits.maxNodes`.                          |

## Settings

| Setting                         | Default | What it is for                                        |
| ------------------------------- | ------- | ----------------------------------------------------- |
| `debugAlgo.dynamicArrays`       | `[]`    | `pointer@size` annotations for arrays on the heap.    |
| `debugAlgo.rootFilter`          | `[]`    | When not empty, only these variables enter the graph. |
| `debugAlgo.limits.maxNodes`     | `2000`  | Maximum nodes read per pause.                         |
| `debugAlgo.limits.maxEdges`     | `6000`  | Maximum edges read per pause.                         |
| `debugAlgo.limits.maxCells`     | `64`    | Maximum elements read per array.                      |
| `debugAlgo.limits.historyDepth` | `20`    | How many pauses are kept to go back to.               |

The panel also writes `debugAlgo.view`, with the screen state per debugged file. There is no need to
edit that one by hand.

## Limitations

- Only C and C++, debugged through the C/C++ extension (`cppdbg`) or CodeLLDB (`lldb`). The Visual
  Studio debugger (`cppvsdbg`) and programs built with MSVC are left out, because there is no Python
  there for DebugAlgo to run in.
- Standard library containers (`std::vector`, `std::list` and the like) and smart pointers are not
  drawn.
- On Windows with CodeLLDB, a C++ class with inheritance shows the declared type of the pointer, not
  the real type of the object.
- In VS Code's Restricted Mode (untrusted folder), the extension is turned off, because it runs code
  inside the debugger.
- macOS has not been tested.

## Where it was tested

On every push, GitHub Actions runs the tests on Ubuntu 24.04 and on Windows (MSYS2 UCRT64), with GDB
and with the LLDB from CodeLLDB 1.12.3. This includes a real VS Code that pauses a program and checks
the graph that comes out of it. On Windows, some test programs give a different result from Linux;
those differences are recorded in the repository.

## License

GPL-3.0 or later. See the [LICENSE](LICENSE) file.
