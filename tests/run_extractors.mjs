import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const TARGETS = path.join(HERE, 'targets');
const BIN = path.join(TARGETS, 'bin');
const OUTPUT = path.join(HERE, 'output');
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

const require = createRequire(path.join(ROOT, 'packages', 'extension', 'package.json'));
const AjvModule = require('ajv');
const Ajv = AjvModule.default ?? AjvModule;

function sourceOf(target) {
  for (const extension of ['.c', '.cpp']) {
    const candidate = path.join(TARGETS, target + extension);
    try {
      readFileSync(candidate);
      return { file: target + extension, text: readFileSync(candidate, 'utf8') };
    } catch {
      continue;
    }
  }
  throw new Error(`nenhum fonte para o alvo ${target}`);
}

function breakpointArgs(target) {
  const scene = SCENES[target] ?? {};
  const args = [];

  if (scene.breakAt !== undefined) {
    args.push('-ex', `break ${scene.breakAt}`);
  } else {
    const { file, text } = sourceOf(target);
    const line = text.split('\n').findIndex((row) => row.includes('// BREAKPOINT')) + 1;
    if (line === 0) {
      throw new Error(`nenhum marcador // BREAKPOINT em ${file}`);
    }
    args.push('-ex', `break ${file}:${line}`);
  }

  args.push('-ex', 'run');
  for (let i = 0; i < (scene.continues ?? 0); i += 1) {
    args.push('-ex', 'continue');
  }

  return args;
}

function importCommand() {
  return `python import sys; sys.path.insert(0, ${JSON.stringify(SCRIPTS)}); import dbga_extractor_gdb`;
}

function dumpCommand(outPath, options) {
  const literal = `__import__("json").loads(${JSON.stringify(JSON.stringify(options))})`;
  return `python dbga_extractor_gdb.dump_structs(${JSON.stringify(outPath)}, options=${literal})`;
}

function runTarget(target) {
  const outPath = path.join(OUTPUT, `${target}.gdb.json`);
  rmSync(outPath, { force: true });

  const args = [
    '-nx',
    '-batch',
    ...breakpointArgs(target),
    '-ex',
    importCommand(),
    '-ex',
    dumpCommand(outPath, {}),
    path.join(BIN, target),
  ];

  let stderr = '';
  try {
    execFileSync('gdb', args, {
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
  const headRef = roots.get('head_ref');
  const head = roots.get('head');
  const curr = roots.get('curr');
  const prev = roots.get('prev');

  if (headRef === undefined) return fail('raiz head_ref ausente');
  if (head === undefined) return fail('raiz head do frame de main ausente');
  if (headRef.target !== head.address) {
    fail(`head_ref.target (${headRef.target}) != head.address (${head.address})`);
  }
  if (headRef.indirections !== 2)
    fail(`head_ref.indirections = ${headRef.indirections}, esperado 2`);
  if (curr === undefined || curr.status !== 'unreadable')
    fail('curr deveria ser ilegivel (vale 0x1)');
  if (nodeById(snapshot, curr?.node)?.reason !== 'zeroPage')
    fail('curr deveria virar no opaque zeroPage');
  if (prev === undefined || prev.status !== 'null') fail('prev deveria ter status null');
  if (records(snapshot).length !== 3)
    fail(`esperados 3 nos record, vieram ${records(snapshot).length}`);
  if (snapshot.edges.filter((edge) => edge.to === null).length !== 1) {
    fail('esperada exatamente uma aresta nula (o next do ultimo no)');
  }
}

function assertLinkedListCyclic(snapshot, fail) {
  const list = records(snapshot);
  if (list.length !== 3) return fail(`esperados 3 nos record, vieram ${list.length}`);

  const outgoing = new Map(snapshot.edges.map((edge) => [edge.from, edge.to]));
  let cursor = list[0].id;
  for (let step = 0; step < 3; step += 1) {
    cursor = outgoing.get(cursor);
    if (cursor === undefined || cursor === null) return fail('o ciclo se rompeu antes de fechar');
  }
  if (cursor !== list[0].id) fail('a lista circular nao voltou ao no de partida');
  if (snapshot.meta.truncated) fail('a lista circular truncou, sinal de laco nao detectado');
}

function byName(roots) {
  return new Map(roots.map((root) => [root.name, root]));
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

function main() {
  mkdirSync(OUTPUT, { recursive: true });

  const filter = process.argv.slice(2);
  const available = readdirSync(BIN).sort();
  const targets = filter.length > 0 ? available.filter((t) => filter.includes(t)) : available;

  if (targets.length === 0) {
    console.error('nenhum alvo encontrado em tests/targets/bin — rode make -C tests/targets');
    process.exit(1);
  }

  const validate = new Ajv({ allErrors: true }).compile(JSON.parse(readFileSync(SCHEMA, 'utf8')));

  let failures = 0;

  for (const target of targets) {
    const problems = [];
    const fail = (message) => problems.push(message);

    const { outPath, stderr } = runTarget(target);

    let snapshot;
    try {
      snapshot = JSON.parse(readFileSync(outPath, 'utf8'));
    } catch {
      fail(`nenhum snapshot escrito${stderr ? ` — gdb: ${stderr.trim().split('\n').pop()}` : ''}`);
      report(target, problems);
      failures += 1;
      continue;
    }

    if (!validate(snapshot)) {
      for (const error of validate.errors.slice(0, 6)) {
        fail(`ajv ${error.instancePath || '/'} ${error.message}`);
      }
    }

    checkIntegrity(snapshot, fail);
    ASSERTIONS[target]?.(snapshot, fail);

    if (problems.length > 0) failures += 1;
    report(target, problems, snapshot);
  }

  console.log(
    `\n${targets.length - failures}/${targets.length} alvos ok sob GDB` +
      (failures > 0 ? ` — ${failures} com problema` : ''),
  );
  process.exit(failures > 0 ? 1 : 0);
}

function report(target, problems, snapshot) {
  if (problems.length === 0) {
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
