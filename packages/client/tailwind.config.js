/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        surface2: 'var(--surface2)',
        border: 'var(--border)',
        'border-light': 'var(--border-light)',
        text: 'var(--text)',
        'text-muted': 'var(--text-muted)',
        'text-dim': 'var(--text-dim)',
        primary: 'var(--primary)',
        'primary-light': 'var(--primary-light)',
        'primary-glow': 'var(--primary-glow)',
        accent: 'var(--accent)',
        'accent-glow': 'var(--accent-glow)',
        teal: 'var(--teal)',
        danger: 'var(--danger)',
        // Brand alias → maps to primary for backward compat
        brand: {
          50: 'rgba(123,108,255,0.08)',
          100: 'rgba(123,108,255,0.15)',
          200: 'rgba(123,108,255,0.25)',
          300: 'var(--primary-light)',
          400: 'var(--primary-light)',
          500: 'var(--primary)',
          600: 'var(--primary)',
          700: 'var(--primary)',
          800: 'var(--primary)',
          900: 'var(--primary)',
        },
      },
      fontFamily: {
        display: ['"DM Serif Display"', 'serif'],
        body: ['Outfit', 'sans-serif'],
        mono: ['"DM Mono"', 'monospace'],
      },
      borderColor: {
        DEFAULT: 'var(--border)',
      },
      animation: {
        'fade-up': 'fadeUp 0.4s ease-out forwards',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
