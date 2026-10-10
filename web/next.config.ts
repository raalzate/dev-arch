import path from 'node:path';
import type {NextConfig} from 'next';

// 012-install-doctor-docker (FR-020): the container image builds with NEXT_OUTPUT=standalone; the npm workspace
// hoists node_modules to apps/dev-arch, so file tracing starts there. Every other build is unchanged.
const standalone = process.env.NEXT_OUTPUT === 'standalone';

// 011-quality-delivery (FR-001): type and lint errors fail the build (no tolerance options).
const nextConfig: NextConfig = {
  ...(standalone ? {output: 'standalone', outputFileTracingRoot: path.join(__dirname, '..')} : {}),
  devIndicators: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
