import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    resolveAlias: {
      fs: { browser: './empty.ts' },
      path: { browser: './empty.ts' },
      os: { browser: './empty.ts' },
    },
  },
};

export default nextConfig;
