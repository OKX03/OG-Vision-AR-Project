import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    proxyClientMaxBodySize: '50mb',
    proxyTimeout: 300000,
  },
  async rewrites() {
    const backendUrl = process.env.BACKEND_API_URL;
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: '/images/:path*',
        destination: `${backendUrl}/images/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${backendUrl}/uploads/:path*`,
      },
      {
        source: '/models/:path*',
        destination: `${backendUrl}/models/:path*`,
      }
    ];
  },
};

export default nextConfig;
