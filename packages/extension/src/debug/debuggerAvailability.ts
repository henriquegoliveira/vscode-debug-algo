import * as vscode from 'vscode';
import { DebugSessionManager } from './debugSessionManager';
import { DebuggerType } from './debuggerType';

const CPPTOOLS_EXTENSION_ID = 'ms-vscode.cpptools';
const CODELLDB_EXTENSION_ID = 'vadimcn.vscode-lldb';

const WINDOWS_LLDB_HINT_KEY = 'debug-algo.windowsLldbHintShown';

const INSTALL_CPPTOOLS_ACTION = vscode.l10n.t('Install C/C++ (cpptools)');
const INSTALL_CODELLDB_ACTION = vscode.l10n.t('Install CodeLLDB');

const MISSING_EXTENSIONS_MESSAGE = vscode.l10n.t(
  'DebugAlgo needs the C/C++ extension (cpptools) or CodeLLDB to debug and extract data structures. Neither is installed.',
);

const NO_ACTIVE_SESSION_MESSAGE = vscode.l10n.t(
  'DebugAlgo found no active C/C++ debug session (cpptools or CodeLLDB). Start a debug session to see the visualization update at every pause.',
);

const WINDOWS_LLDB_HINT = vscode.l10n.t(
  'On Windows, GDB is installed separately and not every build includes the Python that DebugAlgo needs to extract data structures. CodeLLDB bundles its own debugger and needs no such setup.',
);

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
