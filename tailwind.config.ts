import type { Config } from 'tailwindcss';

// Renkler globals.css içindeki CSS değişkenlerinden gelir (RGB kanalları),
// böylece açık/koyu mod ve `bg-primary/40` gibi opaklık eklemeleri birlikte çalışır.
const color = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: color('bg'),
        fg: color('fg'),
        surface: color('surface'),
        line: color('line'),
        muted: color('muted'),
        primary: color('primary'),
        'primary-text': color('primary-text'),
        electric: color('electric'),
        night: color('night'),
        volt: color('volt'),
        ink: 'rgb(15 23 42 / <alpha-value>)',
      },
      fontFamily: {
        display: ['var(--font-body)', 'var(--font-body-ext)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'var(--font-body-ext)', 'system-ui', 'sans-serif'],
      },
      // Eski "cel" gölge adları korunur; değerleri yumuşak, gerçekçi gölgelerdir.
      boxShadow: {
        'cel-sm': '0 1px 2px 0 rgb(var(--shadow) / 0.06), 0 1px 3px 0 rgb(var(--shadow) / 0.08)',
        cel: '0 4px 12px -2px rgb(var(--shadow) / 0.12), 0 2px 4px -2px rgb(var(--shadow) / 0.08)',
        'cel-lg': '0 16px 40px -8px rgb(var(--shadow) / 0.25), 0 4px 10px -4px rgb(var(--shadow) / 0.1)',
      },
    },
  },
  plugins: [],
};

export default config;
