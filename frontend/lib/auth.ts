'use client';

/**
 * Minimal client-side session storage. The JWT lives in localStorage;
 * for a production app you'd likely move to httpOnly cookies, but this
 * keeps Phase 1 simple and framework-agnostic.
 */
export type Role = 'super_admin' | 'institution_admin' | 'student';

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
