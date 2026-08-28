export type CanvasNodeKind = 'record' | 'array' | 'opaque' | 'null' | 'root' | 'rootDegraded';

export interface NodePalette {
  background: string;
  border: string;
  text: string;
}

export type ChangeKind = 'created' | 'relinked' | 'valued';

export interface Theme {
  nodes: Record<CanvasNodeKind, NodePalette>;
  edge: { color: string; rootColor: string; label: string; labelBackground: string };
  change: Record<ChangeKind, string>;
  fontFace: string;
}

export type TokenReader = (token: string) => string;

interface Slot {
  token: string;
  fallback: string;
}

const NODE_SLOTS: Record<CanvasNodeKind, Record<keyof NodePalette, Slot>> = {
  record: {
    background: { token: '--vscode-charts-green', fallback: '#4ec9b0' },
    border: { token: '--vscode-charts-lines', fallback: '#2d7d6c' },
    text: { token: '--vscode-editor-background', fallback: '#101010' },
  },
  array: {
    background: { token: '--vscode-charts-purple', fallback: '#c586c0' },
    border: { token: '--vscode-charts-lines', fallback: '#7d5279' },
    text: { token: '--vscode-editor-background', fallback: '#101010' },
  },
  opaque: {
    background: { token: '--vscode-editorWidget-background', fallback: '#5a5a5a' },
    border: { token: '--vscode-panel-border', fallback: '#8a8a8a' },
    text: { token: '--vscode-editorWidget-foreground', fallback: '#e0e0e0' },
  },
  null: {
    background: { token: '--vscode-editorWidget-background', fallback: '#3a3a3a' },
    border: { token: '--vscode-panel-border', fallback: '#8a8a8a' },
    text: { token: '--vscode-descriptionForeground', fallback: '#c0c0c0' },
  },
  root: {
    background: { token: '--vscode-charts-blue', fallback: '#569cd6' },
    border: { token: '--vscode-charts-lines', fallback: '#2f6ea8' },
    text: { token: '--vscode-editor-background', fallback: '#101010' },
  },
  rootDegraded: {
    background: { token: '--vscode-editorWidget-background', fallback: '#4a4a4a' },
    border: { token: '--vscode-charts-orange', fallback: '#ce9178' },
    text: { token: '--vscode-charts-orange', fallback: '#ce9178' },
  },
};

const EDGE_SLOTS: Record<keyof Theme['edge'], Slot> = {
  color: { token: '--vscode-charts-lines', fallback: '#9a9a9a' },
  rootColor: { token: '--vscode-charts-blue', fallback: '#569cd6' },
  label: { token: '--vscode-editor-foreground', fallback: '#d4d4d4' },
  labelBackground: { token: '--vscode-editor-background', fallback: '#1e1e1e' },
};

const CHANGE_SLOT: Slot = { token: '--vscode-editor-foreground', fallback: '#d4d4d4' };

const CHANGE_SLOTS: Record<ChangeKind, Slot> = {
  created: CHANGE_SLOT,
  relinked: CHANGE_SLOT,
  valued: CHANGE_SLOT,
};

const FONT_SLOT: Slot = { token: '--vscode-editor-font-family', fallback: 'monospace' };

const KINDS = Object.keys(NODE_SLOTS) as CanvasNodeKind[];

export function resolveTheme(read: TokenReader): Theme {
  const pick = (slot: Slot): string => {
    const raw = read(slot.token);

    return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : slot.fallback;
  };

  const nodes = {} as Record<CanvasNodeKind, NodePalette>;
  KINDS.forEach((kind) => {
    const slots = NODE_SLOTS[kind];
    nodes[kind] = {
      background: pick(slots.background),
      border: pick(slots.border),
      text: pick(slots.text),
    };
  });

  return {
    nodes,
    edge: {
      color: pick(EDGE_SLOTS.color),
      rootColor: pick(EDGE_SLOTS.rootColor),
      label: pick(EDGE_SLOTS.label),
      labelBackground: pick(EDGE_SLOTS.labelBackground),
    },
    change: {
      created: pick(CHANGE_SLOTS.created),
      relinked: pick(CHANGE_SLOTS.relinked),
      valued: pick(CHANGE_SLOTS.valued),
    },
    fontFace: pick(FONT_SLOT),
  };
}

export function documentTokenReader(): TokenReader {
  const computed = getComputedStyle(document.documentElement);

  return (token) => computed.getPropertyValue(token);
}

export const FALLBACK_THEME: Theme = resolveTheme(() => '');
