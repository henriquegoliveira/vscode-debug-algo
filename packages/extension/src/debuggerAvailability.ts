import * as vscode from 'vscode';
import { DebugSessionManager } from './debugSessionManager';

const CPPTOOLS_EXTENSION_ID = 'ms-vscode.cpptools';
const CODELLDB_EXTENSION_ID = 'vadimcn.vscode-lldb';

export function warnIfNoSupportedDebugSession(sessionManager: DebugSessionManager): void {
  const activeType = sessionManager.detectDebuggerType(vscode.debug.activeDebugSession);
  if (activeType !== undefined) {
    return;
  }

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
        if (choice == 'Instalar C/C++ (cpptools)') {
          void vscode.commands.executeCommand('workbench.extensions.search', CPPTOOLS_EXTENSION_ID);
        } else if (choice === 'Instalar CodeLLDB') {
          void vscode.commands.executeCommand('workbench.extensions.search', CODELLDB_EXTENSION_ID);
        }
      });
    return;
  }

  void vscode.window.showErrorMessage(
    'DbgAlgo não encontrou nenhuma sessão de depuração ativa em C/C++ (cpptools ou CodeLLDB). Inicie uma sessão de debug para ver a visualização atualizar a cada pausa.',
  );
}
