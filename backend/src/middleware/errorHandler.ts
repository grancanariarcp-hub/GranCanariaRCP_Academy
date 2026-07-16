import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../utils/httpError.js';
import { env } from '../config/env.js';

/** 404 for unmatched routes. */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: 'Ruta no encontrada', path: req.path });
}

/**
 * Central error handler. Turns thrown errors into consistent JSON.
 * Must be registered LAST and keep the 4-arg signature so Express
 * recognises it as an error handler.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Datos inválidos',
      code: 'VALIDATION_ERROR',
      details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }

  // Unknown / unexpected error: log server-side, hide details from client.
  console.error('[error]', err);
  res.status(500).json({
    error: 'Error interno del servidor',
    ...(env.isProduction ? {} : { detail: (err as Error)?.message }),
  });
}
