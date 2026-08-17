// CSP (M8.2): permissiva o suficiente pra não quebrar o app —
// Next sem nonce exige 'unsafe-inline' em script/style; o mapa do /sobre
// é iframe do Google Maps (frame-src); dev precisa de eval/ws (HMR).
const isDev = process.env.NODE_ENV === "development";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws:" : ""}`,
  "frame-src https://www.google.com https://maps.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  // 2 anos + subdomínios; sem preload por ora (decisão explícita, difícil de reverter)
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Content-Security-Policy", value: csp },
  // O site não usa câmera/microfone/geolocalização/pagamento — desliga tudo
  // (defesa em profundidade; Onda G).
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Build standalone → imagem Docker enxuta para deploy no Dokploy.
  output: "standalone",
  reactStrictMode: true,
  experimental: {
    // Foto do painel agora vai pela rota /api/admin/media (BUG D) — este
    // limite cobre as demais actions multipart (foto de cliente, anexo).
    serverActions: { bodySizeLimit: "25mb" },
  },
  // Entrega das fotos (BUG D — F5): AVIF primeiro (melhor compressão),
  // WebP de fallback; degraus alinhados aos derivados que o site realmente usa.
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [400, 640, 828, 1080, 1200, 1600, 2000],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
