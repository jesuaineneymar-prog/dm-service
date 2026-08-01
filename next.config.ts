import type { NextConfig } from "next";

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  reactStrictMode: false,
  typescript: { ignoreBuildErrors: true },
  experimental: {
    serverComponentsExternalPackages: [
      '@prisma/client', '@prisma/adapter-libsql', '@libsql/client', '@libsql/core',
      'chrome-remote-interface',
    ],
  },
  serverExternalPackages: [
    '@prisma/client', '@prisma/adapter-libsql', '@libsql/client', '@libsql/core',
    'chrome-remote-interface',
  ],
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};

export default nextConfig;
