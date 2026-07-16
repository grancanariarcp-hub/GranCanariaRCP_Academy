import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GranCanaria RCP Academy',
  description: 'Plataforma de formación en RCP',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
