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

export function stripeConfigurado(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

/** True si la clave es de producción y, por tanto, mueve dinero real. */
export function stripeEnProduccion(): boolean {
  return (process.env.STRIPE_SECRET_KEY || '').startsWith('sk_live_');
}

export function stripe(): Stripe {
  if (!cliente) {
    const clave = process.env.STRIPE_SECRET_KEY;
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
