/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Désactiver `serverActions` (en commentant cette ligne)
  // experimental: {
  //   serverActions: true,
  // },
  images: { unoptimized: true },
};

module.exports = nextConfig;
