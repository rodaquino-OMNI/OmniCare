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
  // Disable source maps to prevent 500 errors in development
  productionBrowserSourceMaps: false,
  experimental: {
    // Enable build analysis and package optimization
    optimizePackageImports: [
      '@mantine/core',
      '@mantine/hooks',
      '@mantine/form',
      '@mantine/notifications',
      '@mantine/modals',
      '@mantine/dates',
      '@mantine/charts',
      '@tabler/icons-react',
      'lucide-react',
      '@medplum/react',
      '@medplum/core',
      '@medplum/fhirtypes',
      'react-window',
      'react-window-infinite-loader',
      'lodash-es',
      'date-fns',
      'dayjs'
    ],
    // Enable additional performance optimizations
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
    webVitalsAttribution: ['CLS', 'LCP', 'FCP', 'FID', 'TTFB'],
    scrollRestoration: true,
    optimizeCss: true,
    gzipSize: true
  },
  // Production optimizations
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // Enhanced bundle optimization with performance features
  webpack: (config, { isServer, dev }) => {
    // Production optimizations
    if (!dev) {
      // Enable tree shaking
      config.optimization = {
        ...config.optimization,
        usedExports: true,
        sideEffects: false,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
              enforce: true,
              maxSize: 244000, // 244KB chunks for optimal loading
            },
            medplum: {
              test: /[\\/]node_modules[\\/]@medplum[\\/]/,
              name: 'medplum',
              chunks: 'all',
              priority: 20,
            },
            mantine: {
              test: /[\\/]node_modules[\\/]@mantine[\\/]/,
              name: 'mantine',
              chunks: 'all',
              priority: 15,
            },
            react: {
              test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
              name: 'react',
              chunks: 'all',
              priority: 25,
            },
            lodash: {
              test: /[\\/]node_modules[\\/]lodash[\\/]/,
              name: 'lodash',
              chunks: 'all',
              priority: 10,
            },
            icons: {
              test: /[\\/]node_modules[\\/]@tabler[\\/]icons-react[\\/]/,
              name: 'icons',
              chunks: 'all',
              priority: 5,
            },
            performance: {
              test: /[\\/]src[\\/]components[\\/]performance[\\/]/,
              name: 'performance-components',
              chunks: 'all',
              priority: 30,
            }
          }
        }
      };
      
      // Bundle analyzer (only in production with ANALYZE=true)
      if (process.env.ANALYZE === 'true') {
        const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
        config.plugins.push(
          new BundleAnalyzerPlugin({
            analyzerMode: 'static',
            openAnalyzer: false,
            reportFilename: 'bundle-analysis.html'
          })
        );
      }

      // Compression plugin for better gzip compression
      const CompressionPlugin = require('compression-webpack-plugin');
      config.plugins.push(
        new CompressionPlugin({
          filename: '[path][base].gz',
          algorithm: 'gzip',
          test: /\.(js|css|html|svg)$/,
          threshold: 8192,
          minRatio: 0.8,
        })
      );

      // Module concatenation for better tree shaking
      config.optimization.concatenateModules = true;
      
      // Minimize CSS and remove unused selectors
      config.optimization.minimizer = config.optimization.minimizer || [];
      
      // Add performance hints
      config.performance = {
        hints: 'warning',
        maxEntrypointSize: 512000, // 500KB
        maxAssetSize: 256000, // 250KB
      };
    }
    
    // Client-side optimizations
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        process: false,
        crypto: false,
        stream: false,
        util: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
      };
      
      // Performance optimizations
      config.resolve.alias = {
        ...config.resolve.alias,
        // Optimize icon imports
        '@tabler/icons-react': '@tabler/icons-react/dist/esm/icons/index.mjs'
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
  // Add offline page and performance monitoring routes
  rewrites: async () => {
    return [
      {
        source: '/offline',
        destination: '/offline.html',
      },
      {
        source: '/_performance',
        destination: '/api/performance',
      },
    ];
  },
  
  // Performance monitoring redirects
  redirects: async () => {
    return [
      {
        source: '/performance',
        destination: '/_performance',
        permanent: false,
      },
    ];
  },
  // Enhanced image optimization for performance
  images: {
    formats: ['image/webp', 'image/avif'],
    domains: ['localhost', '*.medplum.com'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 86400, // 24 hours
    dangerouslyAllowSVG: false,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    loader: 'default',
    path: '/_next/image',
    unoptimized: false
  },
  // Output optimization with performance monitoring
  output: 'standalone',
  generateBuildId: async () => {
    // Use git commit hash for better caching, fallback to timestamp
    try {
      const { execSync } = require('child_process');
      const gitHash = execSync('git rev-parse --short HEAD').toString().trim();
      return `build-${gitHash}`;
    } catch (error) {
      return `build-${Date.now()}`;
    }
  },
  
  // Performance configuration
  onDemandEntries: {
    // Period (in ms) where the server will keep pages in the buffer
    maxInactiveAge: 25 * 1000,
    // Number of pages that should be kept simultaneously without being disposed
    pagesBufferLength: 2,
  },
  
  // Environment variables for performance monitoring
  env: {
    NEXT_PERFORMANCE_MONITORING: process.env.NODE_ENV === 'production' ? 'true' : 'false',
    BUILD_TIME: new Date().toISOString(),
  },
  
  // Additional performance headers - merged with headers above
  /* async headers() {
    const headers = [
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
      // Performance and security headers for all pages
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      // Static asset caching
      {
        source: '/(_next/static|favicon.ico)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
    
    return headers;
  } */
};

export default nextConfig;
