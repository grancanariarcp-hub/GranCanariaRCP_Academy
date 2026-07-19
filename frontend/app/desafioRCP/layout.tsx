import type { Metadata } from 'next';

/**
 * Zona gratuita: divulgación de soporte vital básico y primeros auxilios para
 * población general. Metadatos propios porque es la página que más circula por
 * redes y mensajería.
 */
export const metadata: Metadata = {
  title: '¿Qué tanto sabes de RCP? · Gran Canaria RCP',
  description:
    'Aprende soporte vital básico y primeros auxilios gratis, ponte a prueba en los desafíos y compite representando a tu institución.',
  openGraph: {
    title: '¿Qué tanto sabes de RCP? · Gran Canaria RCP',
    description:
      'Formación gratuita en soporte vital básico y primeros auxilios, desafíos con ranking y acceso para menores.',
    type: 'website',
    locale: 'es_ES',
    siteName: 'Gran Canaria RCP',
    images: [{ url: '/logo-horizontal.png', width: 1070, height: 255, alt: 'Gran Canaria RCP' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '¿Qué tanto sabes de RCP? · Gran Canaria RCP',
    description: 'Formación gratuita en RCP y primeros auxilios, con desafíos y ranking.',
    images: ['/logo-horizontal.png'],
  },
};

export default function ZonaGratuitaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
