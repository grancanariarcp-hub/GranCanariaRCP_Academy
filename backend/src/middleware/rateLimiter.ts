import rateLimit from 'express-rate-limit';
import type { Request } from 'express';

/**
 * Límites de peticiones.
 *
 * El caso que manda aquí es el AULA: treinta alumnos de un instituto salen a
 * internet por la misma IP pública. Un límite por IP pensado para una persona
 * deja fuera a la clase entera justo cuando el profesor está pasando lista.
 *
 * Por eso el límite de acceso se cuenta POR CUENTA y no por IP: frena el
 * ataque por fuerza bruta contra una cuenta concreta, que es de lo que
 * protege de verdad, sin castigar a quien comparte salida a internet. Se
 * mantiene además un tope por IP mucho más alto para frenar barridos.
 */

/** Identificador de la cuenta que intenta entrar, sea cual sea el método. */
function claveDeCuenta(req: Request): string | null {
  const b = (req.body ?? {}) as Record<string, unknown>;
  const id = b.email ?? b.accessCode ?? b.pseudonimo ?? b.displayName;
  const s = typeof id === 'string' ? id.toLowerCase().trim() : '';
  return s.length > 0 ? s : null;
}

/** Límite general: holgado, solo frena a un cliente desbocado. */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // Un aula de treinta personas navegando supera con facilidad las 300
  // peticiones cuarto de hora que había antes.
  max: 1500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones, inténtalo más tarde.' },
});

/**
 * Acceso y registro: estricto POR CUENTA.
 * Diez intentos por cuenta y cuarto de hora frenan la fuerza bruta; un aula
 * entera puede entrar sin estorbarse porque cada cual gasta su propio cupo.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => {
    const cuenta = claveDeCuenta(req);
    // Sin identificador (peticiones malformadas) se cae al conteo por IP.
    return cuenta ? `cuenta:${cuenta}` : `ip:${req.ip ?? 'desconocida'}`;
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos con esta cuenta. Espera unos minutos.' },
});

/**
 * Tope por IP sobre los mismos endpoints, muy por encima del uso legítimo de
 * un aula: corta el barrido de miles de cuentas desde un mismo origen.
 */
export const authIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de acceso desde esta conexión. Espera unos minutos.' },
});
