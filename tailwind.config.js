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