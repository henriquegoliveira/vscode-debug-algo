import * as fs from 'fs/promises';
import { readFileSync } from 'fs';
import Ajv, { ValidateFunction } from 'ajv';
import { GraphSnapshot } from './graphSnapshot';

export class SnapshotReader {
  private readonly validateFn: ValidateFunction;

  constructor(schemaPath: string) {
    const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
    const ajv = new Ajv({ allErrors: true });
    this.validateFn = ajv.compile(schema);
  }

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
