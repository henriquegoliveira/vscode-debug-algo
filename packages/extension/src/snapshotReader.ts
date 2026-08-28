import * as fs from 'fs/promises';
import { readFileSync } from 'fs';
import Ajv, { ValidateFunction } from 'ajv';
import { GraphSnapshot } from 'dbga-contract';

const READ_ATTEMPTS = process.platform === 'win32' ? 6 : 4;
const FIRST_BACKOFF_MS = 10;

export class SnapshotReader {
  private readonly validateFn: ValidateFunction;

  constructor(schemaPath: string) {
    const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
    const ajv = new Ajv({ allErrors: true });
    this.validateFn = ajv.compile(schema);
  }

  async read(filePath: string): Promise<GraphSnapshot> {
    const json = await this.readWithRetry(filePath);

    if (!this.validate(json)) {
      const errors = this.validateFn.errors?.map((e) => `${e.schemaPath} ${e.message}`).join('; ');
      throw new Error(`snapshot em '${filePath}' nao bate com o schema: ${errors}`);
    }

    return json as GraphSnapshot;
  }

  validate(json: unknown): boolean {
    return this.validateFn(json) as boolean;
  }

  private async readWithRetry(filePath: string): Promise<unknown> {
    let lastError: unknown;

    for (let attempt = 0; attempt < READ_ATTEMPTS; attempt += 1) {
      try {
        return JSON.parse(await fs.readFile(filePath, 'utf8'));
      } catch (err) {
        lastError = err;
        if (attempt < READ_ATTEMPTS - 1) {
          await delay(FIRST_BACKOFF_MS * 2 ** attempt);
        }
      }
    }

    throw new Error(
      `nao consegui ler o snapshot em '${filePath}' apos ${READ_ATTEMPTS} tentativas: ${String(lastError)}`,
    );
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
