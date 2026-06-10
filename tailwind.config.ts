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
      },
    },
  },
  plugins: [],
};
export default config;
