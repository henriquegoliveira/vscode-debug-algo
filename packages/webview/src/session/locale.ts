import * as l10n from '@vscode/l10n';
import type { LocaleMessage } from 'dbga-contract';

export function applyLocale(message: LocaleMessage): void {
  document.documentElement.lang = message.language;
  if (message.bundle !== undefined) {
    l10n.config({ contents: message.bundle });
  }
}
