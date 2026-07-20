import Stripe from 'stripe';

/**
 * Cliente de Stripe.
 *
 * Se crea de forma perezosa para que la plataforma arranque igual sin claves
 * configuradas: mientras no las haya, el cobro simplemente no está disponible y
 * los cursos gratuitos siguen funcionando con normalidad.
 *
 * Las claves NUNCA viven en el repositorio: se leen del entorno (Render).
 */

let cliente: Stripe | null = null;

/**
 * La clave, sin espacios ni saltos de línea.
 *
 * Al copiar una clave del panel de Stripe y pegarla en un formulario web es
 * facilísimo arrastrar un espacio o un salto final. El resultado era
 * desconcertante: la clave "parece" correcta a simple vista pero deja de
 * empezar por sk_live_, así que la plataforma se declaraba en modo de pruebas
 * sin explicar por qué. Se limpia aquí, en el único sitio que la lee.
 */
export function claveStripe(): string {
  return (process.env.STRIPE_SECRET_KEY || '').trim();
}

export function stripeConfigurado(): boolean {
  return !!claveStripe();
}

/**
 * True si la clave es de producción y, por tanto, mueve dinero real.
 *
 * Vale tanto la clave secreta completa (sk_live_) como una restringida
 * (rk_live_). Las restringidas son mejor práctica —conceden solo los permisos
 * necesarios—, y una restringida de producción cobra dinero igual de real:
 * tratarla como de pruebas era decir que un ingreso real no lo era.
 */
export function stripeEnProduccion(): boolean {
  return /^(sk|rk)_live_/.test(claveStripe());
}

/**
 * Qué clase de clave hay puesta, para poder diagnosticarlo sin exponerla.
 * El prefijo de una clave de Stripe no es material secreto: solo dice de qué
 * tipo es. Lo que nunca se devuelve es el cuerpo de la clave.
 */
export function diagnosticoClave(): { prefijo: string; tipo: string; teniaEspacios: boolean } {
  const bruta = process.env.STRIPE_SECRET_KEY || '';
  const clave = bruta.trim();
  const prefijo = clave.slice(0, 8);
  const tipo = !clave
    ? 'sin clave'
    : clave.startsWith('sk_live_')
      ? 'secreta de producción (correcta)'
      : clave.startsWith('rk_live_')
        ? 'restringida de producción (válida, si tiene permiso de escritura sobre Checkout Sessions)'
        : clave.startsWith('sk_test_') || clave.startsWith('rk_test_')
          ? 'de pruebas'
          : clave.startsWith('pk_')
            ? 'PUBLICABLE: es la clave que se muestra sin ocultar, no sirve para cobrar'
            : 'no reconocida';
  return { prefijo, tipo, teniaEspacios: bruta !== clave };
}

export function stripe(): Stripe {
  if (!cliente) {
    const clave = claveStripe();
    if (!clave) throw new Error('STRIPE_SECRET_KEY no está configurada');
    // Sin apiVersion explícita: se usa la que fija el propio SDK, que es la
    // que corresponde a sus tipos. Fijar otra a mano los desalinea.
    cliente = new Stripe(clave);
  }
  return cliente;
}

/**
 * Texto que acompaña al cobro y al justificante.
 * La enseñanza está exenta, así que el importe cobrado es el total: no se
 * repercute IGIC ni IVA ni se desglosa base imponible.
 */
export const NOTA_EXENCION =
  'Actividad formativa exenta de impuesto indirecto (enseñanza). Importe total sin repercusión de IGIC/IVA.';
