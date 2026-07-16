import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';

export type UserRole = 'super_admin' | 'institution_admin' | 'student';

/** The claims we embed in every access token. */
export interface TokenPayload {
  sub: string; // user or student id
  role: UserRole;
  institutionId: string | null;
  name: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  } as SignOptions);
}

export function verifyToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, env.jwtSecret);
  if (typeof decoded === 'string') {
    throw new Error('Unexpected token format');
  }
  return decoded as TokenPayload & jwt.JwtPayload;
}
