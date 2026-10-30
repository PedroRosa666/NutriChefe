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
      // Contraste mínimo de 4,5:1 (WCAG AA) no fundo creme. Texto branco sobre o verde dos
      // botões pedia um tom mais escuro: o 600 vira o antigo 700, e o hover (700) escurece junto.
      // Os textos verde e cinza escurecem só no modo claro (valores em src/index.css, --nc-text-*).
      // As outras cores de destaque (kcal, alertas, favoritos) seguem a mesma regra: no claro,
      // o texto 600 usa o tom 700.
      textColor: {
        emerald: { 600: 'rgb(var(--nc-text-emerald) / <alpha-value>)' },
        // 400 é o texto terciário (datas, horários) e os ícones de ação: no claro, 4,5:1 também.
        gray: {
          400: 'rgb(var(--nc-text-gray-soft) / <alpha-value>)',
          500: 'rgb(var(--nc-text-gray) / <alpha-value>)',
        },
        slate: {
          400: 'rgb(var(--nc-text-slate-soft) / <alpha-value>)',
          500: 'rgb(var(--nc-text-slate) / <alpha-value>)',
        },
        ...Object.fromEntries(
          ['orange', 'red', 'amber', 'rose', 'sky', 'blue', 'lime', 'pink'].map((c) => [
            c,
            { 600: `rgb(var(--nc-text-${c}) / <alpha-value>)` },
          ])
        ),
      },
      backgroundColor: {
        white: 'rgb(var(--nc-surface) / <alpha-value>)',
        emerald: { 600: '#047857', 700: '#065f46' },
        // Modo escuro "azul-noite": azul profundo e mais claro que preto, para as fotos
        // das receitas se destacarem sem cansar a vista. gray = página; slate = cartões.
        gray: {
          50: 'rgb(var(--nc-page) / <alpha-value>)',
          100: 'rgb(var(--nc-muted) / <alpha-value>)',
          700: 'rgb(64 75 104 / <alpha-value>)',
          800: 'rgb(46 55 80 / <alpha-value>)',
          900: 'rgb(30 37 56 / <alpha-value>)',
          950: 'rgb(25 31 48 / <alpha-value>)',
        },
        slate: {
          50: 'rgb(var(--nc-page) / <alpha-value>)',
          100: 'rgb(var(--nc-muted) / <alpha-value>)',
          700: 'rgb(70 82 113 / <alpha-value>)',
          800: 'rgb(54 64 92 / <alpha-value>)',
          900: 'rgb(40 48 72 / <alpha-value>)',
          950: 'rgb(30 37 56 / <alpha-value>)',
        },
      },
      borderColor: {
        gray: {
          100: 'rgb(var(--nc-border-soft) / <alpha-value>)',
          200: 'rgb(var(--nc-border) / <alpha-value>)',
          700: 'rgb(76 89 122 / <alpha-value>)',
          800: 'rgb(60 71 101 / <alpha-value>)',
        },
        slate: {
          100: 'rgb(var(--nc-border-soft) / <alpha-value>)',
          200: 'rgb(var(--nc-border) / <alpha-value>)',
          700: 'rgb(76 89 122 / <alpha-value>)',
          800: 'rgb(60 71 101 / <alpha-value>)',
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