import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  eslint: {
    // Temporarily disable ESLint during builds for initial deployment
    ignoreDuringBuilds: true,
  },
  turbopack: {
    // Turbo configuration for stable Turbopack
  }
};

export default nextConfig;
