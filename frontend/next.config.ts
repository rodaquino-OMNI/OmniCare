import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    // Ignore ESLint errors during build for build optimization analysis
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Ignore TypeScript errors during build for build optimization analysis
    ignoreBuildErrors: true,
  },
  experimental: {
    // Enable build analysis and package optimization
    optimizePackageImports: [
      '@mantine/core',
      '@mantine/hooks',
      '@mantine/form',
      '@mantine/notifications',
      '@tabler/icons-react',
      'lucide-react'
    ]
  },
  // Production optimizations
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // Bundle optimization
  webpack: (config, { isServer }) => {
    // Optimize bundle size for client-side
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    
    return config;
  },
  // Service Worker support
  headers: async () => [
    {
      source: '/sw.js',
      headers: [
        {
          key: 'Cache-Control',
          value: 'no-cache, no-store, must-revalidate',
        },
        {
          key: 'Content-Type',
          value: 'application/javascript; charset=utf-8',
        },
      ],
    },
    {
      source: '/offline',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, max-age=3600',
        },
      ],
    },
  ],
  // Add offline page to static files
  rewrites: async () => {
    return [
      {
        source: '/offline',
        destination: '/offline.html',
      },
    ];
  },
  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    domains: ['localhost'],
  },
  // Output optimization
  output: 'standalone',
  generateBuildId: async () => {
    // Use build timestamp for cache busting
    return `build-${Date.now()}`;
  }
};

export default nextConfig;
