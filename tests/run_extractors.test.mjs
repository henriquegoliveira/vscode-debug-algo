import { describe, expect, it } from 'vitest';
import { MINGW_ABI_COMMAND as EXTENSION_MINGW_ABI_COMMAND } from '../packages/extension/src/debug/mingwAbi';
import { MINGW_ABI_COMMAND, parseArguments } from './run_extractors.mjs';

describe('MINGW_ABI_COMMAND', () => {
  it('is the command the extension adds to every lldb session on Windows', () => {
    expect(MINGW_ABI_COMMAND).toBe(EXTENSION_MINGW_ABI_COMMAND);
  });
});

describe('parseArguments', () => {
  it('runs both debuggers without a report file by default', () => {
    expect(parseArguments(['linked_list_simple'])).toEqual({
      keys: ['gdb', 'lldb'],
      names: ['linked_list_simple'],
      update: false,
      json: null,
    });
  });

  it('takes the report file from the argument after --json', () => {
    expect(parseArguments(['--gdb', '--json', 'reports/harness.json', 'huffman'])).toEqual({
      keys: ['gdb'],
      names: ['huffman'],
      update: false,
      json: 'reports/harness.json',
    });
  });

  it('refuses --json without a file', () => {
    expect(() => parseArguments(['--json'])).toThrow();
    expect(() => parseArguments(['--json', '--gdb'])).toThrow();
  });
});
