import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { env } from '../config/env.js';

/**
 * Password hashing (bcrypt). Coste 10: recomendación mínima de OWASP y buen
 * equilibrio en la CPU compartida del plan gratuito. Con bcryptjs (JS puro) el
 * coste 12 tardaba ~2,5 s por login; con 10 baja a ~0,6 s.
 */
const BCRYPT_ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** ¿El hash guardado usa un coste mayor del actual? (para re-hashear al entrar) */
export function needsRehash(hash: string): boolean {
  const cost = Number(hash.split('$')[2]);
  return Number.isFinite(cost) && cost > BCRYPT_ROUNDS;
}

/**
 * Irreversible identity hash for minors (RGPD: we must NOT be able to
 * reconstruct the child's identity, only detect duplicates within an
 * institution). Same inputs -> same hash, so an institution cannot
 * register the same minor twice, but the plaintext is never recoverable.
 */
export function identityHash(institutionId: string, ...parts: string[]): string {
  const normalized = parts
    .map((p) => p.trim().toLowerCase())
    .join('|');
  return crypto
    .createHmac('sha256', env.encryptionKey)
    .update(`${institutionId}:${normalized}`)
    .digest('hex');
}

const AES_ALGO = 'aes-256-gcm';

function encryptionKeyBuffer(): Buffer {
  // ENCRYPTION_KEY is 64 hex chars = 32 bytes for AES-256.
  return Buffer.from(env.encryptionKey, 'hex');
}

/**
 * Reversible AES-256-GCM encryption for sensitive-but-recoverable data
 * (e.g. an adult student's contact details). Output packs iv:tag:ciphertext.
 */
export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(AES_ALGO, encryptionKeyBuffer(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(':');
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error('Malformed encrypted payload');
  }
  const decipher = crypto.createDecipheriv(
    AES_ALGO,
    encryptionKeyBuffer(),
    Buffer.from(ivHex, 'hex'),
  );
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}

/**
 * Human-friendly student access code (login method 3).
 * Avoids ambiguous characters (0/O, 1/I) so it can be dictated aloud.
 * Format: RCP-XXXX-XXXX
 */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateAccessCode(): string {
  const block = () =>
    Array.from({ length: 4 }, () => {
      const i = crypto.randomInt(0, CODE_ALPHABET.length);
      return CODE_ALPHABET[i];
    }).join('');
  return `RCP-${block()}-${block()}`;
}
