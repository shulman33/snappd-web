import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    // Supabase Storage domain for remote images
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'iitxfjhnywekstxagump.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/screenshots/**',
        search: '',
      },
    ],
    // Optimize for WebP and AVIF formats
    formats: ['image/avif', 'image/webp'],
    // Image size breakpoints for responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Minimum cache TTL for optimized images (1 hour)
    minimumCacheTTL: 3600,
  },
  // Enable production source maps for better debugging (optional)
  productionBrowserSourceMaps: false,
};

export default nextConfig;
