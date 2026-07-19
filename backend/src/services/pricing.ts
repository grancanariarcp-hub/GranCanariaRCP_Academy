/**
 * Precio de matrícula de un curso.
 *
 * El precio base es el de matrícula anticipada. A partir del día siguiente a
 * `early_bird_until` se aplica el recargo porcentual. El cálculo vive aquí y no
 * repartido por los controladores para que la ficha pública, la matrícula y el
 * cobro no puedan discrepar nunca en el importe.
 */

export interface PrecioCurso {
  priceCents: number;
  earlyBirdUntil: string | Date | null;
  lateSurchargePct: number | string | null;
}

export interface PrecioCalculado {
  /** Importe a cobrar hoy, en céntimos. */
  cents: number;
  /** Precio anticipado, para poder mostrar el ahorro. */
  earlyCents: number;
  /** Precio con recargo ya aplicado. */
  lateCents: number;
  /** True mientras siga vigente la matrícula anticipada. */
  esAnticipada: boolean;
  /** Último día de precio anticipado, en AAAA-MM-DD. */
  hasta: string | null;
  surchargePct: number;
}

/** Redondeo al céntimo, para que el importe cobrado sea exacto. */
export function precioDe(c: PrecioCurso, ahora = new Date()): PrecioCalculado {
  const base = Math.max(0, Math.round(Number(c.priceCents) || 0));
  const pct = Math.max(0, Number(c.lateSurchargePct) || 0);
  const lateCents = Math.round(base * (1 + pct / 100));

  const hasta = c.earlyBirdUntil
    ? (typeof c.earlyBirdUntil === 'string' ? c.earlyBirdUntil : c.earlyBirdUntil.toISOString()).slice(0, 10)
    : null;

  // Gratuito o sin plazo configurado: no hay dos tramos que distinguir.
  if (base === 0 || !hasta || pct === 0) {
    return { cents: base, earlyCents: base, lateCents: base, esAnticipada: false, hasta, surchargePct: pct };
  }

  // El plazo es inclusive: se compara por día natural, no por instante.
  const hoy = ahora.toISOString().slice(0, 10);
  const esAnticipada = hoy <= hasta;

  return {
    cents: esAnticipada ? base : lateCents,
    earlyCents: base,
    lateCents,
    esAnticipada,
    hasta,
    surchargePct: pct,
  };
}

/** Importe en euros con formato español, para textos y PDF. */
export function euros(cents: number): string {
  return (cents / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
}
