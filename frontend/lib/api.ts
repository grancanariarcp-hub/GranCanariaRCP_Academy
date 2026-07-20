'use client';

import { clearSession, getToken, getUser } from './auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

/**
 * La sesión ya no vale: se limpia y se lleva a la puerta que le corresponde,
 * avisando de por qué. Se hace una sola vez aunque fallen varias peticiones a
 * la vez, para no encadenar redirecciones.
 */
let redirigiendo = false;
function sesionCaducada(): void {
  if (typeof window === 'undefined' || redirigiendo) return;
  redirigiendo = true;
  const rol = getUser()?.role;
  clearSession();
  const destino = rol === 'student' ? '/login/student' : rol ? '/login/admin' : '/login';
  window.location.href = `${destino}?caducada=1`;
}

/** Base pública de la API (para construir URLs de imágenes como el QR). */
export const apiBase = API_URL;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

/**
 * Fetch wrapper that attaches the JWT and normalises errors into ApiError,
 * so components can `try/catch` and show `err.message` directly.
 */
export async function api<T = unknown>(
  path: string,
  options: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const { auth = false, headers, ...rest } = options;

  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  };

  if (auth) {
    const token = getToken();
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...rest, headers: finalHeaders });

  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    const b = body as { error?: string; code?: string; details?: unknown } | null;
    // Sesión caducada o cerrada desde otro dispositivo. Sin esto, la petición
    // fallaba y cada pantalla se las apañaba como podía: donde no había un
    // catch, no ocurría absolutamente nada y el usuario se quedaba pulsando un
    // botón muerto sin saber que ya no tenía sesión.
    if (res.status === 401 && auth) sesionCaducada();
    throw new ApiError(
      res.status,
      b?.error ?? `Error ${res.status}`,
      b?.code,
      b?.details,
    );
  }

  return body as T;
}

/** Download a file from an authenticated endpoint and save it locally. */
export async function downloadFile(path: string, filename: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new ApiError(res.status, 'No se pudo descargar el archivo');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Upload a file (multipart) to an authenticated endpoint. */
export async function uploadFile<T = unknown>(
  path: string,
  file: File,
  fields: Record<string, string> = {},
): Promise<T> {
  const token = getToken();
  const fd = new FormData();
  fd.append('file', file);
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);

  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const b = body as { error?: string; code?: string } | null;
    throw new ApiError(res.status, b?.error ?? `Error ${res.status}`, b?.code);
  }
  return body as T;
}
