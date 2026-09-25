import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // O app vive dentro de outro repositório; o rastreamento de arquivos começa aqui.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
