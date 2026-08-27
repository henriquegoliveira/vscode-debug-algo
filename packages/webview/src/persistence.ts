import { hostApi, isEmbedded } from './channel';
import type { LayoutChoice } from './layout';

const STORAGE_KEY = 'dbga.viewState';

const CHOICES: LayoutChoice[] = ['auto', 'physics', 'hierarchical'];

export const MIN_COLUMN_WIDTH = 180;
export const MAX_COLUMN_WIDTH = 640;

export interface ViewState {
  layoutChoice: LayoutChoice;
  nullTerminals: boolean;
  selectedId: string | null;
  columnScroll: number;
  columnWidth: number;
  columnOpen: boolean;
}

export const DEFAULT_VIEW_STATE: ViewState = {
  layoutChoice: 'auto',
  nullTerminals: false,
  selectedId: null,
  columnScroll: 0,
  columnWidth: 260,
  columnOpen: false,
};

export function readViewState(): ViewState {
  return coerce(isEmbedded() ? hostApi()?.getState() : fromLocalStorage());
}

export function writeViewState(state: ViewState): void {
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

export function coerce(stored: unknown): ViewState {
  if (typeof stored !== 'object' || stored === null) {
    return { ...DEFAULT_VIEW_STATE };
  }

  const raw = stored as Record<string, unknown>;

  return {
    layoutChoice: CHOICES.includes(raw.layoutChoice as LayoutChoice)
      ? (raw.layoutChoice as LayoutChoice)
      : DEFAULT_VIEW_STATE.layoutChoice,
    nullTerminals:
      typeof raw.nullTerminals === 'boolean' ? raw.nullTerminals : DEFAULT_VIEW_STATE.nullTerminals,
    selectedId: typeof raw.selectedId === 'string' ? raw.selectedId : null,
    columnScroll: finite(
      raw.columnScroll,
      DEFAULT_VIEW_STATE.columnScroll,
      0,
      Number.MAX_SAFE_INTEGER,
    ),
    columnWidth: finite(
      raw.columnWidth,
      DEFAULT_VIEW_STATE.columnWidth,
      MIN_COLUMN_WIDTH,
      MAX_COLUMN_WIDTH,
    ),
    columnOpen:
      typeof raw.columnOpen === 'boolean' ? raw.columnOpen : DEFAULT_VIEW_STATE.columnOpen,
  };
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
