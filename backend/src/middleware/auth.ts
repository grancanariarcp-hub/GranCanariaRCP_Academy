import type { Request, Response, NextFunction } from 'express';
import { verifyToken, type TokenPayload } from '../utils/jwt.js';
import { unauthorized } from '../utils/httpError.js';
import { restringirAuditor } from './auditor.js';
import { sesionViva } from '../services/sesiones.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Augment Express Request so downstream handlers see `req.auth` typed.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: TokenPayload;
    }
  }
}

/**
 * Requires a valid Bearer token. On success attaches the decoded
 * payload to req.auth; otherwise throws 401.
 */
async function comprobarAcceso(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw unauthorized('Falta el token de autenticación', 'NO_TOKEN');
  }
  const token = header.slice('Bearer '.length).trim();
  try {
    req.auth = verifyToken(token);
  } catch {
    throw unauthorized('Token inválido o expirado', 'BAD_TOKEN');
  }
  // Sesión cerrada desde otro dispositivo: el token sigue siendo criptográfica-
  // mente válido, pero su sesión ya no. Los tokens antiguos no llevan sid y se
  // aceptan hasta que caduquen solos.
  if (req.auth.sid && !(await sesionViva(req.auth.sid))) {
    throw unauthorized(
      'Tu sesión se cerró porque se abrió otra en un dispositivo distinto. Vuelve a entrar.',
      'SESION_CERRADA',
    );
  }

  // Las restricciones del auditor se aplican aquí y no a nivel de aplicación:
  // allí req.auth todavía no existe, porque este middleware es quien lo pone.
  restringirAuditor(req);
  next();
}

/**
 * Express 4 no captura los rechazos de un middleware asíncrono: sin envolverlo,
 * un token con la sesión cerrada tumbaría la petición sin respuesta.
 */
export const requireAuth = asyncHandler(comprobarAcceso);
