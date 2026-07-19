import type { Metadata } from 'next';

/**
 * Metadatos de vista previa: es lo que se ve al pegar el enlace en WhatsApp,
 * Instagram, Facebook o X. Sin esto el enlace aparece "desnudo".
 */
export const metadata: Metadata = {
  title: 'Campus de formación · Gran Canaria RCP',
  description:
    'Fórmate con cursos acreditados, evaluación real y certificados verificables.',
  openGraph: {
    title: 'Campus de formación · Gran Canaria RCP',
    description:
      'Cursos acreditados de RCP y emergencias, con evaluación y certificado verificable. Matrícula abierta.',
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

export default function CampusLayout({ children }: { children: React.ReactNode }) {
  return children;
}
