# Security policy

## Supported versions

DebugAlgo is in preview. Only the latest version published on the VS Code Marketplace receives
fixes.

## Reporting a vulnerability

Do not open a public issue for a security problem. Report it privately through
[GitHub's private vulnerability reporting](https://github.com/henriquegoliveira/vscode-debug-algo/security/advisories/new),
or by email to goliveirahenrique.hgo@gmail.com.

Include the DebugAlgo version, your operating system and debugger, and the steps to reproduce the
problem. You should get a reply within a week. Once the problem is confirmed, a fix is released and
the advisory is published with credit to you, unless you prefer to stay anonymous.

## Scope

The extension runs a Python script inside GDB or LLDB to read the paused program, and serves the
panel over a local HTTP and WebSocket server so it can also open in the browser. Problems in these
parts are in scope, for example the local server accepting connections it should not, or the panel
running content read from the debugged program.

Problems in GDB, LLDB, CodeLLDB or Microsoft's C/C++ extension belong to those projects.
