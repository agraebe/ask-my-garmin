import type { NextConfig } from 'next';

// In production (Vercel), point at the deployed Python backend.
// In local development, default to localhost:8000.
// Set BACKEND_URL in the Vercel dashboard before deploying.
const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:8000';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        // Proxy all /api/* requests to the Python backend.
        // Browser talks to Next.js (same origin); Next.js forwards to Python.
        // No CORS configuration needed on the Python side.
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
