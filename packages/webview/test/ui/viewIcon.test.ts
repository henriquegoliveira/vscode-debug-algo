import { describe, expect, it } from 'vitest';
import { viewIcon } from '../../src/ui/viewIcon';

describe('viewIcon', () => {
  it('gives each view its own icon', () => {
    const icons = [
      viewIcon('graph', 'hierarchical', null),
      viewIcon('graph', 'physics', null),
      viewIcon('recursion', 'hierarchical', null),
      viewIcon('sorting', 'hierarchical', null),
    ];

    expect(new Set(icons).size).toBe(4);
  });

  it('follows the layout the automatic choice resolved to', () => {
    expect(viewIcon('graph', 'auto', 'hierarchical')).toBe(viewIcon('graph', 'hierarchical', null));
    expect(viewIcon('graph', 'auto', 'physics')).toBe(viewIcon('graph', 'physics', null));
    expect(viewIcon('graph', 'auto', null)).toBe(viewIcon('graph', 'physics', null));
  });

  it('ignores the graph choice outside the graph view', () => {
    expect(viewIcon('recursion', 'physics', 'physics')).toBe(viewIcon('recursion', 'auto', null));
  });
});
