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
          50: 'rgb(var(--brand-50) / <alpha-value>)',
          100: 'rgb(var(--brand-100) / <alpha-value>)',
          200: 'rgb(var(--brand-200) / <alpha-value>)',
          300: 'rgb(var(--brand-300) / <alpha-value>)',
          400: 'rgb(var(--brand-400) / <alpha-value>)',
          500: 'rgb(var(--brand-500) / <alpha-value>)',
          600: 'rgb(var(--brand-600) / <alpha-value>)',
          700: 'rgb(var(--brand-700) / <alpha-value>)',
          800: 'rgb(var(--brand-800) / <alpha-value>)',
          900: 'rgb(var(--brand-900) / <alpha-value>)',
          950: 'rgb(var(--brand-950) / <alpha-value>)',
        },
      },
      boxShadow: {
        '2xs': '0 1px 2px rgba(16,16,40,.03)',
        xs: '0 1px 3px rgba(16,16,40,.05)',
        soft: '0 1px 2px rgba(16,16,40,.04), 0 4px 16px -4px rgba(16,16,40,.08)',
        lift: '0 4px 12px rgba(16,16,40,.05), 0 24px 48px -12px rgba(16,16,40,.16)',
        glow: 'var(--shadow-glow)',
        'glow-emerald': 'var(--shadow-glow-emerald)',
        'glow-rose': 'var(--shadow-glow-rose)',
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
