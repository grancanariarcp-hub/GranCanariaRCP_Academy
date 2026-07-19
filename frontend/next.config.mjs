/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    // Expose the deploy's git commit (Vercel provides VERCEL_GIT_COMMIT_SHA at build time).
    NEXT_PUBLIC_COMMIT: (process.env.VERCEL_GIT_COMMIT_SHA || 'local').slice(0, 7),
  },
  async redirects() {
    return [
      // La raíz pasó a ser el campus de pago: los enlaces a /campus ya
      // compartidos siguen funcionando.
      { source: '/campus', destination: '/', permanent: true },
      // Las rutas de Next distinguen mayúsculas: recogemos las formas en que
      // se teclea a mano la zona gratuita.
      { source: '/desafiorcp', destination: '/desafioRCP', permanent: true },
      { source: '/DesafioRCP', destination: '/desafioRCP', permanent: true },
      { source: '/DESAFIORCP', destination: '/desafioRCP', permanent: true },
    ];
  },
};

export default nextConfig;
