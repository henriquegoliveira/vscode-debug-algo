import * as fs from 'fs/promises';
import { readFileSync } from 'fs';
import Ajv, { ValidateFunction } from 'ajv';
import { GraphSnapshot } from './graphSnapshot';

/**
 * Lê o arquivo de snapshot escrito pelo extrator e valida contra o schema formal
 */
export class SnapshotReader {
  private readonly validateFn: ValidateFunction;

  /**
   * @param schemaPath Caminho absoluto pro graph-snapshot.schema.json.
   *   Lido de forma síncrona só uma vez, na construção.
   */
  constructor(schemaPath: string) {
    const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
    const ajv = new Ajv();
    this.validateFn = ajv.compile(schema);
  }

  /**
   * Lê e valida o arquivo em `filePath`. Lança erro se o arquivo não
   * existir, não for JSON válido, ou não bater com o schema.
   */
  async read(filePath: string): Promise<GraphSnapshot> {
    const raw = await fs.readFile(filePath, 'utf8');
    const json = JSON.parse(raw);

    if (!this.validate(json)) {
      const errors = this.validateFn.errors?.map((e) => `${e.schemaPath} ${e.message}`).join('; ');
      throw new Error(`snapshot em '${filePath}' nao bate com o schema: ${errors}`);
    }

    return json as GraphSnapshot;
  }

  validate(json: unknown): boolean {
    return this.validateFn(json) as boolean;
  }
}
