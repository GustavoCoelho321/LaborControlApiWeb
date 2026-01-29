/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dhl: {
          yellow: '#FFCC00', // Amarelo DHL
          red: '#D40511',    // Vermelho DHL
          black: '#000000',
          gray: '#F2F2F2'    // Fundo cinza claro corporativo
        }
      }
    },
  },
  plugins: [],
}