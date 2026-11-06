# Contributing

## Running from source

You need Node.js 22 or newer, with Corepack enabled.

```bash
corepack enable
yarn install
yarn workspace dbga-webview build
yarn workspace debug-algo build
```

The order matters. The webview build writes the interface into `packages/extension/media/`, and
that is where the panel reads it from. Without it, the extension activates, but the panel reports
that it could not find the interface.

Then open the repository folder in VS Code and press F5. A second window opens with the extension
loaded. In it, open the `tests/` folder: it already has debug configurations for GDB and for LLDB
that build and launch the open file.

## Tests

```bash
yarn test              # TypeScript unit tests (Vitest)
yarn test:py           # unit tests for the Python extractor (pytest)
yarn test:e2e          # builds the programs in tests/targets and runs the extractor under GDB and LLDB
yarn test:integration  # opens a real VS Code and pauses a program in CodeLLDB
```

`yarn test:py` needs the Python environment from [requirements-dev.txt](requirements-dev.txt).
`yarn test:integration` needs the programs built first (`make -C tests/targets`).

## Test report

With the Python environment from [requirements-dev.txt](requirements-dev.txt) active:

```bash
yarn test:report   # runs every test layer and writes reports/relatorio-testes.pdf
yarn bench         # measures the WebSocket transport and adds its page to the same PDF
```

`yarn test:report` accepts `--skip-integration`, `--skip-harness` and `--figures <dir>`, which also
writes each chart as a single-page PDF. If any layer fails, the report is still written, and the
command exits with a non-zero code.

## Packaging

```bash
yarn workspace debug-algo package
```

The result is `packages/extension/debug-algo-<version>.vsix`.
