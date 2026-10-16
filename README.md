# vscode-dbg-algo

## Test report

With the Python environment from [requirements-dev.txt](requirements-dev.txt) active:

```bash
yarn test:report   # runs every test layer and writes reports/relatorio-testes.pdf
yarn bench         # measures the WebSocket transport and adds its page to the same PDF
```

`yarn test:report` accepts `--skip-integration`, `--skip-harness` and `--figures <dir>` (each chart
also as a single-page PDF). It exits with a non-zero code when any layer fails, after drawing the
report.
