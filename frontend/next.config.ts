import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const backendUrl = process.env.BACKEND_API_URL || 'http://10.216.99.73:8080';
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
