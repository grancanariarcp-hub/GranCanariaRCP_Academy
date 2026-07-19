import { query } from '../config/database.js';

/**
 * Versión vigente de la política de privacidad. Al cambiarla, se puede exigir
 * de nuevo la aceptación (los consentimientos quedan versionados).
 */
export const PRIVACY_VERSION = '1.0';

export type SubjectType = 'user' | 'student';
export type ConsentKind = 'terms' | 'ranking' | 'marketing';

/** Registra la prueba del consentimiento (art. 7.1 RGPD: hay que demostrarlo). */
export async function logConsent(
  subjectId: string,
  subjectType: SubjectType,
  consent: ConsentKind,
  granted: boolean,
  ip?: string | null,
): Promise<void> {
  await query(
    'INSERT INTO consent_log (subject_id, subject_type, consent, granted, version, ip) VALUES ($1,$2,$3,$4,$5,$6)',
    [subjectId, subjectType, consent, granted, PRIVACY_VERSION, ip ?? null],
  );
}

/** Guarda los consentimientos iniciales del alta y deja la prueba. */
export async function recordSignupConsents(
  subjectId: string,
  subjectType: SubjectType,
  opts: { ranking: boolean; marketing: boolean },
  ip?: string | null,
): Promise<void> {
  const table = subjectType === 'student' ? 'students' : 'users';
  await query(
    `UPDATE ${table} SET accepted_terms_at = NOW(), privacy_version = $1,
            ranking_consent = $2, marketing_consent = $3 WHERE id = $4`,
    [PRIVACY_VERSION, opts.ranking, opts.marketing, subjectId],
  );
  await logConsent(subjectId, subjectType, 'terms', true, ip);
  await logConsent(subjectId, subjectType, 'ranking', opts.ranking, ip);
  await logConsent(subjectId, subjectType, 'marketing', opts.marketing, ip);
}
