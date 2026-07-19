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
      // Las variantes de mayúsculas de /desafioRCP NO se resuelven aquí: estas
      // reglas no distinguen mayúsculas, así que capturarían también la propia
      // URL buena y la redirigirían a sí misma en bucle. Lo hace middleware.ts,
      // que compara la cadena exacta.
    ];
  },
};

export default nextConfig;
