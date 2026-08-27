import type { Value } from 'dbga-contract';

const TRUNCATION_MARK = '…';

const NAMED_ESCAPES: Record<number, string> = { 9: '\\t', 10: '\\n', 13: '\\r' };

export function formatValue(value: Value | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  switch (value.t) {
    case 'int':
      return value.hex === undefined ? String(value.v) : value.hex;
    case 'real':
      return formatReal(value.v, value.special);
    case 'bool':
      return value.v ? 'true' : 'false';
    case 'char':
      return `'${value.text}' (${value.v})`;
    case 'enum':
      return value.name ?? String(value.v);
    case 'text':
      return value.truncated
        ? `"${escapeControls(value.v)}${TRUNCATION_MARK}"`
        : `"${escapeControls(value.v)}"`;
    case 'opaque':
      return `<${value.reason}>`;
  }
}

function escapeControls(text: string): string {
  let escaped = '';

  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;

    if (code > 31 && code !== 127) {
      escaped += character;
      continue;
    }

    escaped += NAMED_ESCAPES[code] ?? `\\x${code.toString(16).padStart(2, '0')}`;
  }

  return escaped;
}

function formatReal(v: number | null, special: 'nan' | 'inf' | '-inf' | undefined): string {
  if (v !== null) {
    return String(v);
  }

  return special === undefined ? '<null>' : special;
}
