/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        nilebuilt: {
          DEFAULT: '#6B7EC2',
          dark: '#4A5A9B',
          light: '#8B9BD6',
          bg: '#EEF0F8',
          accent: '#3D4E8C',
        },
      },
    },
  },
  plugins: [],
};
