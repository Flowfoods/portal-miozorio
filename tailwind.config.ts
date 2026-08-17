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
          "marrom-suave": "#A89380",
          ok: "#7A8B6F",
          texto: "#3D3733",
          // ── Escala do marrom (redesign V1). 500 = cor da marca.
          //    #8A7361 puro sobre branco ≈ 4,4:1 — passa só em texto grande;
          //    texto < 18px usa 700 ou mais escuro (obrigatório, AA).
          "marrom-50": "#F7F4F1",
          "marrom-100": "#EDE6E0",
          "marrom-200": "#DCCEC3",
          "marrom-300": "#C4AF9F",
          "marrom-400": "#A78F7B",
          "marrom-500": "#8A7361",
          "marrom-600": "#75604F",
          "marrom-700": "#6B5849",
          "marrom-800": "#4E4137",
          "marrom-900": "#332B24",
          // ── Cores de apoio (clima nude/terroso — nunca verde/vermelho puros).
          //    O par superfície × tinta segue a regra do 500/700: a versão
          //    clara enfeita, a "-tinta" é a única que vira TEXTO sobre claro.
          sucesso: "#7A8B6F", // sálvia (= mi-ok, mantido como alias)
          "sucesso-tinta": "#46573B",
          alerta: "#C08552", // terracota
          "alerta-tinta": "#7D5128",
          erro: "#A65D57", // telha dessaturada
          "erro-tinta": "#7E3A35",
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
      // Escala tipográfica do dashboard (V1.2): contraste alto entre o número
      // e o rótulo. Números de KPI sempre com `tabular-nums`.
      fontSize: {
        kpi: ["36px", { lineHeight: "1.1", fontWeight: "700", letterSpacing: "-0.02em" }],
        "kpi-sm": ["28px", { lineHeight: "1.15", fontWeight: "700", letterSpacing: "-0.015em" }],
        titulo: ["20px", { lineHeight: "1.3", fontWeight: "600" }],
        corpo: ["15px", { lineHeight: "1.5" }],
        rotulo: ["13px", { lineHeight: "1.4", fontWeight: "500" }],
        micro: ["11px", { lineHeight: "1.3", fontWeight: "500", letterSpacing: "0.06em" }],
      },
      borderRadius: {
        mi: "14px",
      },
      boxShadow: {
        // Sombras SEMPRE em marrom translúcido (51,43,36 = marrom-900) —
        // preto puro sobre bege deixa a interface suja.
        suave: "0 8px 30px rgb(51 43 36 / 0.07)",
        card: "0 1px 3px rgb(51 43 36 / 0.04), 0 8px 24px -12px rgb(51 43 36 / 0.08)",
        // Sombra lateral discreta que "descola" a sidebar do canvas.
        "nav-col": "2px 0 8px rgb(51 43 36 / 0.05)",
      },
    },
  },
  plugins: [],
};
export default config;
