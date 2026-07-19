/**
 * App version (semantic versioning: MAJOR.MINOR.PATCH).
 * Bump on each release:
 *   - MAJOR: big milestones
 *   - MINOR: new features
 *   - PATCH: fixes
 * Keep this in sync with the CHANGELOG in docs/.
 */
export const APP_VERSION = '1.74.0';

/** Short commit hash, injected at build time (Vercel) or 'local' in dev. */
export const APP_COMMIT = process.env.NEXT_PUBLIC_COMMIT || 'local';
