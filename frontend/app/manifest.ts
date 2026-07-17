import type { MetadataRoute } from 'next';

/** Web App Manifest — hace la web instalable como app (PWA) en Android/desktop. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'GranCanaria RCP Academy',
    short_name: 'RCP Academy',
    description: 'Campus de formación en RCP, primeros auxilios y preparación de oposiciones (OPE/MIR).',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#dbe2ec',
    theme_color: '#1a365d',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
