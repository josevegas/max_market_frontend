/** Misma estructura de paleta y dark mode que frontend_rentcar; cambian los
 *  tonos para la marca Max Market: rojo intenso con acento naranja, tomados
 *  del logo. Si se toca acá, sincronizar el preset de PrimeNG en
 *  `app.config.ts`: los dos definen el mismo color primario. */
export default {
  content: ["./src/**/*.{html,ts}"],
  darkMode: ["class", ".dark-mode"],
  theme: {
    extend: {
      colors: {
        // Rojo del logo (el de "Max Market" y el carrito).
        brand: {
          50:  '#fff1f3',
          100: '#ffe1e6',
          200: '#ffc7d1',
          300: '#ff9caf',
          400: '#ff6183',
          500: '#FA0A32',
          600: '#e30029',
          700: '#bf0023',
          800: '#9e0621',
          900: '#860b21',
          950: '#4b000d',
        },
        // Naranja del degradado inferior del logo. Acento, no primario.
        naranja: {
          50:  '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#FF6B00',
          600: '#ea5a00',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        surface: {
          DEFAULT: '#0b0d12',
          1: '#13161d',
          2: '#1a1d26',
          3: '#242832',
          border: '#2a2e38',
        },
      },
      backgroundImage: {
        // Degradado de la marca: el mismo rojo→naranja del logo.
        'marca': 'linear-gradient(180deg, #FA0A32 55%, #FF6B00 100%)',
      },
    },
  },
  plugins: [],
};
