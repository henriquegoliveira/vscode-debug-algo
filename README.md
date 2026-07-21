# DbgAlgo - C/C++ Data Structure Visualizer

O **DbgAlgo** é um plug-in para o Visual Studio Code focado na visualização dinâmica de estruturas de dados e algoritmos em C/C++ durante sessões de depuração.

Diferente de visualizadores estáticos convencionais, este projeto delega a varredura complexa de ponteiros e memória diretamente para o motor do depurador (GDB/LLDB) utilizando sua API Python nativa. Os dados extraídos alimentam uma interface interativa baseada em grafos, permitindo que estudantes e desenvolvedores observem o comportamento do seu código em tempo real.

Este projeto é fruto de uma pesquisa de Iniciação Científica desenvolvida na Universidade Estadual de Mato Grosso do Sul (UEMS).

## Principais Recursos

- **Análise de Memória Profunda:** Utiliza scripts Python rodando dentro do contexto do GDB/LLDB para navegar autonomamente por encadeamentos de ponteiros e resolver ciclos de memória.
- **Visualização Dinâmica e Interativa:** Renderiza a topologia de dados como grafos interativos na tela usando a biblioteca `vis-network` (vis.js), substituindo a velha abordagem estática de arquivos DOT.
- **Performance de Baixa Latência:** Ignora o canal tradicional e lento da IDE (o IPC via `postMessage`) e despacha atualizações contínuas de memória através de uma conexão local dedicada.

## Arquitetura e Stack Tecnológico

A arquitetura adota um modelo de múltiplos módulos (Monorepo) estruturado com **Yarn Workspaces** (usando o linker `node-modules`, sem Plug'n'Play), focando em organização e escalabilidade.

### Backend (Extensão VS Code)

- **TypeScript & Node.js:** O núcleo orquestrador que escuta os eventos de pausa do Debug Adapter Protocol (DAP).
- **esbuild:** Utilizado como empacotador ultrarrápido para o código do backend, garantindo builds instantâneos da extensão.
- **Express.js:** Um servidor HTTP local embutido hospeda a interface React e contorna as rígidas políticas de segurança de conteúdo (CSP) do VS Code.
- **WebSockets & JSON-RPC 2.0:** Estabelece um túnel bidirecional persistente entre o backend e a Webview, garantindo a entrega do JSON estruturado dos grafos em tempo real, sem travar a thread principal da IDE.

### Frontend (Webview)

- **React & Webpack:** A interface gráfica roda como uma aplicação React empacotada pelo Webpack, servida pelo Express como se fosse um navegador tradicional.
- **vis-network:** Framework de visualização avançada encarregado de consumir o JSON estruturado e aplicar física e interatividade aos nós da estrutura de dados.

### Infraestrutura e Metodologia

- **UML:** Modelagem estruturada (Diagramas de Componentes, Classes e Sequência) para guiar o fluxo assíncrono entre C/C++, Python, Node.js e React.

## Como Rodar Localmente

### Pré-requisitos

- Node.js
- Gerenciador de pacotes Yarn (Corepack habilitado)
- GDB ou LLDB instalados na máquina/container
- Visual Studio Code

### Instalação

1. Clone o repositório:

   ```bash
   git clone <ainda privado>
   cd vscode-dbg-algo
   ```

2. Ative a versão correta do Yarn e instale as dependências:

   ```bash
   corepack enable
   yarn install
   ```

### Construção (Build) e Execução

O projeto é dividido em dois workspaces principais: `packages/extension` e `packages/webview`.

1. **Compile o Frontend (Webview):**

   ```bash
   yarn workspace dbga-webview build
   ```

2. **Inicie o Modo de Observação no Backend:**

   ```bash
   yarn workspace dbga-extension dev
   ```

3. **Inicie a Extensão:**
   - Abra o projeto no VS Code.
   - Pressione `F5` para iniciar o _Extension Development Host_.
   - Na nova janela que se abrir, inicie uma sessão de depuração de um programa C/C++ ou abra a paleta de comandos (`Ctrl + Shift + P`) e execute **DbgAlgo: Iniciar Visualizador**.
