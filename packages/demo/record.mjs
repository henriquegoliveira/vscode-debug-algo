import { execFileSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const TARGET = 'red_black_tree';
const OUTPUT = path.join(ROOT, 'tests', 'output');
const DESTINATION = path.join(HERE, 'snapshots', `${TARGET}.json`);

execFileSync('make', ['-C', path.join(ROOT, 'tests', 'targets')], { stdio: 'inherit' });
execFileSync('node', [path.join(ROOT, 'tests', 'run_extractors.mjs'), '--gdb', TARGET], {
  stdio: 'inherit',
});

const timeline = JSON.parse(
  readFileSync(path.join(ROOT, 'tests', 'expected', 'timelines', `${TARGET}.json`), 'utf8'),
);
const snapshots = timeline.map((_, position) =>
  JSON.parse(readFileSync(path.join(OUTPUT, `${TARGET}.timeline.${position}.gdb.json`), 'utf8')),
);

writeFileSync(DESTINATION, `${JSON.stringify(snapshots)}\n`);
console.log(`${snapshots.length} pauses written to ${path.relative(ROOT, DESTINATION)}`);
