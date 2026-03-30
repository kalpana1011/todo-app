/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/main.js",               // or "./src/**/*.{js,ts,jsx,tsx}" if you move files later
  ],
  theme: {
    extend: {
      colors: {
        app: {
          bg: "#0f1113",
          card: "#1b1f24",
          accent: "#28F6BF",
          text: "#ECEDEF",
          sub: "#9AA3AF",
        },
      },
      borderRadius: { '2xl': '1rem' },
    },
  },
  plugins: [],
};
