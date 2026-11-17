const path = require('path');

const isExport = process.env.NEXT_EXPORT === 'true' || process.env.CF_PAGES === 'true';

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(isExport ? { output: 'export', distDir: '.next-export', images: { unoptimized: true } } : {}),
  transpilePackages: ['@workspace/ui'],
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@workspace/ui',
      'react-hot-toast',
      'framer-motion',
    ],
  },
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ignored: ['**/.git/**', '**/.next/**', '**/.next-export/**', '**/out/**', '**/node_modules/**'],
        aggregateTimeout: 300,
        poll: false,
      };
    }
    return config;
  },
  async rewrites() {
    const backendUrl = (process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || '').replace(/\/+$/, '');
    if (!backendUrl) return [];
    return [
      {
        source: '/r/:path*',
        destination: `${backendUrl}/r/:path*`,
      },
      {
        source: '/tag/:path*',
        destination: `${backendUrl}/tag/:path*`,
      },
      {
        source: '/shield/:path*',
        destination: `${backendUrl}/shield/:path*`,
      },
      {
        source: '/evaluate/:path*',
        destination: `${backendUrl}/evaluate/:path*`,
      },
      {
        source: '/api/v1/traffic-director/:path*',
        destination: `${backendUrl}/api/v1/traffic-director/:path*`,
      },
      {
        source: '/api/v1/advertising/:path*',
        destination: `${backendUrl}/api/v1/advertising/:path*`,
      },
      {
        source: '/api/v1/domains/:path*',
        destination: `${backendUrl}/api/v1/domains/:path*`,
      },
      {
        source: '/api/v1/ai/:path*',
        destination: `${backendUrl}/api/v1/ai/:path*`,
      },
      {
        source: '/api/users',
        destination: `${backendUrl}/api/users`,
      },
      {
        source: '/api/v1/workspace-tools/:path*',
        destination: `${backendUrl}/api/v1/workspace-tools/:path*`,
      },
      {
        source: '/api/forms/:path*',
        destination: `${backendUrl}/api/forms/:path*`,
      },
      {
        source: '/api/websites/:path*',
        destination: `${backendUrl}/api/websites/:path*`,
      },
      {
        source: '/api/public/:path*',
        destination: `${backendUrl}/api/public/:path*`,
      },
      {
        source: '/api/files/:path*',
        destination: `${backendUrl}/api/files/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${backendUrl}/uploads/:path*`,
      },
      {
        source: '/pixel/event',
        destination: `${backendUrl}/pixel/event`,
      },
      {
        source: '/oauth/:path*',
        destination: `${backendUrl}/oauth/:path*`,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/traffic-director',
        destination: '/traffic-director/links',
        permanent: false,
      },
      {
        source: '/traffic-director/domains',
        destination: '/traffic-director/links',
        permanent: false,
      },
      {
        source: '/traffic-director/pixels',
        destination: '/traffic-director/links',
        permanent: false,
      },
      {
        source: '/traffic-director/analytics',
        destination: '/traffic-director/links',
        permanent: false,
      },
    ];
  },
  outputFileTracingRoot: path.join(__dirname, '../../'),
};

module.exports = nextConfig;
