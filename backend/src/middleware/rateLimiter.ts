import rateLimit from 'express-rate-limit';

/**
 * Global limiter: generous, protects against runaway clients.
 */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones, inténtalo más tarde.' },
});

/**
 * Auth limiter: strict, to slow down credential-stuffing / brute force
 * against the login and register endpoints.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de acceso. Espera unos minutos.' },
});
