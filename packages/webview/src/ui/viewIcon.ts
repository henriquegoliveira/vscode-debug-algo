import type { LayoutChoice, LayoutKind } from '../model/layoutRule';
import type { ViewMode } from '../session/persistence';
import list from './viewIcons/list.svg';
import recursion from './viewIcons/recursion.svg';
import sorting from './viewIcons/sorting.svg';
import tree from './viewIcons/tree.svg';

export function viewIcon(
  viewMode: ViewMode,
  choice: LayoutChoice,
  layout: LayoutKind | null,
): string {
  if (viewMode === 'recursion') {
    return recursion;
  }
  if (viewMode === 'sorting') {
    return sorting;
  }
  const drawn = choice === 'auto' ? layout : choice;
  return drawn === 'hierarchical' ? tree : list;
}
