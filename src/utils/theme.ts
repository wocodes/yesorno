export type ThemeMode = 'dark' | 'light';
export type ColorTone = 'vibrant' | 'toned';

const STORAGE_KEY_THEME = 'yesorno_theme_v1';
const STORAGE_KEY_COLOR_TONE = 'yesorno_color_tone_v1';

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

export function getInitialColorTone(): ColorTone {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_COLOR_TONE);
    if (saved === 'vibrant' || saved === 'toned') {
      return saved;
    }
    return 'vibrant';
  } catch {
    return 'vibrant';
  }
}

export function applyColorTone(tone: ColorTone): void {
  try {
    localStorage.setItem(STORAGE_KEY_COLOR_TONE, tone);
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      if (tone === 'toned') {
        root.classList.add('tone-muted');
      } else {
        root.classList.remove('tone-muted');
      }
    }
  } catch (err) {
    console.warn('Failed to apply color tone:', err);
  }
}
