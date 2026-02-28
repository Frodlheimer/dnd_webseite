import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        shell: {
          sidebar: '#111827',
          board: '#0f172a',
          panel: '#111827'
        }
      }
    }
  },
  plugins: []
} satisfies Config;
