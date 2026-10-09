import { describe, expect, it } from 'vitest';
import type { DebugConfiguration } from 'vscode';
import { MINGW_ABI_COMMAND, withMingwAbi } from '../../../src/debug/mingwAbi';

const launch = (extra: Partial<DebugConfiguration> = {}): DebugConfiguration => ({
  type: 'lldb',
  request: 'launch',
  name: 'target',
  program: 'C:/targets/bin/target.exe',
  ...extra,
});

describe('withMingwAbi', () => {
  it('reads the executable with the GNU ABI on Windows', () => {
    expect(withMingwAbi(launch(), 'win32').initCommands).toEqual([MINGW_ABI_COMMAND]);
  });

  it('leaves the configuration untouched on Linux', () => {
    const config = launch();

    expect(withMingwAbi(config, 'linux')).toBe(config);
  });

  it('leaves other debuggers untouched', () => {
    const config = launch({ type: 'cppdbg' });

    expect(withMingwAbi(config, 'win32')).toBe(config);
  });

  it('runs before the commands of the user, so theirs win', () => {
    const config = launch({ initCommands: ['settings set plugin.object-file.pe-coff.abi msvc'] });

    expect(withMingwAbi(config, 'win32').initCommands).toEqual([
      MINGW_ABI_COMMAND,
      'settings set plugin.object-file.pe-coff.abi msvc',
    ]);
    expect(config.initCommands).toHaveLength(1);
  });

  it('does not repeat the command', () => {
    const config = launch({ initCommands: [MINGW_ABI_COMMAND] });

    expect(withMingwAbi(config, 'win32')).toBe(config);
  });
});
