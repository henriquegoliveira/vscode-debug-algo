import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const REPORTS = path.join(ROOT, 'reports');
const EXIT_CODES = path.join(REPORTS, 'exit-codes.json');
const WINDOWS = process.platform === 'win32';
const PYTHON = process.env.PYTHON ?? (WINDOWS ? 'python' : 'python3');

const LAYERS = [
  {
    key: 'vitest',
    outputs: ['vitest.xml'],
    args: [
      'test:coverage',
      '--reporter=default',
      '--reporter=junit',
      '--outputFile.junit=reports/vitest.xml',
    ],
  },
  {
    key: 'harness',
    outputs: ['harness.json'],
    args: ['test:e2e', '--json', 'reports/harness.json'],
  },
  {
    key: 'integration',
    outputs: ['integracao.xml'],
    args: ['test:integration'],
    env: { DBGA_XUNIT: path.join(REPORTS, 'integracao.xml') },
  },
  {
    key: 'pytest',
    outputs: ['pytest.xml', 'pytest-cov.json'],
    args: [
      'test:py',
      '--junitxml=reports/pytest.xml',
      '--cov=packages/extension/scripts',
      '--cov-report=json:reports/pytest-cov.json',
    ],
  },
];

const BENCH = {
  key: 'bench',
  outputs: ['bench.json'],
  args: [
    'vitest',
    'bench',
    '--run',
    '--project',
    'extension*',
    '--reporter=default',
    '--reporter=json',
    '--outputFile.json=reports/bench.json',
  ],
};

export function parseArguments(argv) {
  const options = { bench: false, skip: new Set(), figures: null };

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === '--bench') {
      options.bench = true;
    } else if (item === '--skip-integration' || item === '--skip-harness') {
      options.skip.add(item.slice('--skip-'.length));
    } else if (item === '--figures') {
      options.figures = argv[index + 1];
      if (options.figures === undefined || options.figures.startsWith('--')) {
        throw new Error('--figures pede uma pasta');
      }
      index += 1;
    } else {
      throw new Error(`opcao desconhecida ${item}`);
    }
  }

  return options;
}

function firstLine(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', shell: WINDOWS });
  if (result.status !== 0) return null;
  return `${result.stdout}${result.stderr}`.trim().split('\n')[0];
}

function environment() {
  return {
    generatedAt: new Date().toISOString(),
    commit: firstLine('git', ['rev-parse', '--short', 'HEAD']),
    platform: process.platform,
    release: os.release(),
    node: process.version,
    python: firstLine(PYTHON, ['--version']),
    gcc: firstLine('gcc', ['--version']),
  };
}

function readExitCodes() {
  try {
    return JSON.parse(readFileSync(EXIT_CODES, 'utf8'));
  } catch {
    return {};
  }
}

function clear(layer) {
  for (const output of layer.outputs) rmSync(path.join(REPORTS, output), { force: true });
}

function run(layer) {
  console.log(`\n=== ${layer.key} ===\n`);

  const result = spawnSync('yarn', layer.args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: WINDOWS,
    env: { ...process.env, ...layer.env },
  });

  return result.status ?? 1;
}

function draw(figures) {
  const args = [path.join(ROOT, 'tools', 'report', 'build_report.py'), REPORTS];
  if (figures !== null) args.push('--figures', path.resolve(figures));
  const result = spawnSync(PYTHON, args, { cwd: ROOT, stdio: 'inherit', shell: WINDOWS });
  return result.status ?? 1;
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  mkdirSync(REPORTS, { recursive: true });

  const layers = options.bench ? [BENCH] : LAYERS.filter((layer) => !options.skip.has(layer.key));
  const codes = options.bench ? readExitCodes() : {};

  if (!options.bench || !existsSync(path.join(REPORTS, 'environment.json'))) {
    writeFileSync(
      path.join(REPORTS, 'environment.json'),
      `${JSON.stringify(environment(), null, 2)}\n`,
    );
  }

  (options.bench ? [BENCH] : LAYERS).forEach(clear);
  for (const layer of layers) codes[layer.key] = run(layer);
  writeFileSync(EXIT_CODES, `${JSON.stringify(codes, null, 2)}\n`);

  const drawn = draw(options.figures);
  const failed = layers.some((layer) => codes[layer.key] !== 0);
  process.exit(failed || drawn !== 0 ? 1 : 0);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
