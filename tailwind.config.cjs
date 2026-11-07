/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Instrument Serif"', 'Georgia', 'serif'],
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
      },
      colors: {
        ink: {
          50: '#f6f6f9',
          100: '#ececf2',
          200: '#d5d5e2',
          300: '#b1b1c9',
          400: '#8686a7',
          500: '#676789',
          600: '#52526f',
          700: '#24243d',
          800: '#16162a',
          900: '#0d0d16',
          950: '#07070c',
        },
        brand: {
          50: '#f2f0ff',
          100: '#e6e2ff',
          200: '#cfc8ff',
          300: '#afa2ff',
          400: '#8b75ff',
          500: '#6c5cff',
          600: '#5a45f5',
          700: '#4a35d6',
          800: '#3d2bb0',
          900: '#33258c',
          950: '#1d1354',
        },
      },
      boxShadow: {
        '2xs': '0 1px 2px rgba(16,16,40,.03)',
        xs: '0 1px 3px rgba(16,16,40,.05)',
        soft: '0 1px 2px rgba(16,16,40,.04), 0 4px 16px -4px rgba(16,16,40,.08)',
        lift: '0 4px 12px rgba(16,16,40,.05), 0 24px 48px -12px rgba(16,16,40,.16)',
        glow: '0 0 0 1px rgba(108,92,255,.3), 0 12px 36px -6px rgba(90,69,245,.45)',
        'glow-emerald': '0 0 0 1px rgba(16,185,129,.3), 0 12px 32px -6px rgba(16,185,129,.35)',
        'glow-rose': '0 0 0 1px rgba(244,63,94,.3), 0 12px 32px -6px rgba(244,63,94,.35)',
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'fade-in': 'fadeIn .3s cubic-bezier(.16,1,.3,1)',
        'slide-up': 'slideUp .4s cubic-bezier(.16,1,.3,1)',
        float: 'float 6s ease-in-out infinite',
        shimmer: 'shimmer 2.5s linear infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(14px) scale(0.99)' }, '100%': { opacity: '1', transform: 'translateY(0) scale(1)' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
    },
  },
  plugins: [],
};
