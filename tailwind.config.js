/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  plugins: [
    require('@tailwindcss/typography'),
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#EEF1FE',
          100: '#D8E0FD',
          200: '#B1C1FB',
          300: '#8BA2F9',
          400: '#6483F7',
          500: '#1E3FD8', // Main brand color
          600: '#1832AD',
          700: '#122682',
          800: '#0C1B57',
          900: '#060D2B',
        },
        success: {
          50: '#ECFDF5',
          500: '#10B981',
        },
        warning: {
          50: '#FFFBEB',
          500: '#F59E0B',
        },
        error: {
          50: '#FEF2F2',
          500: '#EF4444',
        }
      },
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
      },
    },
  },
};
