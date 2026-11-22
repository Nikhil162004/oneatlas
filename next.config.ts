import type { NextConfig } from 'next';

// The live product loads provider/lab favicons from arbitrary hosts; allow them by protocol rather
// than enumerating domains, and keep next/image doing the optimisation.
const nextConfig: NextConfig = {
  images: { remotePatterns: [{ protocol: 'https', hostname: '**' }] },
  // `next build` and `next dev` both write .next by default: building while the dev server is up
  // deletes the chunks it is serving and every page starts 500ing with MODULE_NOT_FOUND. That was
  // a real outage here, not a theoretical one, so the production build gets its own directory.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
};

export default nextConfig;
