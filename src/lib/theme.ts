export const THEMES = ['light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_STORAGE_KEY = 'theme';

export const isTheme = (value: unknown): value is Theme => THEMES.includes(value as Theme);

export const getTheme = (): Theme => {
  const current = document.documentElement.dataset.theme;
  return isTheme(current) ? current : 'dark';
};

/** Önizleme renkleri (tema menüsündeki küçük örnek kutular için). */
export const THEME_SWATCH: Record<Theme, [string, string]> = {
  light: ['#F8FAFC', '#E11D48'],
  dark: ['#0A0A10', '#E11D48'],
};

export interface ThemeChangeDetail {
  theme: Theme;
  /** Kullanıcı bilerek seçtiyse true (cihaz tercihi takibinde false) */
  persist: boolean;
}

/** Temayı uygular; persist=true ise tercih kaydedilir (kayıtlı tercih cihaz tercihinin önüne geçer). */
export function setTheme(theme: Theme, persist = true) {
  document.documentElement.dataset.theme = theme;
  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      /* depolama kapalı olabilir */
    }
  }
  window.dispatchEvent(new CustomEvent<ThemeChangeDetail>('themechange', { detail: { theme, persist } }));
}

export const toggleTheme = () => setTheme(getTheme() === 'dark' ? 'light' : 'dark');
