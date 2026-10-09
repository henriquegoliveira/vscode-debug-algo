const BASELINE_PLATFORM = 'linux';

const WINDOWS_DIVERGENCE = {
  linked_list_simple: ['baseline'],
  linked_list_cyclic: ['baseline'],
  huffman: ['baseline', 'parity'],
  class_reference: ['parity'],
  garbage_pointer: ['parity'],
  scalar_values: ['baseline'],
  scalar_values_c: ['baseline'],
  sorting_quick_random: ['baseline'],
  'sorting_merge#timeline': ['baseline'],
};

const UNINITIALIZED_READS = {
  linked_list_simple: ['baseline', 'parity'],
  linked_list_cyclic: ['baseline', 'parity'],
  garbage_pointer: ['baseline', 'parity'],
  huffman: ['baseline', 'parity'],
};

export function declaredDivergence(label, platform, kind, env = process.env) {
  if (platform !== BASELINE_PLATFORM && (WINDOWS_DIVERGENCE[label] ?? []).includes(kind)) {
    return true;
  }
  return !stackGarbageIsStable(platform, env) && (UNINITIALIZED_READS[label] ?? []).includes(kind);
}

export function stackGarbageIsStable(platform, env = process.env) {
  return platform === BASELINE_PLATFORM && !env.DBGA_FOREIGN_STACK;
}
