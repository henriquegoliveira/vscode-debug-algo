import * as assert from 'assert';
import * as vscode from 'vscode';
import manifest from '../../package.json';

const EXTENSION_ID = `${manifest.publisher}.${manifest.name}`;
const VIEW_TYPE = 'debugAlgoWebview';

async function eventually<T>(probe: () => T | undefined, timeout = 10000): Promise<T> {
  const deadline = Date.now() + timeout;

  for (;;) {
    const found = probe();
    if (found !== undefined) {
      return found;
    }
    if (Date.now() > deadline) {
      throw new Error('condition not met before the timeout');
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

function visualizerTab(): vscode.Tab | undefined {
  return vscode.window.tabGroups.all
    .flatMap((group) => group.tabs)
    .find(
      (tab) =>
        tab.input instanceof vscode.TabInputWebview && tab.input.viewType.includes(VIEW_TYPE),
    );
}

describe('DebugAlgo in a running VS Code', () => {
  before(async () => {
    await vscode.extensions.getExtension(EXTENSION_ID)?.activate();
  });

  it('is installed and active', () => {
    const extension = vscode.extensions.getExtension(EXTENSION_ID);

    assert.ok(extension, `${EXTENSION_ID} is not installed`);
    assert.strictEqual(extension.isActive, true);
  });

  it('registers every command it contributes', async () => {
    const registered = new Set(await vscode.commands.getCommands(true));

    manifest.contributes.commands.forEach(({ command }) => {
      assert.ok(registered.has(command), `${command} is not registered`);
    });
  });

  it('registers every contributed setting with its default', () => {
    const settings = vscode.workspace.getConfiguration();

    Object.entries(manifest.contributes.configuration.properties).forEach(([key, schema]) => {
      assert.deepStrictEqual(settings.inspect(key)?.defaultValue, schema.default, key);
    });
  });

  it('opens the visualizer panel from the command palette', async () => {
    await vscode.commands.executeCommand('debug-algo.start');

    const tab = await eventually(visualizerTab);

    assert.ok(tab.input instanceof vscode.TabInputWebview);
    await vscode.window.tabGroups.close(tab);
  });
});
