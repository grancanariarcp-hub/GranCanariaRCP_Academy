import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '../utils/jwt.js';
import { forbidden, unauthorized } from '../utils/httpError.js';

/**
 * Role gate. Use AFTER requireAuth.
 * Example: router.get('/admin', requireAuth, requireRole('super_admin'), handler)
 */
export function requireRole(...allowed: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      throw unauthorized();
    }
    if (!allowed.includes(req.auth.role)) {
      throw forbidden('No tienes permisos para esta acción', 'ROLE_FORBIDDEN');
    }
    next();
  };
}
