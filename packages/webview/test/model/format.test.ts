import { describe, expect, it } from 'vitest';
import { fileName, formatValue, valueKey } from '../../src/model/format';

describe('formatValue', () => {
  it('prints each scalar kind', () => {
    expect(formatValue({ t: 'int', v: -3, signed: true })).toBe('-3');
    expect(formatValue({ t: 'int', v: 255, signed: false, hex: '0xff' })).toBe('0xff');
    expect(formatValue({ t: 'real', v: 2.5 })).toBe('2.5');
    expect(formatValue({ t: 'bool', v: false })).toBe('false');
    expect(formatValue({ t: 'char', v: 65, text: 'A' })).toBe("'A' (65)");
    expect(formatValue({ t: 'opaque', reason: 'optimizedOut' })).toBe('<optimizedOut>');
  });

  it('prints the special reals the extractor cannot carry as numbers', () => {
    expect(formatValue({ t: 'real', v: null, special: 'nan' })).toBe('nan');
    expect(formatValue({ t: 'real', v: null, special: '-inf' })).toBe('-inf');
  });

  it('falls back to the number of an enum without an exact enumerator', () => {
    expect(formatValue({ t: 'enum', v: 2, name: 'BLUE' })).toBe('BLUE');
    expect(formatValue({ t: 'enum', v: 99, name: null })).toBe('99');
  });

  it('escapes control characters and marks truncated text', () => {
    expect(formatValue({ t: 'text', v: 'a\tb\n\u0001', truncated: false })).toBe('"a\\tb\\n\\x01"');
    expect(formatValue({ t: 'text', v: 'abc', truncated: true })).toBe('"abc…"');
  });

  it('prints nothing for a missing value', () => {
    expect(formatValue(null)).toBe('');
    expect(formatValue(undefined)).toBe('');
  });
});

describe('valueKey', () => {
  it('tells apart values that print the same', () => {
    expect(valueKey({ t: 'int', v: 1, signed: true })).not.toBe(
      valueKey({ t: 'int', v: 1, signed: false }),
    );
    expect(valueKey({ t: 'text', v: 'ab', truncated: true })).not.toBe(
      valueKey({ t: 'text', v: 'ab', truncated: false }),
    );
  });
});

describe('fileName', () => {
  it('cuts POSIX and Windows paths', () => {
    expect(fileName('/home/user/list.c')).toBe('list.c');
    expect(fileName('C:\\Users\\user\\list.c')).toBe('list.c');
    expect(fileName('list.c')).toBe('list.c');
  });
});
