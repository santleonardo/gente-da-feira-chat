import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    // REMOVIDO ignoreBuildErrors — agora erros TypeScript são reportados
    ignoreBuildErrors: false,
  },
  reactStrictMode: true,
};

export default nextConfig;
