import type { NextConfig } from 'next';

// The live product loads provider/lab favicons from arbitrary hosts; allow them by protocol rather
// than enumerating domains, and keep next/image doing the optimisation.
const nextConfig: NextConfig = {
  images: { remotePatterns: [{ protocol: 'https', hostname: '**' }] },
};

export default nextConfig;
