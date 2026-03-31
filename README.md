# DbgAlgo (VS Code)

Um plug-in para o Visual Studio Code focado na visualização dinâmica de estruturas de dados e algoritmos em C/C++ durante sessões de depuração. Este projeto delega a varredura de ponteiros para o motor nativo dos depuradores (GDB/LLDB) e renderiza a topologia de memória em grafos interativos em tempo real.

## Arquitetura do Sistema

O projeto é estruturado como um monorepo gerenciado pelo **Yarn Workspaces**, dividido em três módulos principais:

1. **Backend (Extensão):** Desenvolvido em TypeScript sobre Node.js, gerencia o ciclo de vida da extensão e a comunicação via Debug Adapter Protocol (DAP). Hospeda um servidor Express local e gerencia a comunicação com a interface gráfica via WebSocket (JSON-RPC) para evitar gargalos de latência.
2. **Frontend (Webview):** Interface gráfica construída com React e a biblioteca `vis.js` para renderização contínua e interativa dos grafos. Os contratos de dados (interfaces TypeScript) são importados diretamente do diretório do Backend.
3. **Extractor (Mecanismo Nativo):** Scripts em Python executados nativamente dentro do GDB/LLDB para extração profunda de memória, resolução de ciclos e exportação de topologia em JSON.

## Pré-requisitos

Para garantir um ecossistema isolado e reprodutível, o ambiente de desenvolvimento e os testes do depurador são orquestrados em contêineres. Você precisará de:

- **Node.js**
- **Yarn**
- **Docker** e **Docker Compose**

> **Nota sobre Segurança e Depuração:** Certifique-se de que o Docker daemon está rodando corretamente e que o `docker-compose.yml` está configurado com a permissão `cap_add: [SYS_PTRACE]`. Isso é obrigatório no nível do kernel (Linux/Docker) para permitir que o GDB e o LLDB anexem, observem e pausem os processos C/C++ em execução dentro do contêiner.

## Instalação e Execução

**1. Clone o repositório e instale as dependências:**
Na raiz do projeto, o Yarn Workspaces cuidará de instalar e linkar as dependências do Backend e Frontend automaticamente:

```bash
git clone <url-do-seu-repositorio>
cd vscode-algo-visualizer
yarn install
```
