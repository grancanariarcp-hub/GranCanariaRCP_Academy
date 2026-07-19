import type { Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../config/database.js';
import { hashPassword } from '../utils/crypto.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/httpError.js';
import { audit } from '../services/audit.js';
import { notify } from '../services/notify.js';
import { clientIp } from '../utils/asyncHandler.js';
import { r2Configured, buildKey, uploadObject, withImageUrls } from '../services/r2.js';

/**
 * All handlers here assume requireRole('super_admin') has run,
 * except where noted. super_admin sees everything globally.
 */

// ---------------------------------------------------------------------------
// GET /api/admin/stats  -> global KPIs for the dashboard
// ---------------------------------------------------------------------------
export async function getStats(_req: Request, res: Response): Promise<void> {
  const [students, institutions, responses, admins, avg] = await Promise.all([
    query<{ count: string }>('SELECT COUNT(*) FROM students WHERE is_active = TRUE'),
    query<{ count: string }>('SELECT COUNT(*) FROM institutions WHERE is_active = TRUE'),
    query<{ count: string }>('SELECT COUNT(*) FROM test_responses'),
    query<{ count: string }>("SELECT COUNT(*) FROM users WHERE role = 'institution_admin'"),
    query<{ avg: string | null }>(
      `SELECT ROUND(AVG(CASE WHEN is_correct THEN 100 ELSE 0 END))::text AS avg FROM test_responses`,
    ),
  ]);

  res.json({
    students: Number(students.rows[0].count),
    institutions: Number(institutions.rows[0].count),
    testResponses: Number(responses.rows[0].count),
    institutionAdmins: Number(admins.rows[0].count),
    averageScore: avg.rows[0].avg ? Number(avg.rows[0].avg) : null,
  });
}

// ---------------------------------------------------------------------------
// Institutions
// ---------------------------------------------------------------------------
export async function listInstitutions(_req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT i.id, i.name, i.code, i.contact_email, i.contact_name, i.contact_phone, i.address, i.status, i.is_active, i.created_at,
            (SELECT COUNT(*) FROM students s WHERE s.institution_id = i.id) AS student_count
     FROM institutions i
     ORDER BY (i.status = 'pending') DESC, i.created_at DESC`,
  );
  res.json({ institutions: rows });
}

const createInstitutionSchema = z.object({
  name: z.string().min(2).max(160),
  code: z.string().min(2).max(32),
  contactEmail: z.string().email().optional().or(z.literal('')),
});

export async function createInstitution(req: Request, res: Response): Promise<void> {
  const { name, code, contactEmail } = createInstitutionSchema.parse(req.body);
  const normalizedCode = code.toUpperCase();

  const existing = await query('SELECT 1 FROM institutions WHERE code = $1', [normalizedCode]);
  if (existing.rows.length > 0) {
    throw conflict('Ya existe una institución con ese código', 'CODE_TAKEN');
  }

  const { rows } = await query(
    `INSERT INTO institutions (name, code, contact_email)
     VALUES ($1, $2, $3)
     RETURNING id, name, code, contact_email, is_active, created_at`,
    [name, normalizedCode, contactEmail || null],
  );

  await audit({
    actorId: req.auth!.sub,
    actorType: req.auth!.role,
    action: 'INSTITUTION_CREATE',
    entity: 'institution',
    entityId: rows[0].id,
    ip: clientIp(req),
    metadata: { code: normalizedCode },
  });

  res.status(201).json({ institution: rows[0] });
}

// ---------------------------------------------------------------------------
// Admins (institution_admin accounts) - create + list
// ---------------------------------------------------------------------------
export async function listAdmins(_req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT u.id, u.email, u.name, u.role, u.is_active, u.last_login_at, u.created_at,
            i.name AS institution_name, i.code AS institution_code
     FROM users u
     LEFT JOIN institutions i ON i.id = u.institution_id
     ORDER BY u.created_at DESC`,
  );
  res.json({ admins: rows });
}

const createAdminSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(160),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  institutionId: z.string().uuid('Institución no válida'),
});

export async function createAdmin(req: Request, res: Response): Promise<void> {
  const { email, name, password, institutionId } = createAdminSchema.parse(req.body);

  const inst = await query('SELECT 1 FROM institutions WHERE id = $1', [institutionId]);
  if (inst.rows.length === 0) throw badRequest('Institución no encontrada', 'BAD_INSTITUTION');

  const existing = await query('SELECT 1 FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing.rows.length > 0) throw conflict('Ya existe un usuario con ese email', 'EMAIL_TAKEN');

  const passwordHash = await hashPassword(password);
  const { rows } = await query(
    `INSERT INTO users (email, password_hash, name, role, institution_id)
     VALUES ($1, $2, $3, 'institution_admin', $4)
     RETURNING id, email, name, role, institution_id, created_at`,
    [email.toLowerCase(), passwordHash, name, institutionId],
  );

  await audit({
    actorId: req.auth!.sub,
    actorType: req.auth!.role,
    action: 'ADMIN_CREATE',
    entity: 'user',
    entityId: rows[0].id,
    ip: clientIp(req),
    metadata: { email: email.toLowerCase(), institutionId },
  });

  res.status(201).json({ admin: rows[0] });
}

// ---------------------------------------------------------------------------
// Professors: list, validate (approve/reject), create directly
// ---------------------------------------------------------------------------
export async function listProfessors(_req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT id, email, name, headline, status, last_login_at, created_at
     FROM users WHERE role = 'profesor'
     ORDER BY (status = 'pending') DESC, created_at DESC`,
  );
  res.json({ professors: rows });
}

export async function setProfessorStatus(req: Request, res: Response): Promise<void> {
  const status = req.params.action === 'approve' ? 'active' : 'rejected';
  const { rows } = await query(
    `UPDATE users SET status = $1, updated_at = NOW()
     WHERE id = $2 AND role = 'profesor'
     RETURNING id, email, name, status`,
    [status, req.params.id],
  );
  if (rows.length === 0) throw notFound('Profesor no encontrado');

  await notify(
    { id: rows[0].id, type: 'user' },
    status === 'active' ? 'Perfil de profesor validado' : 'Solicitud de profesor rechazada',
    status === 'active' ? 'Tu perfil ha sido aprobado. Ya puedes acceder y gestionar cursos.' : 'Tu solicitud de profesor no ha sido aprobada.',
    '/admin',
  ).catch(() => { /* no bloquear */ });

  await audit({
    actorId: req.auth!.sub, actorType: req.auth!.role,
    action: status === 'active' ? 'PROFESSOR_APPROVE' : 'PROFESSOR_REJECT',
    entity: 'user', entityId: rows[0].id, ip: clientIp(req),
  });
  res.json({ professor: rows[0] });
}

const createProfessorSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(160),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  headline: z.string().max(160).optional(),
});

export async function createProfessor(req: Request, res: Response): Promise<void> {
  const { email, name, password, headline } = createProfessorSchema.parse(req.body);
  const existing = await query('SELECT 1 FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing.rows.length > 0) throw conflict('Ya existe un usuario con ese email', 'EMAIL_TAKEN');

  const passwordHash = await hashPassword(password);
  const { rows } = await query(
    `INSERT INTO users (email, password_hash, name, role, institution_id, status, headline)
     VALUES ($1, $2, $3, 'profesor', NULL, 'active', $4)
     RETURNING id, email, name, headline, status, created_at`,
    [email.toLowerCase(), passwordHash, name, headline ?? null],
  );

  await audit({
    actorId: req.auth!.sub, actorType: req.auth!.role, action: 'PROFESSOR_CREATE',
    entity: 'user', entityId: rows[0].id, ip: clientIp(req), metadata: { email: email.toLowerCase() },
  });
  res.status(201).json({ professor: rows[0] });
}

// ---------------------------------------------------------------------------
// Questions (super_admin can create question-bank items)
// ---------------------------------------------------------------------------
const createQuestionSchema = z
  .object({
    bankId: z.string().uuid('Elige el banco al que pertenece'), // obligatorio: nunca preguntas huérfanas
    tema: z.string().max(160).optional(),
    category: z.enum(['SVB', 'SVI', 'SVA']).optional(), // nivel (solo bancos de RCP)
    audiences: z.array(z.enum(['ninos', 'jovenes', 'adultos'])).min(1, 'Elige al menos un público'),
    qtype: z.enum(['teorica', 'caso_clinico']).default('teorica'),
    difficulty: z.number().int().min(1).max(3).default(1),
    text: z.string().min(10),
    clinicalContext: z.string().optional(),
    options: z.array(z.string().min(1)).min(2).max(6),
    correctIndex: z.number().int().min(0),
    explanation: z.string().optional(),
    sourceErc: z.string().optional(),
    sourcePlanNacional: z.string().optional(),
    videoUrl: z.string().url('URL de vídeo no válida').optional().or(z.literal('')),
    flashcard: z.string().optional(),
    tags: z.array(z.string()).optional().default([]),
    isCritical: z.boolean().optional().default(false),
    refDocumentId: z.string().uuid().optional().or(z.literal('')),
    refPage: z.coerce.number().int().positive().optional(),
  })
  .refine((d) => d.correctIndex < d.options.length, {
    message: 'La opción correcta está fuera de rango',
    path: ['correctIndex'],
  })
  .refine((d) => d.qtype !== 'caso_clinico' || (d.clinicalContext && d.clinicalContext.trim().length > 0), {
    message: 'Un caso clínico necesita un contexto clínico',
    path: ['clinicalContext'],
  });

export async function createQuestion(req: Request, res: Response): Promise<void> {
  const data = createQuestionSchema.parse(req.body);

  // El banco debe existir y la pregunta no puede estar ya en él.
  const bank = await query<{ created_by: string | null }>(
    'SELECT created_by FROM question_banks WHERE id = $1', [data.bankId],
  );
  if (bank.rows.length === 0) throw badRequest('Banco no encontrado', 'BAD_BANK');
  if (req.auth!.role !== 'super_admin' && bank.rows[0].created_by !== req.auth!.sub) {
    throw badRequest('Solo puedes añadir preguntas a tus propios bancos', 'NOT_BANK_OWNER');
  }
  const dup = await query(
    `SELECT 1 FROM questions
      WHERE bank_id = $1 AND text_norm = md5(lower(regexp_replace($2, '[^[:alnum:]]+', '', 'g')))`,
    [data.bankId, data.text],
  );
  if (dup.rows.length > 0) throw conflict('Esa pregunta ya existe en este banco', 'DUPLICATE_QUESTION');

  const { rows } = await query(
    `INSERT INTO questions
       (bank_id, tema, category, audiences, qtype, difficulty, text, clinical_context, options, correct_index,
        explanation, source_erc, source_plan_nacional, video_url, flashcard, tags, is_critical,
        ref_document_id, ref_page, created_by, text_norm)
     VALUES ($19, $20, $1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
             md5(lower(regexp_replace($5, '[^[:alnum:]]+', '', 'g'))))
     RETURNING id, category, audiences, qtype, difficulty, text, created_at`,
    [
      data.category ?? null,
      data.audiences,
      data.qtype,
      data.difficulty,
      data.text,
      data.clinicalContext ?? null,
      JSON.stringify(data.options),
      data.correctIndex,
      data.explanation ?? null,
      data.sourceErc ?? null,
      data.sourcePlanNacional ?? null,
      data.videoUrl || null,
      data.flashcard ?? null,
      data.tags ?? [],
      data.isCritical,
      data.refDocumentId || null,
      data.refPage ?? null,
      req.auth!.sub,
      data.bankId,        // $19
      data.tema ?? null,  // $20
    ],
  );

  await audit({
    actorId: req.auth!.sub,
    actorType: req.auth!.role,
    action: 'QUESTION_CREATE',
    entity: 'question',
    entityId: rows[0].id,
    ip: clientIp(req),
    metadata: { category: data.category, qtype: data.qtype, audiences: data.audiences },
  });

  res.status(201).json({ question: rows[0] });
}

// GET /api/admin/questions -> list with optional filters (level/audience/type)
export async function listQuestions(req: Request, res: Response): Promise<void> {
  const { level, audience, type, bankId, media } = req.query as Record<string, string | undefined>;
  const conditions: string[] = [];
  const params: unknown[] = [];

  // El profesorado solo ve las preguntas de los bancos que ha creado: los
  // bancos ajenos puede usarlos como fuente de exámenes, pero no inspeccionarlos.
  if (req.auth!.role !== 'super_admin') {
    params.push(req.auth!.sub);
    conditions.push(`bank_id IN (SELECT id FROM question_banks WHERE created_by = $${params.length})`);
  }

  if (level && ['SVB', 'SVI', 'SVA'].includes(level)) {
    params.push(level);
    conditions.push(`category = $${params.length}`);
  }
  if (audience && ['ninos', 'jovenes', 'adultos'].includes(audience)) {
    params.push(audience);
    conditions.push(`$${params.length} = ANY(audiences)`);
  }
  if (type && ['teorica', 'caso_clinico'].includes(type)) {
    params.push(type);
    conditions.push(`qtype = $${params.length}`);
  }

  if (bankId) {
    params.push(bankId);
    conditions.push(`bank_id = $${params.length}`);
  }
  // Filtro por soporte: preguntas con imagen, con vídeo o con cualquiera.
  if (media === 'imagen') conditions.push('image_key IS NOT NULL');
  else if (media === 'video') conditions.push("video_url IS NOT NULL AND video_url <> ''");
  else if (media === 'any') conditions.push("(image_key IS NOT NULL OR (video_url IS NOT NULL AND video_url <> ''))");

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT q.id, q.category, q.audiences, q.qtype, q.difficulty, q.text, q.tema, q.is_critical, q.is_active,
            q.image_key, q.video_url, q.created_at, b.name AS bank_name
     FROM questions q LEFT JOIN question_banks b ON b.id = q.bank_id
     ${where.replace(/(category|audiences|qtype|bank_id|image_key|video_url)/g, 'q.$1')}
     ORDER BY q.created_at DESC
     LIMIT 200`,
    params,
  );
  res.json({ questions: rows });
}

/**
 * Crear una pregunta CON IMAGEN (multipart). Igual que la creación normal —va a
 * un banco y lleva todas sus etiquetas— pero además sube la imagen a R2, para
 * que después se pueda filtrar por "preguntas con imagen".
 */
export async function createQuestionWithImage(req: Request, res: Response): Promise<void> {
  if (!r2Configured()) throw badRequest('El almacén de imágenes no está configurado', 'R2_NOT_CONFIGURED');
  const file = req.file;
  if (!file || !file.mimetype.startsWith('image/')) throw badRequest('Sube una imagen', 'NOT_IMAGE');

  // Los campos llegan como texto en el multipart.
  const body = req.body as Record<string, string>;
  const parsed = createQuestionSchema.parse({
    bankId: body.bankId,
    tema: body.tema || undefined,
    category: body.category || undefined,
    audiences: JSON.parse(body.audiences || '[]'),
    qtype: body.qtype || 'teorica',
    difficulty: Number(body.difficulty || 1),
    text: body.text,
    clinicalContext: body.clinicalContext || undefined,
    options: JSON.parse(body.options || '[]'),
    correctIndex: Number(body.correctIndex || 0),
    explanation: body.explanation || undefined,
    videoUrl: body.videoUrl || '',
    tags: JSON.parse(body.tags || '[]'),
    isCritical: body.isCritical === 'true',
  });

  const dup = await query(
    `SELECT 1 FROM questions
      WHERE bank_id = $1 AND text_norm = md5(lower(regexp_replace($2, '[^[:alnum:]]+', '', 'g')))`,
    [parsed.bankId, parsed.text],
  );
  if (dup.rows.length > 0) throw conflict('Esa pregunta ya existe en este banco', 'DUPLICATE_QUESTION');

  const key = buildKey(file.originalname, 'questions');
  await uploadObject(key, file.buffer, file.mimetype);

  const { rows } = await query(
    `INSERT INTO questions
       (bank_id, tema, category, audiences, qtype, difficulty, text, clinical_context, options, correct_index,
        explanation, video_url, image_key, tags, is_critical, created_by, text_norm)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,$15,$16,
             md5(lower(regexp_replace($7, '[^[:alnum:]]+', '', 'g'))))
     RETURNING id, text, image_key`,
    [parsed.bankId, parsed.tema ?? null, parsed.category ?? null, parsed.audiences, parsed.qtype, parsed.difficulty,
     parsed.text, parsed.clinicalContext ?? null, JSON.stringify(parsed.options), parsed.correctIndex,
     parsed.explanation ?? null, parsed.videoUrl || null, key, parsed.tags ?? [], parsed.isCritical, req.auth!.sub],
  );
  res.status(201).json({ question: (await withImageUrls(rows))[0] });
}

// ---------------------------------------------------------------------------
// Audit logs (super_admin only) - security review
// ---------------------------------------------------------------------------
export async function listAuditLogs(req: Request, res: Response): Promise<void> {
  if (req.auth!.role !== 'super_admin') throw forbidden();
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const { rows } = await query(
    `SELECT id, actor_id, actor_type, action, entity, entity_id, ip, metadata, created_at
     FROM audit_logs
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit],
  );
  res.json({ logs: rows });
}
