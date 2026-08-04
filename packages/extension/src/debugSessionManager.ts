import * as vscode from 'vscode';
import { DebuggerType } from './debuggerType';
import { ExtractorInvoker } from './extractorInvoker';
import { GraphSnapshot } from './graphSnapshot';

/**
 * Gerencia o ciclo de vida das sessões de depuração, identificando o tipo de
 * depurador ativo e acionando o `ExtractorInvoker` sempre que a execução pausa.
 *
 * - `vscode.debug.onDidChangeActiveDebugSession` dispara apenas na troca de
 *   sessões, não a cada pausa. Usado para manter o rastro da sessão atual.
 * - Para detectar pausas, o tráfego do Debug Adapter Protocol (DAP) é interceptado
 *   usando `registerDebugAdapterTrackerFactory` e escutando o evento `stopped`.
 * - O mesmo tracker também escuta o evento `process` (dispara no início da sessão,
 *   bem antes de qualquer `stopped`), de onde vem o `systemProcessId`, o PID do
 *   processo depurado, necessário pra montar o caminho do arquivo de snapshot
 *   (`dbg-algo-snapshot-<pid>.json`). Sem isso o `ExtractorInvoker` não tem como
 *   saber qual arquivo ler depois de disparar a extração.
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
   * PID do processo depurado, por sessão. Vem do evento DAP `process`
   * (campo `systemProcessId`), capturado antes de qualquer `stopped`.
   * Necessário porque o script Python nomeia o arquivo de snapshot com
   * esse mesmo PID, sem isso o backend não sabe qual arquivo ler.
   */
  private readonly sessionPids = new Map<string, number>();

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
   * @param onSnapshot Callback chamado com o snapshot lido e validado a cada pausa. (provisório)
   */
  constructor(
    private readonly invoker: ExtractorInvoker,
    private readonly onSnapshot: (snapshot: GraphSnapshot, session: vscode.DebugSession) => void,
  ) {
    this.disposables.push(
      // Mantém 'currentSession' sincronizado quando o usuário troca de abas/sessões
      vscode.debug.onDidChangeActiveDebugSession((session) => {
        this.currentSession = session;
      }),

      // Limpa o rastro de importação e esvazia a sessão ativa se ela for encerrada
      vscode.debug.onDidTerminateDebugSession((session) => {
        this.importedSessions.delete(session.id);
        this.sessionPids.delete(session.id);
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
   * Dois eventos interessam: `process` (guarda o PID) e `stopped` (dispara
   * a extração). Qualquer outra mensagem é ignorada.
   */
  private handleDapMessage(session: vscode.DebugSession, message: unknown): void {
    const processInfo = asProcessEvent(message) ?? asLaunchedProcessOutput(message);
    if (processInfo !== undefined) {
      this.sessionPids.set(session.id, processInfo.systemProcessId);
      return;
    }

    const stoppedInfo = asStoppedEvent(message);
    if (stoppedInfo === undefined) {
      return;
    }

    const type = this.detectDebuggerType(session);
    if (type === undefined) {
      return;
    }

    void this.onSessionStopped(session, type, stoppedInfo.threadId);
  }

  /**
   * Acionado toda vez que uma sessão suportada entra em pausa.
   * Determina se é o momento de importar o módulo base (apenas na 1ª pausa),
   * resolve o PID já capturado e comanda a injeção do script de dump.
   */
  private async onSessionStopped(
    session: vscode.DebugSession,
    type: DebuggerType,
    threadId: number,
  ): Promise<void> {
    const pid = this.sessionPids.get(session.id);
    if (pid == undefined) {
      console.warn(
        `[DbgAlgo] sessao ${session.id} parou mas o PID do processo depurado ainda nao foi capturado`,
      );
      return;
    }

    const firstPauseThisSession = !this.importedSessions.has(session.id);
    if (firstPauseThisSession) {
      this.importedSessions.add(session.id);
    }

    try {
      const snapshot = await this.invoker.invoke(session, type, {
        importModule: firstPauseThisSession,
        pid,
        threadId,
      });
      this.onSnapshot(snapshot, session);
    } catch (err) {
      console.error(`[DbgAlgo] falha ao extrair/ler snapshot da sessao ${session.id}`, err);
    }
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
 * Type guard pro evento DAP `stopped`. Retorna o `threadId` (necessário
 * pro `ExtractorInvoker` resolver o `frameId`) se a mensagem for esse
 * evento e trouxer `body.threadId`, ou `undefined` caso contrário.
 *
 * O evento `stopped` indica que a execução bateu em um breakpoint, exceção ou fim de passo (step).
 */
function asStoppedEvent(message: unknown): { threadId: number } | undefined {
  if (typeof message !== 'object' || message === null) {
    return undefined;
  }
  const candidate = message as { type?: unknown; event?: unknown; body?: unknown };
  if (candidate.type !== 'event' || candidate.event !== 'stopped') {
    return undefined;
  }
  const body = candidate.body as { threadId?: unknown } | undefined;
  if (typeof body?.threadId !== 'number') {
    return undefined;
  }

  return { threadId: body.threadId };
}

/**
 * Fallback pro PID quando o depurador não manda o evento `process`.
 * Não é parte do DAP, é comportamento específico do CodeLLDB.
 *
 * Cobre só o caso `launch`.
 */
function asLaunchedProcessOutput(message: unknown): { systemProcessId: number } | undefined {
  if (typeof message !== 'object' || message === null) {
    return undefined;
  }
  const candidate = message as { type?: unknown; event?: unknown; body?: unknown };
  if (candidate.type !== 'event' || candidate.event !== 'output') {
    return undefined;
  }
  const body = candidate.body as { category?: unknown; output?: unknown } | undefined;
  if (body?.category !== 'console' || typeof body.output !== 'string') {
    return undefined;
  }
  const match = /^Launched process (\d+) from/.exec(body.output);
  if (match === null) {
    return undefined;
  }
  return { systemProcessId: Number(match[1]) };
}

/**
 * Type guard pro evento DAP `process`. Retorna o corpo tipado
 * (`{ systemProcessId }`) se a mensagem for esse evento, ou `undefined`
 * caso contrário.
 */
function asProcessEvent(message: unknown): { systemProcessId: number } | undefined {
  if (typeof message !== 'object' || message === null) {
    return undefined;
  }
  const candidate = message as { type?: unknown; event?: unknown; body?: unknown };
  if (candidate.type !== 'event' || candidate.event !== 'process') {
    return undefined;
  }
  const body = candidate.body as { systemProcessId?: unknown } | undefined;
  if (typeof body?.systemProcessId !== 'number') {
    return undefined;
  }

  return { systemProcessId: body.systemProcessId };
}
