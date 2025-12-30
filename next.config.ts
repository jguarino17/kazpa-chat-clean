import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep it boring + stable for now
  experimental: {
    reactCompiler: false, // ✅ important: prevents the babel-plugin error
  },
};

export default nextConfig;
