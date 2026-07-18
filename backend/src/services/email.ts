/**
 * Envío de email por Resend (API HTTP, sin SDK). Se activa solo si está
 * configurada RESEND_API_KEY; si no, no hace nada (la app funciona igual).
 */
const KEY = process.env.RESEND_API_KEY;
const FROM = process.env.RESEND_FROM || 'GranCanaria RCP Campus <onboarding@resend.dev>';

export function emailConfigured(): boolean {
  return !!KEY;
}

/** Base pública del campus, para enlaces absolutos en los correos. */
export function frontendBase(): string {
  return (process.env.FRONTEND_URL || (process.env.CORS_ORIGIN || '').split(',')[0] || '').replace(/\/$/, '');
}

/** Plantilla HTML sobria y corporativa. */
export function emailTemplate(title: string, body: string | null, url?: string | null): string {
  const btn = url
    ? `<p style="margin:24px 0"><a href="${url}" style="background:#1a365d;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;display:inline-block">Ver en el campus</a></p>`
    : '';
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1a202c">
    <div style="background:linear-gradient(135deg,#1a365d,#2d3748);color:#fff;padding:18px 22px;border-radius:10px 10px 0 0">
      <strong style="font-size:16px;letter-spacing:.5px">GRAN CANARIA RCP · CAMPUS</strong>
    </div>
    <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;padding:22px">
      <h2 style="margin:0 0 10px;font-size:18px;color:#1a365d">${title}</h2>
      ${body ? `<p style="font-size:15px;line-height:1.5;margin:0">${body}</p>` : ''}
      ${btn}
      <p style="font-size:12px;color:#718096;margin-top:22px">Recibes este correo por tu actividad en el campus de formación de Gran Canaria RCP.</p>
    </div>
  </div>`;
}

/** Envía un email. Devuelve true si Resend lo aceptó. */
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!KEY) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
