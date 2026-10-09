import { describe, expect, it } from 'vitest';
import { MINGW_ABI_COMMAND as EXTENSION_MINGW_ABI_COMMAND } from '../packages/extension/src/debug/mingwAbi';
import { MINGW_ABI_COMMAND } from './run_extractors.mjs';

describe('MINGW_ABI_COMMAND', () => {
  it('is the command the extension adds to every lldb session on Windows', () => {
    expect(MINGW_ABI_COMMAND).toBe(EXTENSION_MINGW_ABI_COMMAND);
  });
});
