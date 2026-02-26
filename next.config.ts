import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Garmin Connect uses Node.js APIs not available in Edge runtime
  serverExternalPackages: ['garmin-connect'],
};

export default nextConfig;
