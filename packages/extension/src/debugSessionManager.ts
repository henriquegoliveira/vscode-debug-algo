import * as vscode from 'vscode';
import { DebuggerType } from './debuggerType';
import { ExtractorInvoker } from './extractorInvoker';

/**
 * Gerencia o ciclo de vida das sessões de depuração, identificando o tipo de
 * depurador ativo e acionando o `ExtractorInvoker` sempre que a execução pausa.
 *
 * - `vscode.debug.onDidChangeActiveDebugSession` dispara apenas na troca de
 *   sessões, não a cada pausa. Usado para manter o rastro da sessão atual.
 * - Para detectar pausas, o tráfego do Debug Adapter Protocol (DAP) é interceptado
 *   usando `registerDebugAdapterTrackerFactory` e escutando o evento `stopped`.
 */

export class DebugSessionManager implements vscode.Disposable {
  /**
   * Salvar a sessão de depuração ativa no momento.
   *
   * Na API do Vs Code, quando uma sessão de depuração ativa é alterada,
   * ela pode ser um objeto `vscode.DebugSession` ou `undefined`.
   *
   * @see https://code.visualstudio.com/api/references/vscode-api#debug.onDidChangeActiveDebugSession
   */
  private currentSession: vscode.DebugSession | undefined;

  /**
   * Conjunto (Set) de IDs das sessões onde o módulo Python já foi importado.
   * Utilizado para garantir que a injeção do módulo base ocorra apenas na
   * primeira pausa de cada sessão, evitando reimportação.
   */
  private readonly importedSessions = new Set<string>();

  /**
   * Coleção de inscrições de eventos e recursos que precisam ser liberados.
   *
   * Na API do VS Code, métodos de registro (como `vscode.debug.on*`) retornam
   * um objeto `vscode.Disposable`. A lista `disposables`armazena todos os
   * objetos para invocar o `dispose()` de cada um quando a extensão for
   * desativada ou esta classe for destruída.
   *
   * @see https://code.visualstudio.com/api/references/vscode-api#Disposable
   */
  private readonly disposables: vscode.Disposable[] = [];

  /**
   * Inicializa o gerenciador e registra os listeners na API do VS Code para
   * monitorar a troca, o encerramento e o tráfego DAP das sessões de depuração.
   *
   * @param invoker Instância responsável por disparar os comandos de extração.
   */
  constructor(private readonly invoker: ExtractorInvoker) {
    this.disposables.push(
      // Mantém 'currentSession' sincronizado quando o usuário troca de abas/sessões
      vscode.debug.onDidChangeActiveDebugSession((session) => {
        this.currentSession = session;
      }),

      // Limpa o rastro de importação e esvazia a sessão ativa se ela for encerrada
      vscode.debug.onDidTerminateDebugSession((session) => {
        this.importedSessions.delete(session.id);
        if (this.currentSession?.id === session.id) {
          this.currentSession = undefined;
        }
      }),

      // O '*' atua como um "catch-all", interceptando mensagens DAP de qualquer depurador.
      // O filtro real para ver se o depurador é suportado ocorre dentro do detectDebuggerType().
      vscode.debug.registerDebugAdapterTrackerFactory('*', {
        createDebugAdapterTracker: (session: vscode.DebugSession) => ({
          onDidSendMessage: (message: unknown) => this.handleDapMessage(session, message),
        }),
      }),
    );
  }

  /**
   * Analisa todas as mensagens trafegadas entre o VS Code e o depurador.
   * Funciona como um filtro: a execução só prossegue se a mensagem for uma pausa
   * válida e originada de um depurador suportado pela extensão.
   */
  private handleDapMessage(session: vscode.DebugSession, message: unknown): void {
    if (!isStoppedEvent(message)) {
      return;
    }

    const type = this.detectDebuggerType(session);
    if (type === undefined) {
      return;
    }

    void this.onSessionStopped(session, type);
  }

  /**
   * Acionado toda vez que uma sessão suportada entra em pausa.
   * Determina se é o momento de importar o módulo base (apenas na 1ª pausa)
   * e comanda a injeção do script de dump.
   */
  private async onSessionStopped(session: vscode.DebugSession, type: DebuggerType): Promise<void> {
    const firstPauseThisSession = !this.importedSessions.has(session.id);
    if (firstPauseThisSession) {
      this.importedSessions.add(session.id);
    }
    await this.invoker.invoke(session, type, { importModule: firstPauseThisSession });
  }

  /**
   * Mapeia a string nativa `session.type` do VS Code para o enum interno `DebuggerType`.
   * Retorna `undefined` para depuradores não suportados (ex: node, python) ou sessões nulas.
   */
  detectDebuggerType(
    session: vscode.DebugSession | undefined = this.currentSession,
  ): DebuggerType | undefined {
    switch (session?.type) {
      case 'cppdbg':
        return DebuggerType.GDB;
      case 'lldb':
        return DebuggerType.LLDB;
      default:
        return undefined;
    }
  }

  /**
   * Contrato da interface `vscode.Disposable`.
   * Desativa as escutas de eventos ativas na API do VS Code.
   */
  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}

/**
 * Função de validação (Type Guard) que inspeciona uma mensagem desconhecida (unknown)
 * e confirma se ela possui a assinatura de um evento DAP de parada (stopped).
 *
 * O evento `stopped` indica que a execução bateu em um breakpoint, exceção ou fim de passo (step).
 */
function isStoppedEvent(message: unknown): boolean {
  if (typeof message !== 'object' || message === null) {
    return false;
  }
  const candidate = message as { type?: unknown; event?: unknown };
  return candidate.type === 'event' && candidate.event === 'stopped';
}
