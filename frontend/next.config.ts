import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/interview/:path*",
        destination: "http://localhost:8001/api/interview/:path*",
      },
    ];
  },
};

export default nextConfig;
