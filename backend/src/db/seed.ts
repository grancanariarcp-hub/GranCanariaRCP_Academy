import { pool, query, withTransaction } from '../config/database.js';
import { env } from '../config/env.js';
import {
  hashPassword,
  generateAccessCode,
  identityHash,
} from '../utils/crypto.js';

/**
 * Idempotent seeding: safe to run repeatedly.
 * Creates the super admin (Federico), demo institutions, demo students
 * and a starter question bank. Uses ON CONFLICT so re-runs don't duplicate.
 */

const DEMO_QUESTIONS: Array<{
  category: 'SVB' | 'SVI' | 'SVA';
  text: string;
  options: string[];
  correct: number;
  explanation: string;
  difficulty: number;
}> = [
  {
    category: 'SVB',
    text: '¿Cuál es la frecuencia recomendada de compresiones torácicas en un adulto?',
    options: ['60-80 por minuto', '100-120 por minuto', '140-160 por minuto', '80-100 por minuto'],
    correct: 1,
    explanation: 'Las guías recomiendan comprimir a un ritmo de 100 a 120 compresiones por minuto.',
    difficulty: 1,
  },
  {
    category: 'SVB',
    text: '¿Qué profundidad deben tener las compresiones torácicas en un adulto?',
    options: ['2-3 cm', 'Al menos 5 cm (sin superar 6 cm)', 'Más de 7 cm', '1-2 cm'],
    correct: 1,
    explanation: 'Se debe comprimir al menos 5 cm sin superar los 6 cm en un adulto.',
    difficulty: 1,
  },
  {
    category: 'SVB',
    text: 'En RCP con dos reanimadores en un adulto, ¿cuál es la relación compresión-ventilación?',
    options: ['15:2', '30:2', '5:1', '10:2'],
    correct: 1,
    explanation: 'La relación estándar en el adulto es 30 compresiones por 2 ventilaciones.',
    difficulty: 2,
  },
  {
    category: 'SVI',
    text: 'Ante una parada por fibrilación ventricular, ¿cuál es la prioridad terapéutica?',
    options: ['Administrar atropina', 'Desfibrilación precoz', 'Intubación inmediata', 'Vía venosa central'],
    correct: 1,
    explanation: 'La desfibrilación precoz es clave en ritmos desfibrilables (FV/TVSP).',
    difficulty: 2,
  },
  {
    category: 'SVI',
    text: '¿Cada cuánto tiempo se recomienda cambiar al reanimador que realiza compresiones?',
    options: ['Cada minuto', 'Cada 2 minutos', 'Cada 5 minutos', 'No es necesario cambiar'],
    correct: 1,
    explanation: 'Se recomienda relevo cada 2 minutos para evitar fatiga y mantener calidad.',
    difficulty: 2,
  },
  {
    category: 'SVA',
    text: 'En el algoritmo de SVA, ¿cuál es la primera dosis de adrenalina en la parada cardiaca del adulto?',
    options: ['0.5 mg IV', '1 mg IV', '3 mg IV', '10 mg IV'],
    correct: 1,
    explanation: 'La dosis estándar es 1 mg de adrenalina IV cada 3-5 minutos.',
    difficulty: 3,
  },
  {
    category: 'SVA',
    text: '¿Cuál de las siguientes es una causa reversible de parada (regla de las 4H y 4T)?',
    options: ['Hipertensión', 'Hipoxia', 'Hiperreflexia', 'Hipertrofia'],
    correct: 1,
    explanation: 'La hipoxia es una de las 4H reversibles; se corrige oxigenando y ventilando.',
    difficulty: 3,
  },
];

async function seedSuperAdmin(): Promise<void> {
  const { email, password, name } = env.superAdmin;
  const passwordHash = await hashPassword(password);
  await query(
    `INSERT INTO users (email, password_hash, name, role, institution_id, is_active)
     VALUES ($1, $2, $3, 'super_admin', NULL, TRUE)
     ON CONFLICT (email) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       name = EXCLUDED.name,
       is_active = TRUE,
       updated_at = NOW()`,
    [email.toLowerCase(), passwordHash, name],
  );
  console.log(`[seed] super admin ready: ${email}`);
}

async function seedInstitutions(): Promise<Array<{ id: string; code: string }>> {
  const demo = [
    { name: 'IES Gran Canaria Centro', code: 'IES-GC-01', contact: 'centro@ies-gc.example' },
    { name: 'Academia Salud Las Palmas', code: 'ASL-LP-02', contact: 'info@asl-lp.example' },
  ];
  const result: Array<{ id: string; code: string }> = [];
  for (const inst of demo) {
    const { rows } = await query<{ id: string; code: string }>(
      `INSERT INTO institutions (name, code, contact_email)
       VALUES ($1, $2, $3)
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
       RETURNING id, code`,
      [inst.name, inst.code, inst.contact],
    );
    result.push(rows[0]);
  }
  console.log(`[seed] institutions ready: ${result.map((r) => r.code).join(', ')}`);
  return result;
}

async function seedInstitutionAdmin(institutionId: string): Promise<void> {
  const passwordHash = await hashPassword('Instituto123!');
  await query(
    `INSERT INTO users (email, password_hash, name, role, institution_id, is_active)
     VALUES ($1, $2, $3, 'institution_admin', $4, TRUE)
     ON CONFLICT (email) DO NOTHING`,
    ['admin.centro@ies-gc.example', passwordHash, 'Admin IES Centro', institutionId],
  );
  console.log('[seed] demo institution_admin ready: admin.centro@ies-gc.example / Instituto123!');
}

async function seedStudents(institutionId: string): Promise<void> {
  // Adult student with email + password (login methods 1 & 2)
  const adultHash = await hashPassword('Alumno123!');
  await query(
    `INSERT INTO students (institution_id, display_name, access_code, is_minor, email, password_hash, identity_hash)
     VALUES ($1, $2, $3, FALSE, $4, $5, $6)
     ON CONFLICT (email) DO NOTHING`,
    [
      institutionId,
      'Ana (demo adulto)',
      generateAccessCode(),
      'alumno@demo.example',
      adultHash,
      identityHash(institutionId, 'alumno@demo.example'),
    ],
  );

  // Minor student with a FIXED access code so it's easy to test (method 3).
  await query(
    `INSERT INTO students (institution_id, display_name, access_code, is_minor, identity_hash)
     VALUES ($1, $2, $3, TRUE, $4)
     ON CONFLICT (access_code) DO NOTHING`,
    [
      institutionId,
      'Alumno Menor (demo)',
      'RCP-DEMO-2026',
      identityHash(institutionId, 'menor-demo-2026'),
    ],
  );
  console.log('[seed] demo students ready: alumno@demo.example / Alumno123!  |  code RCP-DEMO-2026');
}

async function seedQuestions(): Promise<void> {
  await withTransaction(async (client) => {
    for (const q of DEMO_QUESTIONS) {
      await client.query(
        `INSERT INTO questions (category, text, options, correct_index, explanation, difficulty, audiences, qtype)
         SELECT $1, $2, $3::jsonb, $4, $5, $6, $7, $8
         WHERE NOT EXISTS (SELECT 1 FROM questions WHERE text = $2)`,
        [q.category, q.text, JSON.stringify(q.options), q.correct, q.explanation, q.difficulty, ['jovenes', 'adultos'], 'teorica'],
      );
    }
  });
  const { rows } = await query<{ count: string }>('SELECT COUNT(*) FROM questions');
  console.log(`[seed] question bank ready: ${rows[0].count} questions`);
}

export async function seed(): Promise<void> {
  console.log('[seed] seeding database...');
  await seedSuperAdmin();
  const institutions = await seedInstitutions();
  await seedInstitutionAdmin(institutions[0].id);
  await seedStudents(institutions[0].id);
  await seedQuestions();
  console.log('[seed] seeding complete ✅');
}

// Allow running standalone: `npm run db:seed`
const invokedDirectly = process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js');
if (invokedDirectly) {
  seed()
    .then(() => pool.end())
    .catch((err) => {
      console.error('[seed] failed ❌:', err.message);
      return pool.end().finally(() => process.exit(1));
    });
}
