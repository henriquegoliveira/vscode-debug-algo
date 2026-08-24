import * as vscode from 'vscode';
import { ExtractionOptions } from './extractorInvoker';

const SECTION = 'dbgAlgo';
const DYNAMIC_ARRAYS = 'dynamicArrays';

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
  if (typeof maxNodes === 'number' || typeof maxEdges === 'number') {
    options.limits = {};
    if (typeof maxNodes === 'number') options.limits.maxNodes = maxNodes;
    if (typeof maxEdges === 'number') options.limits.maxEdges = maxEdges;
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
