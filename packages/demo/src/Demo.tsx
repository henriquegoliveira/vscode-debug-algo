import * as l10n from '@vscode/l10n';
import React, { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { GraphSnapshot } from 'dbga-contract';
import App from 'dbga-webview/src/App';
import { CodePane } from './CodePane';
import { Player } from './player';
import { styles } from './Demo.styles';
import logo from '../../extension/assets/icon.svg';
import source from '../../../tests/targets/trees/red_black_tree.c';
import snapshots from '../snapshots/red_black_tree.json';

const MARKETPLACE =
  'https://marketplace.visualstudio.com/items?itemName=henriquegoliveira.debug-algo';
const REPOSITORY = 'https://github.com/henriquegoliveira/vscode-debug-algo';

export const Demo: React.FC<{ language: string; bundle: Record<string, string> | undefined }> = ({
  language,
  bundle,
}) => {
  const player = useMemo(
    () => new Player(snapshots as unknown as GraphSnapshot[], language, bundle),
    [language, bundle],
  );
  const state = useSyncExternalStore(player.subscribe, player.snapshot);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'F5') {
        return;
      }
      event.preventDefault();
      if (event.ctrlKey && event.shiftKey) {
        player.restart();
      } else {
        player.next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [player]);

  const other = language === 'pt-br' ? 'en' : 'pt-br';

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.brand}>
          <img src={logo} style={styles.logo} alt="" />
          <span style={styles.title}>DebugAlgo</span>
          <span style={styles.badge}>{l10n.t('Interactive demo')}</span>
        </div>
        <div style={styles.controls}>
          <button
            type="button"
            className="dbga-chip"
            aria-pressed={!state.finished}
            disabled={state.finished}
            title={l10n.t('Run to the next pause')}
            onClick={() => player.next()}
          >
            {l10n.t('Continue (F5)')}
          </button>
          <button
            type="button"
            className="dbga-chip"
            title={l10n.t('Start the program again (Ctrl+Shift+F5)')}
            onClick={() => player.restart()}
          >
            {l10n.t('Restart')}
          </button>
          <span style={styles.status}>
            {state.finished
              ? l10n.t('Program finished')
              : l10n.t('Pause {0} of {1}', state.pause, state.total)}
          </span>
        </div>
        <span style={styles.spacer} />
        <a style={styles.link} href={`?lang=${other}`}>
          {other === 'pt-br' ? 'Português' : 'English'}
        </a>
        <a style={styles.link} href={REPOSITORY}>
          GitHub
        </a>
        <a style={styles.link} href={MARKETPLACE}>
          {l10n.t('Get the extension')}
        </a>
        <p style={styles.scenario}>
          {l10n.t(
            'A red-black tree in C receives the keys 50, 30, 70, 20, 40, 60, 80, 10 and 45. Each pause stops at fixInsertion, right after a key goes in and before the tree is rebalanced. Everything below the toolbar is the real DebugAlgo panel, fed with snapshots recorded under GDB.',
          )}
        </p>
      </header>
      <div style={styles.body}>
        <section style={styles.code}>
          <div style={styles.tab}>red_black_tree.c</div>
          <div style={styles.codeBody}>
            <CodePane source={source} line={state.line} />
          </div>
        </section>
        <main style={styles.visualizer}>
          <App connect={player.connect} />
        </main>
      </div>
    </div>
  );
};
