import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as os from 'node:os';
import * as path from 'node:path';

import { normalize, firstDifference } from './normalize.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const TARGETS = path.join(HERE, 'targets');
const BIN = path.join(TARGETS, 'bin');
const OUTPUT = path.join(HERE, 'output');
const EXPECTED = path.join(HERE, 'expected');
const SCRIPTS = path.join(ROOT, 'packages', 'extension', 'scripts');
const SCHEMA = path.join(ROOT, 'packages', 'extension', 'schemas', 'graph-snapshot.schema.json');

const EXE = process.platform === 'win32' ? '.exe' : '';
const BASELINE_PLATFORM = 'linux';

const SCENES = {
  linked_list_simple: { breakAt: 'remove_node' },
  linked_list_cyclic: { breakAt: 'remove_node' },
  recursion: { continues: 5 },
  sorting_algorithms: { continues: 7 },
  b_tree: { continues: 6 },
};

const VARIANTS = {
  dynamic_array: {
    annotated: {
      dynamicArrays: [
        'values@valueCount',
        'buffer->data@buffer->count',
        'label@5',
        'valueCount@valueCount',
        'missing@valueCount',
        'values@valueCount - 100',
        'appendToBuffer(buffer,999)@1',
      ],
    },
  },
  linked_stack: {
    annotated: { dynamicArrays: ['top@1'] },
  },
};

const ASSERTIONS = {
  linked_list_simple: assertLinkedListSimple,
  linked_list_cyclic: assertLinkedListCyclic,
};

const PLATFORM_DIVERGENT = new Set(['linked_list_simple', 'linked_list_cyclic', 'huffman']);

export function declaredDivergence(target, platform) {
  return platform !== BASELINE_PLATFORM && PLATFORM_DIVERGENT.has(target);
}

export function stackGarbageIsStable(platform) {
  return platform === BASELINE_PLATFORM;
}

const DEBUGGERS = {
  gdb: {
    label: 'GDB',
    module: 'dbga_extractor_gdb',
    resolve: () => process.env.DBGA_GDB || 'gdb',
    flags: ['-nx', '-batch'],
    command: (text) => ['-ex', text],
    script: (code) => ['-ex', `python ${code}`],
    breakpoint: (where) => `break ${where}`,
  },
  lldb: {
    label: 'LLDB',
    module: 'dbga_extractor_lldb',
    resolve: resolveLldb,
    flags: ['--batch', '--no-lldbinit'],
    command: (text) => ['-o', text],
    script: (code) => ['-o', `script ${code}`],
    breakpoint: (where) => `b ${where}`,
  },
};

const require = createRequire(path.join(ROOT, 'packages', 'extension', 'package.json'));
const AjvModule = require('ajv');
const Ajv = AjvModule.default ?? AjvModule;

function resolveLldb() {
  const override = process.env.DBGA_LLDB;
  if (override) {
    return override;
  }

  const extensions = path.join(os.homedir(), '.vscode', 'extensions');
  let entries;
  try {
    entries = readdirSync(extensions);
  } catch {
    entries = [];
  }

  const candidates = entries
    .filter((entry) => entry.startsWith('vadimcn.vscode-lldb-'))
    .sort()
    .map((entry) => path.join(extensions, entry, 'lldb', 'bin', `lldb${EXE}`));

  for (const candidate of candidates.reverse()) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `LLDB nao encontrado — esperado em ~/.vscode/extensions/vadimcn.vscode-lldb-*/lldb/bin/lldb${EXE}` +
      ' — ou aponte DBGA_LLDB para o executavel',
  );
}

function sourceFile(target) {
  for (const extension of ['.c', '.cpp']) {
    const candidate = path.join(TARGETS, target + extension);
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

export function targetsIn(entries, hasSource) {
  const names = new Set();
  for (const entry of entries) {
    const target = entry.endsWith('.exe') ? entry.slice(0, -4) : entry;
    if (hasSource(target)) {
      names.add(target);
    }
  }
  return [...names].sort();
}

function sourceOf(target) {
  const candidate = sourceFile(target);
  if (candidate === null) {
    throw new Error(`nenhum fonte para o alvo ${target}`);
  }
  return { file: path.basename(candidate), text: readFileSync(candidate, 'utf8') };
}

function sceneArgs(target, debuggerSpec) {
  const scene = SCENES[target] ?? {};
  const args = [];

  if (scene.breakAt !== undefined) {
    args.push(...debuggerSpec.command(debuggerSpec.breakpoint(scene.breakAt)));
  } else {
    const { file, text } = sourceOf(target);
    const line = text.split('\n').findIndex((row) => row.includes('// BREAKPOINT')) + 1;
    if (line === 0) {
      throw new Error(`nenhum marcador // BREAKPOINT em ${file}`);
    }
    args.push(...debuggerSpec.command(debuggerSpec.breakpoint(`${file}:${line}`)));
  }

  args.push(...debuggerSpec.command('run'));
  for (let i = 0; i < (scene.continues ?? 0); i += 1) {
    args.push(...debuggerSpec.command('continue'));
  }

  return args;
}

function importCommand(debuggerSpec) {
  return `import sys; sys.path.insert(0, ${JSON.stringify(SCRIPTS)}); import ${debuggerSpec.module}`;
}

function dumpCommand(debuggerSpec, outPath, options) {
  const literal = `__import__("json").loads(${JSON.stringify(JSON.stringify(options))})`;
  return `${debuggerSpec.module}.dump_structs(${JSON.stringify(outPath)}, options=${literal})`;
}

function runTarget(job, key) {
  const debuggerSpec = DEBUGGERS[key];
  const outPath = path.join(OUTPUT, `${job.file}.${key}.json`);
  rmSync(outPath, { force: true });

  const args = [
    ...debuggerSpec.flags,
    ...sceneArgs(job.target, debuggerSpec),
    ...debuggerSpec.script(importCommand(debuggerSpec)),
    ...debuggerSpec.script(dumpCommand(debuggerSpec, outPath, job.options)),
    path.join(BIN, job.target + EXE),
  ];

  let stderr = '';
  try {
    execFileSync(debuggerSpec.resolve(), args, {
      cwd: TARGETS,
      timeout: 120000,
      stdio: ['ignore', 'ignore', 'pipe'],
      encoding: 'utf8',
    });
  } catch (error) {
    stderr = String(error.stderr ?? error.message);
  }

  return { outPath, stderr };
}

function assertLinkedListSimple(snapshot, fail, note) {
  const roots = byName(snapshot.roots);

  if (roots.head_ref?.target !== roots.head?.address) {
    fail(`head_ref.target ${roots.head_ref?.target} != head.address ${roots.head?.address}`);
  }
  if (roots.head_ref?.indirections !== 2) {
    fail(`head_ref.indirections ${roots.head_ref?.indirections} != 2`);
  }
  if (!stackGarbageIsStable(process.platform)) {
    note(
      'curr sai de um local nao inicializado; a verificacao de zeroPage so vale no Linux (D111)',
    );
  } else if (roots.curr?.status !== 'unreadable') {
    fail(`curr.status ${roots.curr?.status} != unreadable`);
  } else {
    const node = nodeById(snapshot, roots.curr.node);
    if (node?.reason !== 'zeroPage') fail(`no de curr com reason ${node?.reason} != zeroPage`);
  }
  if (roots.prev?.status !== 'null') {
    fail(`prev.status ${roots.prev?.status} != null`);
  }

  const list = records(snapshot);
  if (list.length !== 3) fail(`${list.length} nos record, esperado 3`);

  const nulls = snapshot.edges.filter((edge) => edge.to === null);
  if (nulls.length !== 1) fail(`${nulls.length} arestas nulas, esperado 1`);
}

function assertLinkedListCyclic(snapshot, fail) {
  const list = records(snapshot);
  if (list.length !== 3) {
    fail(`${list.length} nos record, esperado 3`);
    return;
  }

  const next = new Map(snapshot.edges.map((edge) => [edge.from, edge.to]));
  let cursor = list[0].id;
  for (let hop = 0; hop < 3; hop += 1) cursor = next.get(cursor);

  if (cursor !== list[0].id) fail(`ciclo nao fecha: ${list[0].id} -> ... -> ${cursor}`);
  if (snapshot.meta.truncated) fail('snapshot truncado');
}

function byName(roots) {
  const out = {};
  for (const root of roots) out[root.name] ??= root;
  return out;
}

function records(snapshot) {
  return snapshot.nodes.filter((node) => node.kind === 'record');
}

function nodeById(snapshot, id) {
  return snapshot.nodes.find((node) => node.id === id);
}

function checkIntegrity(snapshot, fail) {
  const ids = new Set(snapshot.nodes.map((node) => node.id));
  for (const edge of snapshot.edges) {
    if (edge.to !== null && !ids.has(edge.to)) fail(`aresta pendurada ${edge.from} -> ${edge.to}`);
  }
  for (const root of snapshot.roots) {
    if (root.node !== null && !ids.has(root.node)) fail(`raiz ${root.name} aponta no inexistente`);
  }
  for (const error of snapshot.meta.errors) {
    if (error.message === 'addressCollision') fail(`addressCollision em ${error.reference}`);
  }

  checkArrays(snapshot, fail);
  checkObservedTypes(snapshot, fail);
}

function checkCells(label, length, cells, truncated, fail) {
  if (cells.length > length) fail(`${label}: ${cells.length} celulas > length ${length}`);
  if (truncated && cells.length >= length) fail(`${label}: truncated sem perda de celula`);
  if (!truncated && cells.length !== length) {
    fail(`${label}: ${cells.length} celulas != length ${length} sem truncated`);
  }
}

function checkArrays(snapshot, fail) {
  const labelled = new Set();
  for (const edge of snapshot.edges) {
    labelled.add(`${edge.from} ${edge.field.replace(/\[\d+\]$/, '')}`);
  }

  for (const node of snapshot.nodes) {
    if (node.kind === 'array') {
      if (node.cellsArePointers) {
        if (node.cells.length > 0) fail(`array ${node.id}: celulas de ponteiro nao vazias`);
      } else {
        checkCells(`array ${node.id}`, node.length, node.cells, node.truncated, fail);
      }
      continue;
    }

    if (node.kind !== 'record') continue;

    if (node.uncertain !== undefined && node.aggregate !== 'union') {
      fail(`no ${node.id}: uncertain em aggregate ${node.aggregate}`);
    }

    for (const array of node.arrays) {
      const label = `${node.id}.${array.name}`;

      if (!array.expanded) {
        if (array.cells.length > 0) fail(`${label}: cells nao vazio com expanded false`);
        continue;
      }

      if (array.cells.length === 0 && array.length > 0) {
        if (!labelled.has(`${node.id} ${array.name}`)) {
          fail(`${label}: expandido sem celula e sem aresta indexada`);
        }
        continue;
      }

      checkCells(label, array.length, array.cells, array.truncated, fail);
    }
  }
}

function checkObservedTypes(snapshot, fail) {
  const degrees = new Map();
  for (const edge of snapshot.edges) {
    if (edge.to === null) continue;
    degrees.set(edge.from, (degrees.get(edge.from) ?? 0) + 1);
  }

  const counts = new Map();
  const maximums = new Map();
  for (const node of snapshot.nodes) {
    if (node.kind !== 'record') continue;
    counts.set(node.type, (counts.get(node.type) ?? 0) + 1);
    const degree = degrees.get(node.id) ?? 0;
    maximums.set(node.type, Math.max(maximums.get(node.type) ?? 0, degree));
  }

  const seen = new Set();
  for (const observed of snapshot.meta.observedTypes) {
    if (seen.has(observed.type)) fail(`observedTypes duplica ${observed.type}`);
    seen.add(observed.type);

    if (!counts.has(observed.type)) {
      fail(`observedTypes tem ${observed.type} sem no record`);
      continue;
    }
    if (observed.count !== counts.get(observed.type)) {
      fail(
        `observedTypes ${observed.type}: count ${observed.count} != ${counts.get(observed.type)}`,
      );
    }
    if (observed.maxDegree !== maximums.get(observed.type)) {
      fail(
        `observedTypes ${observed.type}: maxDegree ${observed.maxDegree} != ` +
          `${maximums.get(observed.type)}`,
      );
    }
  }

  for (const type of counts.keys()) {
    if (!seen.has(type)) fail(`observedTypes nao lista ${type}`);
  }
}

function parseArguments(argv) {
  const keys = [];
  const names = [];
  let update = false;

  for (const item of argv) {
    if (item === '--gdb' || item === '--lldb') {
      keys.push(item.slice(2));
    } else if (item === '--update-expected') {
      update = true;
    } else if (item.startsWith('--')) {
      throw new Error(`opcao desconhecida ${item}`);
    } else {
      names.push(item);
    }
  }

  return { keys: keys.length > 0 ? keys : ['gdb', 'lldb'], names, update };
}

function extract(job, key, validate, fail, note) {
  const { outPath, stderr } = runTarget(job, key);
  const spec = DEBUGGERS[key];

  let snapshot;
  try {
    snapshot = JSON.parse(readFileSync(outPath, 'utf8'));
  } catch {
    const tail = stderr ? ` — ${key}: ${stderr.trim().split('\n').pop()}` : '';
    fail(`${spec.label}: nenhum snapshot escrito${tail}`);
    return null;
  }

  if (!validate(snapshot)) {
    for (const error of validate.errors.slice(0, 6)) {
      fail(`${spec.label}: ajv ${error.instancePath || '/'} ${error.message}`);
    }
  }

  checkIntegrity(snapshot, (message) => fail(`${spec.label}: ${message}`));
  if (job.variant === null) {
    ASSERTIONS[job.target]?.(snapshot, (message) => fail(`${spec.label}: ${message}`), note);
  }

  return snapshot;
}

function checkParity(snapshots, fail) {
  const keys = Object.keys(snapshots);
  if (keys.length < 2) return null;

  const [first, ...rest] = keys;
  const reference = normalize(snapshots[first]);

  for (const key of rest) {
    const other = normalize(snapshots[key]);
    const difference = firstDifference(reference, other);
    if (difference !== null) {
      fail(
        `paridade ${DEBUGGERS[first].label} x ${DEBUGGERS[key].label} em ${difference.path}: ` +
          `${JSON.stringify(difference.left)} != ${JSON.stringify(difference.right)}`,
      );
      return null;
    }
  }

  return reference;
}

function checkBaseline(job, normalized, fail, note, update) {
  const baseline = path.join(EXPECTED, `${job.file}.json`);

  if (update) {
    mkdirSync(EXPECTED, { recursive: true });
    writeFileSync(baseline, `${JSON.stringify(normalized, null, 2)}\n`);
    return;
  }

  let expected;
  try {
    expected = JSON.parse(readFileSync(baseline, 'utf8'));
  } catch {
    return;
  }

  const difference = firstDifference(expected, normalized);
  if (difference === null) {
    return;
  }

  const message =
    `linha de base em ${difference.path}: ` +
    `${JSON.stringify(difference.left)} != ${JSON.stringify(difference.right)}`;

  if (declaredDivergence(job.target, process.platform)) {
    note(`${message} — divergencia declarada fora do Linux (D111)`);
    return;
  }

  fail(message);
}

function main() {
  mkdirSync(OUTPUT, { recursive: true });

  const { keys, names, update } = parseArguments(process.argv.slice(2));
  const available = targetsIn(readdirSync(BIN), (target) => sourceFile(target) !== null);
  const targets = names.length > 0 ? available.filter((t) => names.includes(t)) : available;
  const jobs = targets.flatMap((target) => [
    { target, variant: null, label: target, file: target, options: {} },
    ...Object.entries(VARIANTS[target] ?? {}).map(([variant, options]) => ({
      target,
      variant,
      label: `${target}#${variant}`,
      file: `${target}.${variant}`,
      options,
    })),
  ]);

  if (targets.length === 0) {
    console.error('nenhum alvo encontrado em tests/targets/bin — rode make -C tests/targets');
    process.exit(1);
  }

  for (const key of keys) DEBUGGERS[key].resolve();

  const validate = new Ajv({ allErrors: true }).compile(JSON.parse(readFileSync(SCHEMA, 'utf8')));

  let failures = 0;

  for (const job of jobs) {
    const problems = [];
    const notes = new Set();
    const fail = (message) => problems.push(message);
    const note = (message) => notes.add(message);

    const snapshots = {};
    for (const key of keys) {
      const snapshot = extract(job, key, validate, fail, note);
      if (snapshot !== null) snapshots[key] = snapshot;
    }

    const normalized = checkParity(snapshots, fail);
    if (normalized !== null) checkBaseline(job, normalized, fail, note, update);

    if (problems.length > 0) failures += 1;
    report(job.label, problems, notes, snapshots, keys);
  }

  const labels = keys.map((key) => DEBUGGERS[key].label).join(' + ');
  console.log(
    `\n${jobs.length - failures}/${jobs.length} alvos ok sob ${labels}` +
      (failures > 0 ? ` — ${failures} com problema` : ''),
  );
  process.exit(failures > 0 ? 1 : 0);
}

function report(target, problems, notes, snapshots, keys) {
  if (problems.length === 0) {
    const snapshot = snapshots[keys[0]];
    const meta = snapshot.meta;
    const shape =
      `${snapshot.roots.length} raizes, ${snapshot.nodes.length} nos, ${snapshot.edges.length} arestas` +
      `, ${meta.framesScanned} frames` +
      (meta.errors.length > 0 ? `, ${meta.errors.length} erros` : '') +
      (meta.truncated ? `, truncado (${meta.truncationReasons.join(',')})` : '');
    console.log(`ok    ${target.padEnd(30)} ${shape}`);
  } else {
    console.log(`FALHA ${target}`);
    for (const problem of problems) console.log(`        ${problem}`);
  }
  for (const item of notes) console.log(`        nota: ${item}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
