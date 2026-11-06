import * as l10n from '@vscode/l10n';
import React from 'react';
import { createRoot } from 'react-dom/client';
import portuguese from '../../extension/l10n/bundle.l10n.pt-br.json';
import { Demo } from './Demo';

function pickLanguage(): string {
  const requested = new URLSearchParams(window.location.search).get('lang');
  if (requested === 'en' || requested === 'pt-br') {
    return requested;
  }
  return navigator.language.toLowerCase().startsWith('pt') ? 'pt-br' : 'en';
}

const language = pickLanguage();
const bundle: Record<string, string> | undefined = language === 'pt-br' ? portuguese : undefined;

if (bundle !== undefined) {
  l10n.config({ contents: bundle });
}
document.documentElement.lang = language;

const container = document.getElementById('root');

if (container) {
  createRoot(container).render(<Demo language={language} bundle={bundle} />);
} else {
  console.error('Root element not found in the HTML.');
}
