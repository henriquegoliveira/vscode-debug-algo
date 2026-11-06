import React, { useEffect, useRef } from 'react';
import { styles } from './CodePane.styles';

const KEYWORDS = new Set([
  'if',
  'else',
  'while',
  'for',
  'return',
  'static',
  'const',
  'typedef',
  'struct',
  'enum',
  'sizeof',
  'break',
  'continue',
  'NULL',
]);
const TYPES = new Set(['int', 'void', 'char', 'double', 'float', 'long', 'unsigned']);
const TOKEN = /(\/\/.*$|"(?:[^"\\]|\\.)*"|#\w+|\b\d+\b|\b[A-Za-z_]\w*\b)/g;

function styleOf(token: string): React.CSSProperties | undefined {
  if (token.startsWith('//')) {
    return styles.comment;
  }
  if (token.startsWith('"')) {
    return styles.string;
  }
  if (token.startsWith('#')) {
    return styles.directive;
  }
  if (/^\d/.test(token)) {
    return styles.number;
  }
  if (KEYWORDS.has(token)) {
    return styles.keyword;
  }
  if (TYPES.has(token) || /^[A-Z][a-z]\w*$/.test(token)) {
    return styles.type;
  }
  return undefined;
}

function highlight(text: string): React.ReactNode[] {
  return text.split(TOKEN).map((part, position) => {
    const style = position % 2 === 1 ? styleOf(part) : undefined;
    return style === undefined ? (
      part
    ) : (
      <span key={position} style={style}>
        {part}
      </span>
    );
  });
}

export const CodePane: React.FC<{ source: string; line: number | null }> = ({ source, line }) => {
  const paneRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const pane = paneRef.current;
    const current = currentRef.current;
    if (pane !== null && current !== null) {
      pane.scrollTop = current.offsetTop - (pane.clientHeight - current.offsetHeight) / 2;
    }
  }, [line]);

  return (
    <div ref={paneRef} style={styles.pane}>
      {source.split('\n').map((text, position) => {
        const number = position + 1;
        const current = number === line;
        return (
          <div
            key={number}
            ref={current ? currentRef : undefined}
            style={current ? styles.current : styles.line}
          >
            <span style={styles.gutter}>
              {current ? <span style={styles.arrow}>{'➜ '}</span> : null}
              {number}
            </span>
            <span>{highlight(text)}</span>
          </div>
        );
      })}
    </div>
  );
};
