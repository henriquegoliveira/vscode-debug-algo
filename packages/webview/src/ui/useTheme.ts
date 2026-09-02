import { FALLBACK_THEME, Theme, documentTokenReader, resolveTheme } from './theme';
import { useEffect, useState } from 'react';

export function useTheme(): Theme {
  const [theme, setTheme] = useState<Theme>(() =>
    typeof document === 'undefined' ? FALLBACK_THEME : resolveTheme(documentTokenReader()),
  );

  useEffect(() => {
    let pending = 0;

    const refresh = () => {
      pending = 0;
      const next = resolveTheme(documentTokenReader());
      setTheme((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next));
    };

    const schedule = () => {
      if (pending === 0) {
        pending = window.requestAnimationFrame(refresh);
      }
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, { attributes: true });
    observer.observe(document.body, { attributes: true });
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });

    return () => {
      observer.disconnect();
      if (pending !== 0) {
        window.cancelAnimationFrame(pending);
      }
    };
  }, []);

  return theme;
}
