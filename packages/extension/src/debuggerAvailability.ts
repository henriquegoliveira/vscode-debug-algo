import * as vscode from 'vscode';
import { DebugSessionManager } from './debugSessionManager';
import { DebuggerType } from './debuggerType';

const CPPTOOLS_EXTENSION_ID = 'ms-vscode.cpptools';
const CODELLDB_EXTENSION_ID = 'vadimcn.vscode-lldb';

const WINDOWS_LLDB_HINT_KEY = 'dbg-algo.windowsLldbHintShown';

const INSTALL_CPPTOOLS_ACTION = 'Instalar C/C++ (cpptools)';
const INSTALL_CODELLDB_ACTION = 'Instalar CodeLLDB';

const MISSING_EXTENSIONS_MESSAGE =
  'DbgAlgo precisa da extensão C/C++ (cpptools) ou CodeLLDB para depurar e ' +
  'extrair as estruturas de dados. Nenhuma das duas está instalada.';

const NO_ACTIVE_SESSION_MESSAGE =
  'DbgAlgo não encontrou nenhuma sessão de depuração ativa em C/C++ (cpptools ou CodeLLDB). ' +
  'Inicie uma sessão de debug para ver a visualização atualizar a cada pausa.';

const WINDOWS_LLDB_HINT =
  'No Windows o GDB é instalado à parte e nem todo build traz Python, que o DbgAlgo precisa ' +
  'para extrair as estruturas de dados. O CodeLLDB traz o próprio depurador e dispensa essa configuração.';

export function warnIfNoSupportedDebugSession(sessionManager: DebugSessionManager): void {
  const activeType = sessionManager.detectDebuggerType(vscode.debug.activeDebugSession);
  if (activeType !== undefined) {
    return;
  }

  const cpptoolsInstalled = isInstalled(CPPTOOLS_EXTENSION_ID);
  const codelldbInstalled = isInstalled(CODELLDB_EXTENSION_ID);

  if (!cpptoolsInstalled && !codelldbInstalled) {
    void vscode.window
      .showErrorMessage(
        MISSING_EXTENSIONS_MESSAGE,
        INSTALL_CPPTOOLS_ACTION,
        INSTALL_CODELLDB_ACTION,
      )
      .then((choice) => {
        if (choice === INSTALL_CPPTOOLS_ACTION) {
          openExtensionPage(CPPTOOLS_EXTENSION_ID);
        } else if (choice === INSTALL_CODELLDB_ACTION) {
          openExtensionPage(CODELLDB_EXTENSION_ID);
        }
      });
    return;
  }

  void vscode.window.showErrorMessage(NO_ACTIVE_SESSION_MESSAGE);
}

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
  if (isInstalled(CODELLDB_EXTENSION_ID)) {
    return;
  }

  await state.update(WINDOWS_LLDB_HINT_KEY, true);

  const choice = await vscode.window.showInformationMessage(
    WINDOWS_LLDB_HINT,
    INSTALL_CODELLDB_ACTION,
  );

  if (choice === INSTALL_CODELLDB_ACTION) {
    openExtensionPage(CODELLDB_EXTENSION_ID);
  }
}

function isInstalled(extensionId: string): boolean {
  return vscode.extensions.getExtension(extensionId) !== undefined;
}

function openExtensionPage(extensionId: string): void {
  void vscode.commands.executeCommand('workbench.extensions.search', extensionId);
}
