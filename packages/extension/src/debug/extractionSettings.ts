import * as vscode from 'vscode';
import { ExtractionOptions } from './extractorInvoker';
import { DEFAULT_HISTORY_DEPTH } from '../channels/snapshotBroker';

const SECTION = 'dbgAlgo';
const DYNAMIC_ARRAYS = 'dynamicArrays';
const VIEW = 'view';

export function readExtractionOptions(): ExtractionOptions {
  const configuration = vscode.workspace.getConfiguration(SECTION);
  const options: ExtractionOptions = {};

  const dynamicArrays = configuration.get<string[]>(DYNAMIC_ARRAYS);
  if (Array.isArray(dynamicArrays) && dynamicArrays.length > 0) {
    options.dynamicArrays = dynamicArrays;
  }

  const rootFilter = configuration.get<string[]>('rootFilter');
  if (Array.isArray(rootFilter) && rootFilter.length > 0) {
    options.rootFilter = rootFilter;
  }

  const maxNodes = configuration.get<number>('limits.maxNodes');
  const maxEdges = configuration.get<number>('limits.maxEdges');
  const maxCells = configuration.get<number>('limits.maxCells');
  if (
    typeof maxNodes === 'number' ||
    typeof maxEdges === 'number' ||
    typeof maxCells === 'number'
  ) {
    options.limits = {};
    if (typeof maxNodes === 'number') options.limits.maxNodes = maxNodes;
    if (typeof maxEdges === 'number') options.limits.maxEdges = maxEdges;
    if (typeof maxCells === 'number') options.limits.maxCells = maxCells;
  }

  return options;
}

export async function appendDynamicArray(annotation: string): Promise<void> {
  const configuration = vscode.workspace.getConfiguration(SECTION);
  const current = configuration.get<string[]>(DYNAMIC_ARRAYS) ?? [];

  if (current.includes(annotation)) {
    return;
  }

  await configuration.update(
    DYNAMIC_ARRAYS,
    [...current, annotation],
    vscode.ConfigurationTarget.Workspace,
  );
}

export function readHistoryDepth(): number {
  const depth = vscode.workspace.getConfiguration(SECTION).get<number>('limits.historyDepth');
  return typeof depth === 'number' ? depth : DEFAULT_HISTORY_DEPTH;
}

export function readFileView(file: string | null): unknown {
  if (file === null) {
    return null;
  }

  return viewBucket()[file] ?? null;
}

const WRITE_DELAY = 400;

const pending = new Map<string, unknown>();
let timer: ReturnType<typeof setTimeout> | undefined;

export function saveFileView(file: string, state: unknown): void {
  pending.set(file, state);

  if (timer !== undefined) {
    clearTimeout(timer);
  }

  timer = setTimeout(() => {
    timer = undefined;
    void flushFileViews();
  }, WRITE_DELAY);
}

export async function flushFileViews(): Promise<void> {
  if (pending.size === 0) {
    return;
  }

  const batch = Object.fromEntries(pending);
  pending.clear();

  try {
    await vscode.workspace
      .getConfiguration(SECTION)
      .update(VIEW, { ...viewBucket(), ...batch }, vscode.ConfigurationTarget.Workspace);
  } catch (error) {
    void vscode.window.showErrorMessage(
      `DbgAlgo não conseguiu guardar a configuração da visualização: ${String(error)}`,
    );
  }
}

function viewBucket(): Record<string, unknown> {
  const stored = vscode.workspace.getConfiguration(SECTION).get<unknown>(VIEW);

  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) {
    return {};
  }

  return stored as Record<string, unknown>;
}
