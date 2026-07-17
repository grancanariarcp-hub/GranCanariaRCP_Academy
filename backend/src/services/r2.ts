import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'node:crypto';
import { env } from '../config/env.js';

/**
 * Cloudflare R2 (S3-compatible) storage for reference PDFs.
 * PDFs never touch the database — only their object key is stored there.
 * Students receive short-lived presigned URLs to view a document.
 */
let client: S3Client | null = null;

function s3(): S3Client {
  if (!env.r2.configured) {
    throw new Error('R2 no está configurado (faltan credenciales R2_*)');
  }
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: env.r2.endpoint,
      credentials: {
        accessKeyId: env.r2.accessKeyId,
        secretAccessKey: env.r2.secretAccessKey,
      },
    });
  }
  return client;
}

export const r2Configured = () => env.r2.configured;

/** Build a collision-free object key that keeps the original file name readable. */
export function buildKey(originalName: string, prefix = 'docs'): string {
  const safe = originalName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
  return `${prefix}/${crypto.randomBytes(8).toString('hex')}-${safe}`;
}

/**
 * Attach a short-lived image URL to rows that carry an `image_key`.
 * No-op when R2 isn't configured (returns rows unchanged).
 */
export async function withImageUrls<T extends { image_key?: string | null }>(rows: T[]): Promise<(T & { image_url?: string })[]> {
  if (!env.r2.configured) return rows;
  return Promise.all(
    rows.map(async (r) => (r.image_key ? { ...r, image_url: await presignedGetUrl(r.image_key, 3600) } : r)),
  );
}

/** Generic: attach a presigned URL (urlField) for rows carrying a key (keyField). */
export async function presignKeys<T extends Record<string, unknown>>(rows: T[], keyField: string, urlField: string): Promise<T[]> {
  if (!env.r2.configured) return rows;
  return Promise.all(
    rows.map(async (r) => {
      const key = r[keyField] as string | null | undefined;
      return key ? { ...r, [urlField]: await presignedGetUrl(key, 3600) } : r;
    }),
  );
}

export async function uploadObject(key: string, body: Buffer, contentType: string): Promise<void> {
  await s3().send(
    new PutObjectCommand({ Bucket: env.r2.bucket, Key: key, Body: body, ContentType: contentType }),
  );
}

export async function presignedGetUrl(key: string, expiresIn = 600): Promise<string> {
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: env.r2.bucket, Key: key }), { expiresIn });
}

export async function deleteObject(key: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: env.r2.bucket, Key: key }));
}
