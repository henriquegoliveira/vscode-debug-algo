import type { Value } from 'dbga-contract';

const TRUNCATION_MARK = '…';

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
      return value.truncated ? `"${value.v}${TRUNCATION_MARK}"` : `"${value.v}"`;
    case 'opaque':
      return `<${value.reason}>`;
  }
}

function formatReal(v: number | null, special: 'nan' | 'inf' | '-inf' | undefined): string {
  if (v !== null) {
    return String(v);
  }

  return special === undefined ? '<null>' : special;
}
