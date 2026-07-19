import { NextResponse, type NextRequest } from 'next/server';

/**
 * La zona gratuita vive en /desafioRCP, con mayúsculas, y las rutas de Next
 * distinguen mayúsculas: quien teclee /desafiorcp recibiría un 404.
 *
 * No se resuelve con `redirects()` en next.config porque allí el emparejamiento
 * ignora mayúsculas y minúsculas, de modo que la regla capturaría también la
 * URL correcta y la redirigiría a sí misma, en bucle. Aquí la comparación es
 * exacta: solo se redirige cuando la grafía NO es la canónica.
 */
const CANONICAS = ['/desafioRCP'];

export function middleware(req: NextRequest) {
  const ruta = req.nextUrl.pathname;
  for (const canonica of CANONICAS) {
    if (ruta !== canonica && ruta.toLowerCase() === canonica.toLowerCase()) {
      const url = req.nextUrl.clone();
      url.pathname = canonica;
      return NextResponse.redirect(url, 308);
    }
  }
  return NextResponse.next();
}

export const config = {
  // Solo se evalúan las rutas candidatas: el resto del sitio no paga el coste.
  matcher: ['/desafiorcp', '/DesafioRCP', '/DESAFIORCP', '/Desafiorcp', '/desafioRcp', '/DesafioRcp'],
};
