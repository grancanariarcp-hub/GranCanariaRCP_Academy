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
    // El auditor de la comisión consulta el CONTENIDO (cursos, bancos,
    // documentos): rutas que también sirven al profesorado. Se le abre aquí, en
    // esas rutas, para no repetir su rol en cada una. Pero NO en las rutas
    // exclusivas de administración (requireRole('super_admin') a secas), que
    // exponen datos de gestión y PII de todos —incluidos menores— y no le
    // competen. Escribir se lo impide igualmente restringirAuditor (solo GET).
    if (
      req.auth.role === 'auditor'
      && ['GET', 'HEAD'].includes(req.method)
      && allowed.includes('profesor')
    ) {
      next();
      return;
    }
    if (!allowed.includes(req.auth.role)) {
      throw forbidden('No tienes permisos para esta acción', 'ROLE_FORBIDDEN');
    }
    next();
  };
}
