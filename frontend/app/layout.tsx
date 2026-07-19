import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ServiceWorker } from '@/components/ServiceWorker';
import { InstallButton } from '@/components/InstallButton';

export const metadata: Metadata = {
  // Base para resolver las imágenes de vista previa al compartir el enlace.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://grancanariarcp.vercel.app'),
  title: 'Campus de formación · Gran Canaria RCP',
  description: 'Fórmate con cursos acreditados, evaluación real y certificados verificables.',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'RCP Academy' },
  // Vista previa al compartir el enlace en redes y mensajería.
  openGraph: {
    title: 'Campus de formación · Gran Canaria RCP',
    description: 'Cursos acreditados de RCP y emergencias, con evaluación y certificado verificable.',
    type: 'website',
    locale: 'es_ES',
    siteName: 'Gran Canaria RCP',
    images: [{ url: '/logo-horizontal.png', width: 1070, height: 255, alt: 'Gran Canaria RCP' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Campus de formación · Gran Canaria RCP',
    description: 'Cursos acreditados de RCP y emergencias, con certificado verificable.',
    images: ['/logo-horizontal.png'],
  },
};

export const viewport: Viewport = {
  themeColor: '#1a365d',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        {children}
        <ServiceWorker />
        <InstallButton />
      </body>
    </html>
  );
}
