'use client';

/**
 * Minimal client-side session storage. The JWT lives in localStorage;
 * for a production app you'd likely move to httpOnly cookies, but this
 * keeps Phase 1 simple and framework-agnostic.
 */
export type Role = 'super_admin' | 'institution_admin' | 'profesor' | 'institution_teacher' | 'student' | 'auditor';

export interface SessionUser {
  id: string;
  name: string;
  role: Role;
  institutionId: string | null;
}

const TOKEN_KEY = 'rcp_token';
const USER_KEY = 'rcp_user';

export function saveSession(token: string, user: SessionUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): SessionUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as SessionUser) : null;
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/** Where to send a user after logging in, based on their role. */
export function homeForRole(role: Role): string {
  if (role === 'super_admin') return '/admin';
  if (role === 'institution_admin') return '/institucion';
  if (role === 'institution_teacher') return '/maestro';
  if (role === 'profesor') return '/admin/cursos';
  // El auditor de la comisión entra directo al catálogo de cursos.
  if (role === 'auditor') return '/admin/cursos';
  return '/student';
}
