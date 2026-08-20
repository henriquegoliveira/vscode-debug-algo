import * as vscode from 'vscode';
import { DebugSessionManager } from './debugSessionManager';
import { DebuggerType } from './debuggerType';

const CPPTOOLS_EXTENSION_ID = 'ms-vscode.cpptools';
const CODELLDB_EXTENSION_ID = 'vadimcn.vscode-lldb';

const WINDOWS_LLDB_HINT_KEY = 'dbg-algo.windowsLldbHintShown';

const WINDOWS_LLDB_HINT = 'TODO:';
const WINDOWS_LLDB_HINT_ACTION = 'TODO:';

export async function suggestLldbOnWindows(
  state: vscode.Memento,
  type: DebuggerType,
): Promise<void> {
  if (process.platform !== 'win32' || type !== DebuggerType.GDB) {
    return;
  }
  if (state.get<boolean>(WINDOWS_LLDB_HINT_KEY) === true) {
    return;
  }
  if (vscode.extensions.getExtension(CODELLDB_EXTENSION_ID) !== undefined) {
    return;
  }

  await state.update(WINDOWS_LLDB_HINT_KEY, true);

  const choice = await vscode.window.showInformationMessage(
    WINDOWS_LLDB_HINT,
    WINDOWS_LLDB_HINT_ACTION,
  );

  if (choice === WINDOWS_LLDB_HINT_ACTION) {
    void vscode.commands.executeCommand('workbench.extensions.search', CODELLDB_EXTENSION_ID);
  }
}

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
