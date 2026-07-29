/**
 * Abstrai os tipos de depuradores C/C++ suportados pela extensão.
 *
 * Este enum mapeia as strings literais fornecidas pela propriedade `type`
 * da `vscode.DebugSession` para identificadores padronizados, facilitando
 * o roteamento de comandos específicos para a sintaxe de cada depurador.
 *
 * @see https://code.visualstudio.com/api/references/vscode-api#DebugSession.type
 */
export enum DebuggerType {
  /**
   * Representa o depurador GDB.
   * Corresponde ao `session.type === 'cppdbg'`, normalmente fornecido
   * pela extensão oficial C/C++ da Microsoft (cpptools).
   */
  GDB = 'GDB',

  /**
   * Representa o depurador LLDB.
   * Corresponde ao `session.type === 'lldb'`, normalmente fornecido
   * pela extensão CodeLLDB.
   */
  LLDB = 'LLDB',
}
