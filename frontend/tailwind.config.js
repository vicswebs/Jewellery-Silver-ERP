/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fdf8f0',
          100: '#f9edd9',
          200: '#f2d7b0',
          300: '#e9bb7d',
          400: '#df9a4a',
          500: '#d4842e',
          600: '#c66a22',
          700: '#a5511e',
          800: '#864120',
          900: '#6d371d',
        },
        gold: {
          400: '#f5c542',
          500: '#e6b325',
          600: '#c99a1a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
