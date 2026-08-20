import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync } from 'node:fs';
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

const SCENES = {
  linked_list_simple: { breakAt: 'remove_node' },
  linked_list_cyclic: { breakAt: 'remove_node' },
  recursion: { continues: 5 },
  sorting_algorithms: { continues: 7 },
};

const ASSERTIONS = {
  linked_list_simple: assertLinkedListSimple,
  linked_list_cyclic: assertLinkedListCyclic,
};

const DEBUGGERS = {
  gdb: {
    label: 'GDB',
    module: 'dbga_extractor_gdb',
    resolve: () => 'gdb',
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
    .map((entry) => path.join(extensions, entry, 'lldb', 'bin', 'lldb'));

  for (const candidate of candidates.reverse()) {
    try {
      readFileSync(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  throw new Error(
    'LLDB nao encontrado — esperado em ~/.vscode/extensions/vadimcn.vscode-lldb-*/lldb/bin/lldb',
  );
}

function sourceOf(target) {
  for (const extension of ['.c', '.cpp']) {
    const candidate = path.join(TARGETS, target + extension);
    try {
      return { file: target + extension, text: readFileSync(candidate, 'utf8') };
    } catch {
      continue;
    }
  }
  throw new Error(`nenhum fonte para o alvo ${target}`);
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

function runTarget(target, key) {
  const debuggerSpec = DEBUGGERS[key];
  const outPath = path.join(OUTPUT, `${target}.${key}.json`);
  rmSync(outPath, { force: true });

  const args = [
    ...debuggerSpec.flags,
    ...sceneArgs(target, debuggerSpec),
    ...debuggerSpec.script(importCommand(debuggerSpec)),
    ...debuggerSpec.script(dumpCommand(debuggerSpec, outPath, {})),
    path.join(BIN, target),
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

function assertLinkedListSimple(snapshot, fail) {
  const roots = byName(snapshot.roots);

  if (roots.head_ref?.target !== roots.head?.address) {
    fail(`head_ref.target ${roots.head_ref?.target} != head.address ${roots.head?.address}`);
  }
  if (roots.head_ref?.indirections !== 2) {
    fail(`head_ref.indirections ${roots.head_ref?.indirections} != 2`);
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

function extract(target, key, validate, fail) {
  const { outPath, stderr } = runTarget(target, key);
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
  ASSERTIONS[target]?.(snapshot, (message) => fail(`${spec.label}: ${message}`));

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

function checkBaseline(target, normalized, fail, update) {
  const baseline = path.join(EXPECTED, `${target}.json`);

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
  if (difference !== null) {
    fail(
      `linha de base em ${difference.path}: ` +
        `${JSON.stringify(difference.left)} != ${JSON.stringify(difference.right)}`,
    );
  }
}

function main() {
  mkdirSync(OUTPUT, { recursive: true });

  const { keys, names, update } = parseArguments(process.argv.slice(2));
  const available = readdirSync(BIN).sort();
  const targets = names.length > 0 ? available.filter((t) => names.includes(t)) : available;

  if (targets.length === 0) {
    console.error('nenhum alvo encontrado em tests/targets/bin — rode make -C tests/targets');
    process.exit(1);
  }

  for (const key of keys) DEBUGGERS[key].resolve();

  const validate = new Ajv({ allErrors: true }).compile(JSON.parse(readFileSync(SCHEMA, 'utf8')));

  let failures = 0;

  for (const target of targets) {
    const problems = [];
    const fail = (message) => problems.push(message);

    const snapshots = {};
    for (const key of keys) {
      const snapshot = extract(target, key, validate, fail);
      if (snapshot !== null) snapshots[key] = snapshot;
    }

    const normalized = checkParity(snapshots, fail);
    if (normalized !== null) checkBaseline(target, normalized, fail, update);

    if (problems.length > 0) failures += 1;
    report(target, problems, snapshots, keys);
  }

  const labels = keys.map((key) => DEBUGGERS[key].label).join(' + ');
  console.log(
    `\n${targets.length - failures}/${targets.length} alvos ok sob ${labels}` +
      (failures > 0 ? ` — ${failures} com problema` : ''),
  );
  process.exit(failures > 0 ? 1 : 0);
}

function report(target, problems, snapshots, keys) {
  if (problems.length === 0) {
    const snapshot = snapshots[keys[0]];
    const meta = snapshot.meta;
    const shape =
      `${snapshot.roots.length} raizes, ${snapshot.nodes.length} nos, ${snapshot.edges.length} arestas` +
      `, ${meta.framesScanned} frames` +
      (meta.errors.length > 0 ? `, ${meta.errors.length} erros` : '') +
      (meta.truncated ? `, truncado (${meta.truncationReasons.join(',')})` : '');
    console.log(`ok    ${target.padEnd(30)} ${shape}`);
    return;
  }
  console.log(`FALHA ${target}`);
  for (const problem of problems) console.log(`        ${problem}`);
}

main();
