/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    screens: {
      'xs': '320px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
    extend: {
      // Tons de fundo e borda do modo claro mais suaves que o branco puro (menos brilho
      // na tela). Só fundos e bordas mudam: texto branco em botões continua branco.
      // Os valores ficam em src/index.css (--nc-*).
      backgroundColor: {
        white: 'rgb(var(--nc-surface) / <alpha-value>)',
        // Modo escuro "ardósia": cinza médio em vez de preto, para cansar menos a vista.
        // gray = página e áreas internas; slate = cartões (um degrau acima da página).
        gray: {
          50: 'rgb(var(--nc-page) / <alpha-value>)',
          100: 'rgb(var(--nc-muted) / <alpha-value>)',
          700: 'rgb(74 82 96 / <alpha-value>)',
          800: 'rgb(58 65 77 / <alpha-value>)',
          900: 'rgb(43 49 59 / <alpha-value>)',
          950: 'rgb(37 42 51 / <alpha-value>)',
        },
        slate: {
          50: 'rgb(var(--nc-page) / <alpha-value>)',
          100: 'rgb(var(--nc-muted) / <alpha-value>)',
          700: 'rgb(78 87 101 / <alpha-value>)',
          800: 'rgb(63 71 84 / <alpha-value>)',
          900: 'rgb(52 59 70 / <alpha-value>)',
          950: 'rgb(43 49 59 / <alpha-value>)',
        },
      },
      borderColor: {
        gray: {
          100: 'rgb(var(--nc-border-soft) / <alpha-value>)',
          200: 'rgb(var(--nc-border) / <alpha-value>)',
          700: 'rgb(84 93 108 / <alpha-value>)',
          800: 'rgb(70 78 92 / <alpha-value>)',
        },
        slate: {
          100: 'rgb(var(--nc-border-soft) / <alpha-value>)',
          200: 'rgb(var(--nc-border) / <alpha-value>)',
          700: 'rgb(84 93 108 / <alpha-value>)',
          800: 'rgb(70 78 92 / <alpha-value>)',
        },
      },
      gradientColorStops: {
        white: 'rgb(var(--nc-surface) / <alpha-value>)',
      },
      colors: {
        green: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
      },
      keyframes: {
        slideDown: {
          '0%': {
            transform: 'translate(-50%, -150%)',
            opacity: '0',
            scale: '0.9'
          },
          '100%': {
            transform: 'translate(-50%, 0)',
            opacity: '1',
            scale: '1'
          },
        },
        bounce: {
          '0%, 100%': { transform: 'translate(-50%, 0) scale(1)' },
          '50%': { transform: 'translate(-50%, -10px) scale(1.02)' },
        },
      },
      animation: {
        slideDown: 'slideDown 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        bounce: 'bounce 0.6s ease-in-out',
      },
    },
  },
  plugins: [],
};