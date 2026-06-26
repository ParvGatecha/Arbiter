/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkBg: "#0a0a0c",
        darkCard: "#121216",
        darkBorder: "#1e1e24",
      }
    },
  },
  plugins: [],
}
