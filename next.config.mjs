/** @type {import('next').NextConfig} */
const nextConfig = {
  // Build standalone → imagem Docker enxuta para deploy no Dokploy.
  output: "standalone",
  reactStrictMode: true,
};

export default nextConfig;
