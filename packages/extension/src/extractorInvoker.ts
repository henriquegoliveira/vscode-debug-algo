import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { DebuggerType } from './debuggerType';
import { SnapshotReader } from './snapshotReader';
import { GraphSnapshot } from './graphSnapshot';

/**
 * Opções de configuração para o disparo da extração de variáveis.
 */
export interface InvokeOptions {
  /**
   * Se `true`, injeta o módulo Python no processo alvo antes de chamar a
   * função de extração. Geralmente é `true` apenas na primeira pausa da sessão.
   */
  importModule: boolean;

  /**
   * Nome da variável a ser inspecionada no frame atual.
   */
  rootVar?: string;

  /**
   * PID do processo depurado (não o do GDB/LLDB em si). Usado pra montar
   * o caminho do arquivo de snapshot, mesma convenção usada pelo script
   * Python: `<tmpdir>/dbg-algo-snapshot-<pid>.json`. Vem do evento DAP
   * `process`, capturado pelo `DebugSessionManager`.
   */
  pid: number;

  /**
   * ID da thread parada, vindo do `body.threadId` do evento DAP `stoped`.
   * Necessário para resolver o `frameId` do `evaluate`.
   */
  threadId: number;
}

/**
 * Injeta os scripts de extração no processo atual usando o formato correto para o depurador ativo.
 *
 * A requisição DAP `evaluate` usa `context: "repl"` para rodar comandos
 * no console de depuração, garantindo que o depurador não bloqueie a
 * importação de módulos.
 *
 * O path é lido via PID pois o retorno do `evaluate` só é confiável no GDB,
 * no LLDB o stdout do script não chega de forma confiável.
 * O PID (via evento DAP `process`) funciona igual nos dois.
 */
export class ExtractorInvoker {
  /**
   * @param extensionPath Caminho absoluto raiz da extensão. Usado como base
   *                      para localizar os scripts Python que serão injetados.
   * @param reader
   */
  constructor(
    private readonly extensionPath: string,
    private readonly reader: SnapshotReader,
  ) {}

  /**
   * Coordena a injeção do script e a execução da extração de dados.
   *
   * @param session A sessão de depuração ativa do VS Code.
   * @param type Identifica se o depurador por baixo dos panos é GDB ou LLDB.
   * @param options Define se é necessário importar o módulo base e qual variável extrair.
   */
  async invoke(
    session: vscode.DebugSession,
    type: DebuggerType,
    options: InvokeOptions,
  ): Promise<GraphSnapshot> {
    const frameId = await this.resolveFrameId(session, options.threadId);

    if (options.importModule) {
      await this.sendEvaluate(session, type, this.importCommand(type), frameId);
    }
    await this.sendEvaluate(session, type, this.dumpCommand(type, options.rootVar), frameId);

    // Obs: O script .py já implementa medidas contra race condition.
    return this.reader.read(this.snapshotPathFor(options.pid));
  }

  /**
   * Pede ao depurador o topo da pilha da thread parada (`stackTrace`,
   * `startFrame: 0, levels: 1`). O `id` desse frame é o `frameId` que o `evaluate`
   * exige.
   *
   * @see https://microsoft.github.io/debug-adapter-protocol/specification#Requests_StackTrace
   */
  private async resolveFrameId(session: vscode.DebugSession, threadId: number): Promise<number> {
    const response = await session.customRequest('stackTrace', {
      threadId,
      startFrame: 0,
      levels: 1,
    });

    const frame = response?.stackFrames?.[0];
    if (frame === undefined) {
      console.log(`nao consegui resolver o frame da thread ${threadId} (stackTrace vazio)`);
    }

    return frame.id;
  }

  private snapshotPathFor(pid: number): string {
    return path.join(os.tmpdir(), `dbg-algo-snapshot-${pid}.json`);
  }

  /**
   * Resolve o caminho absoluto do script Python contendo a lógica de extração.
   * Retorna o arquivo correto dependendo do depurador ativo.
   */
  private scriptPathFor(type: DebuggerType): string {
    const filename = type === DebuggerType.GDB ? 'extractor_gdb.py' : 'extractor_lldb.py';
    return path.join(this.extensionPath, 'scripts', filename);
  }

  /**
   * Extrai apenas o nome do arquivo sem a extensão (ex: 'extractor_gdb').
   * Esse nome é usado diretamente como o nome do módulo no `import` do Python.
   */
  private moduleNameFor(type: DebuggerType): string {
    return path.basename(this.scriptPathFor(type), '.py');
  }

  /**
   * Constrói o comando Python responsável por adicionar o diretório dos
   * scripts ao `sys.path` e importar o módulo.
   *
   * O `JSON.stringify` atua como um formatador de segurança: ele adiciona aspas
   * ao redor do caminho e escapa barras invertidas (ambientes Windows),
   * garantindo que o interpretador Python leia uma string válida.
   */
  private importCommand(type: DebuggerType): string {
    const scriptDir = path.dirname(this.scriptPathFor(type));
    const moduleName = this.moduleNameFor(type);

    return `import sys; \
            sys.path.insert(0, ${JSON.stringify(scriptDir)}); \
            import ${moduleName}`;
  }

  /**
   * Constrói a chamada para a função principal do script Python.
   *
   * @param rootVar Se fornecida, passa a string empacotada em JSON (com aspas)
   *                como argumento da função. Se não, passa vazio.
   */
  private dumpCommand(type: DebuggerType, rootVar?: string): string {
    const moduleName = this.moduleNameFor(type);
    const arg = rootVar !== undefined ? JSON.stringify(rootVar) : '';
    return `${moduleName}.dump_structs(${arg})`;
  }

  /**
   * Envia a instrução final para o depurador usando a requisição `evaluate` do DAP.
   *
   * Como o GDB e o LLDB esperam comandos do seu próprio CLI (e não Python puro),
   * o código Python é encapsulado usando o prefixo nativo de cada um:
   * - GDB: usa `-exec python <código>`
   * - LLDB: usa `script <código>`
   *
   * O VS Code expõe a função `customRequest` para enviar mensagens DAP arbitrárias.
   *
   * @see https://microsoft.github.io/debug-adapter-protocol/specification#Requests_Evaluate
   * @see https://code.visualstudio.com/api/references/vscode-api#DebugSession.customRequest
   */
  private async sendEvaluate(
    session: vscode.DebugSession,
    type: DebuggerType,
    pythonCode: string,
    frameId: number,
  ): Promise<unknown> {
    const expression =
      type === DebuggerType.GDB ? `-exec python ${pythonCode}` : `script ${pythonCode}`;

    return session.customRequest('evaluate', { expression, context: 'repl', frameId });
  }
}
