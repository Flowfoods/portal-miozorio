import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        mi: {
          branco: "#FFFFFF",
          bege: "#F5F0E8",
          cinza: "#E8E6E3",
          marrom: "#8A7361",
          "marrom-escuro": "#5C4A3D",
          texto: "#3D3733",
          // Superfícies do /admin (ver src/styles/tokens.css)
          "superficie-nav": "var(--mi-superficie-nav)",
          superficie: "var(--mi-superficie)",
          "superficie-elevada": "var(--mi-superficie-elevada)",
        },
      },
      fontFamily: {
        titulo: ["var(--font-titulo)", "Cormorant Garamond", "serif"],
        corpo: ["var(--font-corpo)", "Jost", "Inter", "sans-serif"],
      },
      borderRadius: {
        mi: "14px",
      },
      boxShadow: {
        suave: "0 8px 30px rgb(0 0 0 / 0.06)",
        // Sombra lateral discreta que "descola" a sidebar do canvas.
        "nav-col": "2px 0 8px rgb(0 0 0 / 0.04)",
      },
    },
  },
  plugins: [],
};
export default config;
