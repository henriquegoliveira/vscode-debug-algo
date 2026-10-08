import * as assert from 'assert';
import { readFileSync, readdirSync, statSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { firstDifference, normalize } from '../../../../tests/normalize.mjs';

const SNAPSHOT_FILE = /^dbg-algo-snapshot-\d+\.json$/;
const EXE = process.platform === 'win32' ? '.exe' : '';

const TARGETS = [
  { name: 'binary_search_tree', source: 'trees/binary_search_tree.c' },
  { name: 'class_reference', source: 'fixtures/class_reference.cpp' },
];

function testsFolder(): vscode.WorkspaceFolder {
  const folder = vscode.workspace.workspaceFolders?.[0];
  assert.ok(folder, 'the tests folder is not open');

  return folder;
}

function breakpointAt(file: string): vscode.SourceBreakpoint {
  const line = readFileSync(file, 'utf8')
    .split('\n')
    .findIndex((row) => row.includes('// BREAKPOINT'));
  assert.notStrictEqual(line, -1, `no // BREAKPOINT marker in ${file}`);

  return new vscode.SourceBreakpoint(
    new vscode.Location(vscode.Uri.file(file), new vscode.Position(line, 0)),
  );
}

function snapshotWrittenAfter(start: number): string | undefined {
  return readdirSync(tmpdir())
    .filter((name) => SNAPSHOT_FILE.test(name))
    .map((name) => path.join(tmpdir(), name))
    .find((file) => statSync(file).mtimeMs >= start);
}

async function waitForSnapshot(start: number, timeout = 45000): Promise<unknown> {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const file = snapshotWrittenAfter(start);
    if (file !== undefined) {
      return JSON.parse(readFileSync(file, 'utf8'));
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error('the extension wrote no snapshot before the timeout');
}

async function sessionEnded(): Promise<void> {
  if (vscode.debug.activeDebugSession === undefined) {
    return;
  }

  const ended = new Promise<void>((resolve) => {
    const listener = vscode.debug.onDidTerminateDebugSession(() => {
      listener.dispose();
      resolve();
    });
  });
  await vscode.debug.stopDebugging();
  await ended;
}

describe('a pause under CodeLLDB', () => {
  afterEach(async () => {
    await sessionEnded();
    vscode.debug.removeBreakpoints(vscode.debug.breakpoints);
  });

  TARGETS.forEach(({ name, source }) => {
    it(`extracts the same graph as the harness baseline for ${name}`, async () => {
      const folder = testsFolder();
      const root = folder.uri.fsPath;
      const expected = JSON.parse(
        readFileSync(path.join(root, 'expected', `${name}.json`), 'utf8'),
      );

      vscode.debug.addBreakpoints([breakpointAt(path.join(root, 'targets', source))]);

      const start = Date.now();
      const started = await vscode.debug.startDebugging(folder, {
        type: 'lldb',
        request: 'launch',
        name: `DebugAlgo integration: ${name}`,
        program: path.join(root, 'targets', 'bin', `${name}${EXE}`),
        cwd: path.join(root, 'targets'),
      });
      assert.ok(started, 'the debug session did not start');

      const actual = normalize(await waitForSnapshot(start));
      const difference = firstDifference(actual, expected);

      assert.strictEqual(difference, null, `first difference: ${JSON.stringify(difference)}`);
    });
  });
});
