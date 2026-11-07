export type ThemeMode = 'dark' | 'light';

const STORAGE_KEY_THEME = 'yesorno_theme_v1';

export function getInitialTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_THEME);
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    return 'dark';
  } catch {
    return 'dark';
  }
}

export function applyTheme(theme: ThemeMode): void {
  try {
    localStorage.setItem(STORAGE_KEY_THEME, theme);
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      if (theme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  } catch (err) {
    console.warn('Failed to apply theme:', err);
  }
}

