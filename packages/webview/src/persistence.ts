import { hostApi, isEmbedded } from './channel';
import type { LayoutChoice } from './layout';

const STORAGE_KEY = 'dbga.viewState';

const CHOICES: LayoutChoice[] = ['auto', 'physics', 'hierarchical'];
const MODES: FrameMode[] = ['current', 'all'];
export const VIEW_MODES: ViewMode[] = ['graph', 'recursion'];

export const MIN_COLUMN_WIDTH = 180;
export const MAX_COLUMN_WIDTH = 640;

export type FrameMode = 'current' | 'all';

export type ViewMode = 'graph' | 'recursion';

export type FieldChoice = 'all' | 'none' | string[];

export interface Camera {
  scale: number;
  x: number;
  y: number;
}

export interface FileView {
  layoutChoice: LayoutChoice;
  nullTerminals: boolean;
  frameMode: FrameMode;
  follow: boolean;
  fields: Record<string, FieldChoice>;
  viewMode: ViewMode;
}

export interface PanelState {
  selectedId: string | null;
  columnScroll: number;
  columnWidth: number;
  columnOpen: boolean;
  frames: string[] | null;
  camera: Camera | null;
  views: Record<string, FileView>;
}

export const DEFAULT_FILE_VIEW: FileView = {
  layoutChoice: 'auto',
  nullTerminals: false,
  frameMode: 'current',
  follow: false,
  fields: {},
  viewMode: 'graph',
};

export const DEFAULT_PANEL_STATE: PanelState = {
  selectedId: null,
  columnScroll: 0,
  columnWidth: 260,
  columnOpen: false,
  frames: null,
  camera: null,
  views: {},
};

export const MIN_SCALE = 0.1;
export const MAX_SCALE = 4;

export function readPanelState(): PanelState {
  return coercePanel(isEmbedded() ? hostApi()?.getState() : fromLocalStorage());
}

export function writePanelState(state: PanelState): void {
  if (isEmbedded()) {
    hostApi()?.setState(state);
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    return;
  }
}

export function coercePanel(stored: unknown): PanelState {
  const raw = asRecord(stored);
  if (raw === null) {
    return { ...DEFAULT_PANEL_STATE, views: {} };
  }

  return {
    selectedId: typeof raw.selectedId === 'string' ? raw.selectedId : null,
    columnScroll: finite(
      raw.columnScroll,
      DEFAULT_PANEL_STATE.columnScroll,
      0,
      Number.MAX_SAFE_INTEGER,
    ),
    columnWidth: finite(
      raw.columnWidth,
      DEFAULT_PANEL_STATE.columnWidth,
      MIN_COLUMN_WIDTH,
      MAX_COLUMN_WIDTH,
    ),
    columnOpen:
      typeof raw.columnOpen === 'boolean' ? raw.columnOpen : DEFAULT_PANEL_STATE.columnOpen,
    frames: stringList(raw.frames),
    camera: coerceCamera(raw.camera),
    views: coerceViews(raw.views),
  };
}

export function coerceCamera(stored: unknown): Camera | null {
  const raw = asRecord(stored);
  if (raw === null) {
    return null;
  }

  const { scale, x, y } = raw;
  if (![scale, x, y].every((value) => typeof value === 'number' && Number.isFinite(value))) {
    return null;
  }

  return {
    scale: Math.min(Math.max(scale as number, MIN_SCALE), MAX_SCALE),
    x: x as number,
    y: y as number,
  };
}

export function coerceViews(stored: unknown): Record<string, FileView> {
  const raw = asRecord(stored);
  if (raw === null) {
    return {};
  }

  const views: Record<string, FileView> = {};
  Object.keys(raw).forEach((file) => {
    views[file] = coerceFile(raw[file]);
  });

  return views;
}

export function coerceFile(stored: unknown): FileView {
  const raw = asRecord(stored);
  if (raw === null) {
    return { ...DEFAULT_FILE_VIEW, fields: {} };
  }

  return {
    layoutChoice: CHOICES.includes(raw.layoutChoice as LayoutChoice)
      ? (raw.layoutChoice as LayoutChoice)
      : DEFAULT_FILE_VIEW.layoutChoice,
    nullTerminals:
      typeof raw.nullTerminals === 'boolean' ? raw.nullTerminals : DEFAULT_FILE_VIEW.nullTerminals,
    frameMode: MODES.includes(raw.frameMode as FrameMode)
      ? (raw.frameMode as FrameMode)
      : DEFAULT_FILE_VIEW.frameMode,
    follow: typeof raw.follow === 'boolean' ? raw.follow : DEFAULT_FILE_VIEW.follow,
    fields: coerceFields(raw.fields),
    viewMode: VIEW_MODES.includes(raw.viewMode as ViewMode)
      ? (raw.viewMode as ViewMode)
      : DEFAULT_FILE_VIEW.viewMode,
  };
}

export function coerceFields(stored: unknown): Record<string, FieldChoice> {
  const raw = asRecord(stored);
  if (raw === null) {
    return {};
  }

  const fields: Record<string, FieldChoice> = {};

  Object.keys(raw).forEach((type) => {
    const choice = raw[type];

    if (choice === 'all' || choice === 'none') {
      fields[type] = choice;
      return;
    }

    const names = stringList(choice);
    if (names !== null) {
      fields[type] = names;
    }
  });

  return fields;
}

function stringList(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    return null;
  }

  return value as string[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function finite(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(value, min), max);
}

function fromLocalStorage(): unknown {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}
