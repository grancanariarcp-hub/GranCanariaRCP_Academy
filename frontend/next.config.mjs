/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    // Expose the deploy's git commit (Vercel provides VERCEL_GIT_COMMIT_SHA at build time).
    NEXT_PUBLIC_COMMIT: (process.env.VERCEL_GIT_COMMIT_SHA || 'local').slice(0, 7),
  },
};

export default nextConfig;
