import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as os from 'node:os';
import * as path from 'node:path';

import { normalize, normalizeSequence, firstDifference } from './normalize.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const TARGETS = path.join(HERE, 'targets');
const BIN = path.join(TARGETS, 'bin');
const OUTPUT = path.join(HERE, 'output');
const EXPECTED = path.join(HERE, 'expected');
const TIMELINES_EXPECTED = path.join(EXPECTED, 'timelines');
const SCRIPTS = path.join(ROOT, 'packages', 'extension', 'scripts');
const SCHEMA = path.join(ROOT, 'packages', 'extension', 'schemas', 'graph-snapshot.schema.json');

const EXE = process.platform === 'win32' ? '.exe' : '';
const BASELINE_PLATFORM = 'linux';

const SCENES = {
  linked_list_simple: { breakAt: 'remove_node' },
  linked_list_cyclic: { breakAt: 'remove_node' },
  recursion: { continues: 5 },
  b_tree: { continues: 2 },
  sorting_bubble: { continues: 5 },
  sorting_bubble_improved: { continues: 5 },
  sorting_insertion: { continues: 4 },
  sorting_merge: { continues: 5 },
  sorting_quick_last: { continues: 5 },
  sorting_quick_median: { continues: 5 },
  sorting_quick_random: { continues: 5 },
  sorting_heap: { continues: 5 },
};

const TIMELINES = ['sorting_merge', 'recursion'];

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

const WINDOWS_DIVERGENCE = {
  linked_list_simple: ['baseline'],
  linked_list_cyclic: ['baseline'],
  huffman: ['baseline', 'parity'],
  class_reference: ['parity'],
  garbage_pointer: ['parity'],
  sorting_quick_random: ['baseline'],
};

export function declaredDivergence(target, platform, kind) {
  return platform !== BASELINE_PLATFORM && (WINDOWS_DIVERGENCE[target] ?? []).includes(kind);
}

export function stackGarbageIsStable(platform) {
  return platform === BASELINE_PLATFORM;
}

const DEBUGGERS = {
  gdb: {
    label: 'GDB',
    module: 'dbga_extractor_gdb',
    resolve: resolveGdb,
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

const MSYS2_SUBSYSTEMS = ['ucrt64', 'mingw64', 'clang64', 'mingw32'];
const VSCODE_HOMES = ['.vscode', '.vscode-insiders', '.vscode-server', '.vscode-oss'];

export function msys2Candidates(roots, subsystems, exe) {
  const out = [];
  for (const root of roots) {
    for (const subsystem of subsystems) {
      out.push(path.join(root, subsystem, 'bin', `gdb${exe}`));
    }
  }
  return out;
}

export function extensionRoots(home, env) {
  const roots = [];
  if (env.VSCODE_EXTENSIONS) {
    roots.push(env.VSCODE_EXTENSIONS);
  }
  for (const directory of VSCODE_HOMES) {
    roots.push(path.join(home, directory, 'extensions'));
  }
  return roots;
}

function msys2Roots() {
  const roots = [];
  if (process.env.MSYS2_ROOT) {
    roots.push(process.env.MSYS2_ROOT);
  }
  const drive = process.env.SystemDrive || 'C:';
  roots.push(path.join(drive, path.sep, 'msys64'));
  roots.push(path.join(drive, path.sep, 'msys32'));
  roots.push(path.join(drive, path.sep, 'tools', 'msys64'));
  return roots;
}

function resolveGdb() {
  const override = process.env.DBGA_GDB;
  if (override) {
    return override;
  }

  if (process.platform !== 'win32') {
    return 'gdb';
  }

  for (const candidate of msys2Candidates(msys2Roots(), MSYS2_SUBSYSTEMS, EXE)) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return 'gdb';
}

function resolveLldb() {
  const override = process.env.DBGA_LLDB;
  if (override) {
    return override;
  }

  const roots = extensionRoots(os.homedir(), process.env);
  const candidates = [];

  for (const root of roots) {
    let entries;
    try {
      entries = readdirSync(root);
    } catch {
      continue;
    }

    for (const entry of entries.filter((name) => name.startsWith('vadimcn.vscode-lldb-')).sort()) {
      candidates.push(path.join(root, entry, 'lldb', 'bin', `lldb${EXE}`));
    }
  }

  for (const candidate of candidates.reverse()) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `LLDB nao encontrado — procurado em ${roots.join(', ')}` +
      ` (vadimcn.vscode-lldb-*/lldb/bin/lldb${EXE})` +
      ' — instale o CodeLLDB, ou aponte DBGA_LLDB para o executavel',
  );
}

let sourceIndex;

export function indexSources(entries, read) {
  const found = new Map();

  for (const directory of entries) {
    for (const entry of read(directory)) {
      if (!entry.endsWith('.c') && !entry.endsWith('.cpp')) {
        continue;
      }

      const base = entry.replace(/\.(c|cpp)$/, '');
      const previous = found.get(base);
      if (previous !== undefined) {
        throw new Error(
          `dois fontes com o mesmo basename: ${previous} e ${directory}/${entry}` +
            ' — o binario e o launch.json usam o basename como identidade',
        );
      }

      found.set(base, `${directory}/${entry}`);
    }
  }

  return found;
}

function sources() {
  if (sourceIndex === undefined) {
    const directories = readdirSync(TARGETS, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== path.basename(BIN))
      .map((entry) => entry.name)
      .sort();

    sourceIndex = indexSources(directories, (directory) =>
      readdirSync(path.join(TARGETS, directory)).sort(),
    );
  }

  return sourceIndex;
}

function sourceFile(target) {
  const relative = sources().get(target);

  return relative === undefined ? null : path.join(TARGETS, relative);
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

function pauseCount(target) {
  return (SCENES[target]?.continues ?? 0) + 1;
}

function sceneArgs(target, debuggerSpec, dumps, options) {
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

  if (dumps === null) {
    args.push(...debuggerSpec.command('run'));
    for (let i = 0; i < (scene.continues ?? 0); i += 1) {
      args.push(...debuggerSpec.command('continue'));
    }

    return args;
  }

  args.push(...debuggerSpec.script(importCommand(debuggerSpec)));
  args.push(...debuggerSpec.command('run'));

  dumps.forEach((outPath, position) => {
    if (position > 0) {
      args.push(...debuggerSpec.command('continue'));
    }
    args.push(...debuggerSpec.script(dumpCommand(debuggerSpec, outPath, options)));
  });

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
  const single = job.count === 1;
  const outPaths = Array.from({ length: job.count }, (unused, position) =>
    path.join(OUTPUT, single ? `${job.file}.${key}.json` : `${job.file}.${position}.${key}.json`),
  );
  outPaths.forEach((outPath) => rmSync(outPath, { force: true }));

  const args = single
    ? [
        ...debuggerSpec.flags,
        ...sceneArgs(job.target, debuggerSpec, null, job.options),
        ...debuggerSpec.script(importCommand(debuggerSpec)),
        ...debuggerSpec.script(dumpCommand(debuggerSpec, outPaths[0], job.options)),
        path.join(BIN, job.target + EXE),
      ]
    : [
        ...debuggerSpec.flags,
        ...sceneArgs(job.target, debuggerSpec, outPaths, job.options),
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

  return { outPaths, stderr };
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
    note('curr e prev saem de locais nao inicializados; a cena so e estavel no Linux');
    return;
  }

  if (roots.curr?.status !== 'unreadable') {
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

function assertLinkedListCyclic(snapshot, fail, note) {
  if (!stackGarbageIsStable(process.platform)) {
    note('curr e prev saem de locais nao inicializados; a cena so e estavel no Linux');
    return;
  }

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

  if (snapshot.frames.length !== snapshot.meta.framesScanned) {
    fail(`frames ${snapshot.frames.length} != framesScanned ${snapshot.meta.framesScanned}`);
  }
  const frameKeys = new Set(snapshot.frames.map((frame) => `${frame.function}#${frame.level}`));
  for (const root of snapshot.roots) {
    if (root.frameLevel >= 0 && !frameKeys.has(`${root.function}#${root.frameLevel}`)) {
      fail(`raiz ${root.name} em ${root.function}#${root.frameLevel} sem frame`);
    }
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
  const { outPaths, stderr } = runTarget(job, key);
  const spec = DEBUGGERS[key];
  const snapshots = [];

  for (const [position, outPath] of outPaths.entries()) {
    const where = job.count === 1 ? '' : ` pausa ${position}`;

    let snapshot;
    try {
      snapshot = JSON.parse(readFileSync(outPath, 'utf8'));
    } catch {
      const tail = stderr ? ` — ${key}: ${stderr.trim().split('\n').pop()}` : '';
      fail(`${spec.label}: nenhum snapshot escrito${where}${tail}`);
      return null;
    }

    if (!validate(snapshot)) {
      for (const error of validate.errors.slice(0, 6)) {
        fail(`${spec.label}: ajv${where} ${error.instancePath || '/'} ${error.message}`);
      }
    }

    checkIntegrity(snapshot, (message) => fail(`${spec.label}:${where} ${message}`));
    if (job.variant === null) {
      ASSERTIONS[job.target]?.(snapshot, (message) => fail(`${spec.label}: ${message}`), note);
    }

    snapshots.push(snapshot);
  }

  return snapshots;
}

function checkParity(job, snapshots, fail, note) {
  const keys = Object.keys(snapshots);
  if (keys.length < 2) return null;

  const [first, ...rest] = keys;
  const reference = normalizeAll(snapshots[first]);

  for (const key of rest) {
    const other = normalizeAll(snapshots[key]);
    const difference = firstDifference(reference, other);
    if (difference !== null) {
      const message =
        `paridade ${DEBUGGERS[first].label} x ${DEBUGGERS[key].label} em ${difference.path}: ` +
        `${JSON.stringify(difference.left)} != ${JSON.stringify(difference.right)}`;
      if (declaredDivergence(job.target, process.platform, 'parity')) {
        note(`${message} — divergencia declarada fora do Linux`);
      } else {
        fail(message);
      }
      return null;
    }
  }

  return reference;
}

function normalizeAll(snapshots) {
  return snapshots.length === 1 ? normalize(snapshots[0]) : normalizeSequence(snapshots);
}

function checkBaseline(job, normalized, fail, note, update) {
  const baseline = job.baseline;

  if (update) {
    mkdirSync(path.dirname(baseline), { recursive: true });
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

  if (declaredDivergence(job.target, process.platform, 'baseline')) {
    note(`${message} — divergencia declarada fora do Linux`);
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
    {
      target,
      variant: null,
      label: target,
      file: target,
      options: {},
      count: 1,
      baseline: path.join(EXPECTED, `${target}.json`),
    },
    ...Object.entries(VARIANTS[target] ?? {}).map(([variant, options]) => ({
      target,
      variant,
      label: `${target}#${variant}`,
      file: `${target}.${variant}`,
      options,
      count: 1,
      baseline: path.join(EXPECTED, `${target}.${variant}.json`),
    })),
    ...(TIMELINES.includes(target)
      ? [
          {
            target,
            variant: 'timeline',
            label: `${target}#timeline`,
            file: `${target}.timeline`,
            options: {},
            count: pauseCount(target),
            baseline: path.join(TIMELINES_EXPECTED, `${target}.json`),
          },
        ]
      : []),
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
      const list = extract(job, key, validate, fail, note);
      if (list !== null) snapshots[key] = list;
    }

    const normalized = checkParity(job, snapshots, fail, note);
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
    const list = snapshots[keys[0]];
    const snapshot = list[list.length - 1];
    const meta = snapshot.meta;
    const shape =
      (list.length > 1 ? `${list.length} pausas, ` : '') +
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
