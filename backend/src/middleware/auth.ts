import type { Request, Response, NextFunction } from 'express';
import { verifyToken, type TokenPayload } from '../utils/jwt.js';
import { unauthorized } from '../utils/httpError.js';
import { restringirAuditor } from './auditor.js';

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
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
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
  // Las restricciones del auditor se aplican aquí y no a nivel de aplicación:
  // allí req.auth todavía no existe, porque este middleware es quien lo pone.
  restringirAuditor(req);
  next();
}
