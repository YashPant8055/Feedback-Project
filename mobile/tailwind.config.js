/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx}", "./src/**/*.{js,jsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        sky: "#d7f0ff",
        mint: "#d8ffdb",
        ink: "#102033",
        accent: "#ff7a59",
        grass: "#58b95f",
      },
    },
  },
  plugins: [],
};
