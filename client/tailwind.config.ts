import typography from '@tailwindcss/typography'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        theme: 'rgb(var(--theme-rgb) / <alpha-value>)',
        'theme-hover': 'rgb(var(--theme-hover-rgb) / <alpha-value>)',
        'theme-active': 'rgb(var(--theme-active-rgb) / <alpha-value>)',
        background: {
          light: '#f5f5f5',
          dark: '#1c1c1e',
        },
        dark: '#333333',
      },
      transitionProperty: {
        height: 'height',
        width: 'width',
        spacing: 'margin, padding',
      },
    },
  },
  plugins: [typography],
}
