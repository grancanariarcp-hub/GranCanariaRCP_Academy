/**
 * Small typed error carrying an HTTP status so controllers can `throw`
 * and the central error handler turns it into a clean JSON response.
 */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (msg: string, code?: string) => new HttpError(400, msg, code);
export const unauthorized = (msg = 'No autorizado', code?: string) => new HttpError(401, msg, code);
export const forbidden = (msg = 'Acceso denegado', code?: string) => new HttpError(403, msg, code);
export const notFound = (msg = 'No encontrado', code?: string) => new HttpError(404, msg, code);
export const conflict = (msg: string, code?: string) => new HttpError(409, msg, code);
