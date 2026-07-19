import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ServiceWorker } from '@/components/ServiceWorker';
import { InstallButton } from '@/components/InstallButton';

export const metadata: Metadata = {
  title: 'Gran Canaria RCP · Aprende a salvar vidas',
  description: 'Aprende soporte vital básico y primeros auxilios gratis, ponte a prueba en los desafíos y fórmate con certificado.',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'RCP Academy' },
  // Vista previa al compartir el enlace en redes y mensajería.
  openGraph: {
    title: 'Gran Canaria RCP · Aprende a salvar vidas',
    description: 'Formación gratuita en soporte vital básico y primeros auxilios, desafíos con ranking y cursos acreditados con certificado.',
    type: 'website',
    locale: 'es_ES',
    siteName: 'Gran Canaria RCP',
    images: [{ url: '/logo-horizontal.png', width: 1070, height: 255, alt: 'Gran Canaria RCP' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Gran Canaria RCP · Aprende a salvar vidas',
    description: 'Formación gratuita en RCP y primeros auxilios, desafíos con ranking y cursos con certificado.',
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
