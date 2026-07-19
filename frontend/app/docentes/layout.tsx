import type { Metadata } from 'next';

/**
 * Captación de docentes. Metadatos propios porque es un enlace que se comparte
 * en grupos profesionales y por mensajería.
 */
export const metadata: Metadata = {
  title: 'Publica tus cursos · Gran Canaria RCP',
  description:
    'Publica tus cursos sanitarios en un campus online: matrículas, cobros, evaluación y certificados verificables. Tú fijas el precio y la modalidad.',
  openGraph: {
    title: 'Publica tus cursos · Gran Canaria RCP',
    description:
      'Ya enseñas. Gestiona tus cursos y llega a más alumnos: matrículas, cobros, evaluación y certificados verificables.',
    type: 'website',
    locale: 'es_ES',
    siteName: 'Gran Canaria RCP',
    images: [{ url: '/logo-horizontal.png', width: 1070, height: 255, alt: 'Gran Canaria RCP' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Publica tus cursos · Gran Canaria RCP',
    description: 'Publica tus cursos sanitarios: matrículas, cobros, evaluación y certificados verificables.',
    images: ['/logo-horizontal.png'],
  },
};

export default function DocentesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
