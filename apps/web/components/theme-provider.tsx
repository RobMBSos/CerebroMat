'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

type Theme = 'light' | 'dark';

type ThemeContextValue = {
  theme: Theme;
  ready: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const THEME_KEY = 'cerebromat_theme';

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initial: Theme = stored === 'dark' || stored === 'light' ? stored : prefersDark ? 'dark' : 'light';

    setThemeState(initial);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) {
      return;
    }

    document.documentElement.classList.toggle('dark', theme === 'dark');
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme, ready]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      ready,
      setTheme: setThemeState,
      toggleTheme: () => setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark')),
    }),
    [theme, ready],
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Provider = ThemeContext.Provider as any;
  return <Provider value={value}>{children}</Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }
  return context;
}
