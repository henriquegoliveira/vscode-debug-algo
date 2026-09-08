export type CanvasNodeKind = 'record' | 'array' | 'opaque' | 'null' | 'root' | 'rootDegraded';

export type CardTier = 'type' | 'name' | 'field' | 'note';

export interface NodePalette {
  background: string;
  border: string;
  accent: string;
}

export type ChangeKind = 'created' | 'relinked' | 'valued';

export interface Theme {
  nodes: Record<CanvasNodeKind, NodePalette>;
  ink: { muted: string; value: string; address: string; divider: string };
  selection: string;
  grid: string;
  edge: { color: string; rootColor: string; label: string; labelBackground: string };
  change: Record<ChangeKind, string>;
  fontFace: string;
  text: Record<CardTier, number>;
  advance: Record<CardTier, number>;
}

export type TokenReader = (token: string) => string;

export type TextMeasurer = (size: number, face: string) => number;

export const FALLBACK_ADVANCE_RATIO = 0.6;

interface Slot {
  token: string;
  fallback: string;
}

interface SizeSlot {
  token: string;
  fallback: number;
}

const NODE_SURFACE: Slot = { token: '--vscode-editorWidget-background', fallback: '#252526' };

const NODE_SLOTS: Record<CanvasNodeKind, { border: Slot; accent: Slot }> = {
  record: {
    border: { token: '--vscode-charts-green', fallback: '#4ec9b0' },
    accent: { token: '--vscode-charts-green', fallback: '#4ec9b0' },
  },
  array: {
    border: { token: '--vscode-charts-purple', fallback: '#c586c0' },
    accent: { token: '--vscode-charts-purple', fallback: '#c586c0' },
  },
  opaque: {
    border: { token: '--vscode-editorWidget-border', fallback: '#454545' },
    accent: { token: '--vscode-descriptionForeground', fallback: '#a0a0a0' },
  },
  null: {
    border: { token: '--vscode-editorWidget-border', fallback: '#454545' },
    accent: { token: '--vscode-descriptionForeground', fallback: '#a0a0a0' },
  },
  root: {
    border: { token: '--vscode-charts-blue', fallback: '#569cd6' },
    accent: { token: '--vscode-charts-blue', fallback: '#569cd6' },
  },
  rootDegraded: {
    border: { token: '--vscode-charts-orange', fallback: '#ce9178' },
    accent: { token: '--vscode-charts-orange', fallback: '#ce9178' },
  },
};

const INK_SLOTS: Record<keyof Theme['ink'], Slot> = {
  muted: { token: '--vscode-descriptionForeground', fallback: '#a0a0a0' },
  value: { token: '--vscode-foreground', fallback: '#cccccc' },
  address: { token: '--vscode-charts-yellow', fallback: '#dcdcaa' },
  divider: { token: '--vscode-editorWidget-border', fallback: '#333333' },
};

const SELECTION_SLOT: Slot = { token: '--vscode-focusBorder', fallback: '#007fd4' };

const GRID_SLOT: Slot = { token: '--vscode-editorWidget-border', fallback: '#454545' };

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

const TEXT_SLOTS: Record<CardTier, SizeSlot> = {
  type: { token: '--dbga-text-meta', fallback: 11 },
  name: { token: '--dbga-text-body', fallback: 12 },
  field: { token: '--dbga-text-micro', fallback: 10 },
  note: { token: '--dbga-text-note', fallback: 9 },
};

const KINDS = Object.keys(NODE_SLOTS) as CanvasNodeKind[];

const TIERS = Object.keys(TEXT_SLOTS) as CardTier[];

export function resolveTheme(read: TokenReader, measure?: TextMeasurer): Theme {
  const pick = (slot: Slot): string => {
    const raw = read(slot.token);

    return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : slot.fallback;
  };

  const pickSize = (slot: SizeSlot): number => {
    const size = Number.parseFloat(read(slot.token));

    return Number.isFinite(size) && size > 0 ? size : slot.fallback;
  };

  const surface = pick(NODE_SURFACE);
  const nodes = {} as Record<CanvasNodeKind, NodePalette>;
  KINDS.forEach((kind) => {
    const slots = NODE_SLOTS[kind];
    nodes[kind] = {
      background: surface,
      border: pick(slots.border),
      accent: pick(slots.accent),
    };
  });

  const fontFace = pick(FONT_SLOT);
  const text = {} as Record<CardTier, number>;
  const advance = {} as Record<CardTier, number>;
  TIERS.forEach((tier) => {
    const size = pickSize(TEXT_SLOTS[tier]);
    const measured = measure === undefined ? 0 : measure(size, fontFace);

    text[tier] = size;
    advance[tier] = measured > 0 ? measured : size * FALLBACK_ADVANCE_RATIO;
  });

  return {
    nodes,
    ink: {
      muted: pick(INK_SLOTS.muted),
      value: pick(INK_SLOTS.value),
      address: pick(INK_SLOTS.address),
      divider: pick(INK_SLOTS.divider),
    },
    selection: pick(SELECTION_SLOT),
    grid: pick(GRID_SLOT),
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
    fontFace,
    text,
    advance,
  };
}

export function documentTokenReader(): TokenReader {
  const computed = getComputedStyle(document.documentElement);

  return (token) => computed.getPropertyValue(token);
}

export const FALLBACK_THEME: Theme = resolveTheme(() => '');
