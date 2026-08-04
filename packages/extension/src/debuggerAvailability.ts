import * as vscode from 'vscode';
import { DebugSessionManager } from './debugSessionManager';

// Identificador oficial da extensão C/C++ da Microsoft no marketplace.
const CPPTOOLS_EXTENSION_ID = 'ms-vscode.cpptools';
// Identificador oficial da extensão CodeLLDB no marketplace.
const CODELLDB_EXTENSION_ID = 'vadimcn.vscode-lldb';

/**
 * Valida o ambiente atual do VS Code e orienta o usuário caso os requisitos
 * para a extração de dados não sejam atendidos.
 *
 * O fluxo de validação ocorre em três etapas:
 * 1. Verifica se já existe uma sessão de depuração C/C++ suportada rodando. Se sim, aborta.
 * 2. Caso não exista, inspeciona o registro do editor para checar se pelo menos
 *    um dos depuradores base (cpptools ou CodeLLDB) está instalado.
 * 3. Dependendo do que estiver faltando, exibe uma notificação explicativa.
 *
 * Se as extensões base estiverem ausentes, a notificação inclui botões de ação
 * que redirecionam o usuário direto para a aba de instalação no marketplace.
 *
 * @param sessionManager Instância do gerenciador para verificar a sessão ativa.
 *
 * @see https://code.visualstudio.com/api/references/vscode-api#extensions.getExtension
 * @see https://code.visualstudio.com/api/references/vscode-api#window.showErrorMessage
 */
export function warnIfNoSupportedDebugSession(sessionManager: DebugSessionManager): void {
  const activeType = sessionManager.detectDebuggerType(vscode.debug.activeDebugSession);
  if (activeType !== undefined) {
    return;
  }

  // Consulta o registro de extensões ativas/instaladas no VS Code
  const cpptoolsInstalled = vscode.extensions.getExtension(CPPTOOLS_EXTENSION_ID) !== undefined;
  const codelldbInstalled = vscode.extensions.getExtension(CODELLDB_EXTENSION_ID) !== undefined;

  if (!cpptoolsInstalled && !codelldbInstalled) {
    void vscode.window
      .showErrorMessage(
        'DbgAlgo precisa da extensão C/C++ (cpptools) ou CodeLLDB para depurar e extrair as estruturas de dados. Nenhuma das duas está instalada.',
        'Instalar C/C++ (cpptools)',
        'Instalar CodeLLDB',
      )
      .then((choice) => {
        // O comando interno 'workbench.extensions.search' abre a aba lateral
        // de extensões e preenche a barra de busca automaticamente.
        if (choice == 'Instalar C/C++ (cpptools)') {
          void vscode.commands.executeCommand('workbench.extensions.search', CPPTOOLS_EXTENSION_ID);
        } else if (choice === 'Instalar CodeLLDB') {
          void vscode.commands.executeCommand('workbench.extensions.search', CODELLDB_EXTENSION_ID);
        }
      });
    return;
  }

  // Se chegou aqui, a extensão base está instalada, mas o processo de debug não foi iniciado
  void vscode.window.showErrorMessage(
    'DbgAlgo não encontrou nenhuma sessão de depuração ativa em C/C++ (cpptools ou CodeLLDB). Inicie uma sessão de debug para ver a visualização atualizar a cada pausa.',
  );
}
