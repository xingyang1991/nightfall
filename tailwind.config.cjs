/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./App.tsx",
    "./index.tsx",
    "./a2ui/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./runtime/**/*.{ts,tsx}",
    "./services/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {}
  },
  plugins: [require("tailwindcss-animate")]
};
