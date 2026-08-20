import * as vscode from 'vscode';
import { ExtractionOptions } from './extractorInvoker';

const SECTION = 'dbgAlgo';

export function readExtractionOptions(): ExtractionOptions {
  const configuration = vscode.workspace.getConfiguration(SECTION);
  const options: ExtractionOptions = {};

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
