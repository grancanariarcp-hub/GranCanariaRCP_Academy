import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ServiceWorker } from '@/components/ServiceWorker';
import { InstallButton } from '@/components/InstallButton';

export const metadata: Metadata = {
  title: 'GranCanaria RCP Academy',
  description: 'Plataforma de formación en RCP',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'RCP Academy' },
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
