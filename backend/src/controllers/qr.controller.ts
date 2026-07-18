import type { Request, Response } from 'express';
import QRCode from 'qrcode';
import { badRequest } from '../utils/httpError.js';

/** GET /api/public/qr?data=... → PNG del QR. Se genera al vuelo (sin almacenar). */
export async function qrImage(req: Request, res: Response): Promise<void> {
  const data = String(req.query.data ?? '').slice(0, 512);
  if (!data) throw badRequest('Falta el parámetro data', 'NO_DATA');
  const png = await QRCode.toBuffer(data, { margin: 1, width: 320 });
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(png);
}
