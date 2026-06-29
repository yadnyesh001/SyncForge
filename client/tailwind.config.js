/**
 * tailwind.config.js
 * darkMode 'class' so the ThemeContext can toggle dark mode by adding/removing
 * the `dark` class on <html>.
 */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
