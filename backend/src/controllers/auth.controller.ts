import type { Request, Response } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../config/database.js';
import { hashPassword, verifyPassword, generateAccessCode, identityHash } from '../utils/crypto.js';
import { signToken } from '../utils/jwt.js';
import { badRequest, conflict, unauthorized } from '../utils/httpError.js';
import { audit } from '../services/audit.js';
import { clientIp } from '../utils/asyncHandler.js';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const adminLoginSchema = z.object({
  email: z.string().email('Email no válido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

const studentRegisterSchema = z.object({
  displayName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(120),
  email: z.string().email('Email no válido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  institutionCode: z.string().min(2, 'Código de institución requerido'),
});

const studentLoginEmailSchema = z.object({
  email: z.string().email('Email no válido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

const studentLoginCodeSchema = z.object({
  accessCode: z.string().min(4, 'Código de acceso requerido'),
  nickname: z.string().min(2).max(120).optional(),
  age: z.number().int().min(3).max(17).optional(),
});

// ---------------------------------------------------------------------------
// Admin login (super_admin + institution_admin share this endpoint)
// ---------------------------------------------------------------------------
export async function adminLogin(req: Request, res: Response): Promise<void> {
  const { email, password } = adminLoginSchema.parse(req.body);
  const ip = clientIp(req);

  const { rows } = await query<{
    id: string;
    password_hash: string;
    name: string;
    role: 'super_admin' | 'institution_admin' | 'profesor';
    institution_id: string | null;
    is_active: boolean;
    status: string;
  }>(
    `SELECT id, password_hash, name, role, institution_id, is_active, status
     FROM users WHERE email = $1`,
    [email.toLowerCase()],
  );

  const user = rows[0];
  // Verify a hash even when the user doesn't exist to avoid timing-based
  // account enumeration, then fail with the same generic message.
  const ok = user
    ? user.is_active && (await verifyPassword(password, user.password_hash))
    : await verifyPassword(password, '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva');

  if (!user || !ok) {
    await audit({
      actorType: 'anonymous',
      action: 'AUTH_LOGIN_FAILED',
      entity: 'user',
      ip,
      metadata: { email: email.toLowerCase() },
    });
    throw unauthorized('Credenciales incorrectas', 'BAD_CREDENTIALS');
  }

  // A professor account must be approved by a super_admin before it can log in.
  if (user.status === 'pending') {
    throw unauthorized('Tu cuenta de profesor está pendiente de validación', 'PENDING_APPROVAL');
  }
  if (user.status === 'rejected') {
    throw unauthorized('Tu solicitud de profesor no fue aprobada', 'REJECTED');
  }

  await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

  const token = signToken({
    sub: user.id,
    role: user.role,
    institutionId: user.institution_id,
    name: user.name,
  });

  await audit({
    actorId: user.id,
    actorType: user.role,
    action: 'AUTH_LOGIN_SUCCESS',
    entity: 'user',
    entityId: user.id,
    ip,
  });

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      institutionId: user.institution_id,
    },
  });
}

// ---------------------------------------------------------------------------
// Professor self-registration -> creates a PENDING account (needs approval)
// ---------------------------------------------------------------------------
const professorRegisterSchema = z.object({
  name: z.string().min(2, 'El nombre es obligatorio').max(160),
  email: z.string().email('Email no válido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  headline: z.string().max(160).optional(),
});

export async function professorRegister(req: Request, res: Response): Promise<void> {
  const { name, email, password, headline } = professorRegisterSchema.parse(req.body);
  const ip = clientIp(req);

  const existing = await query('SELECT 1 FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing.rows.length > 0) throw conflict('Ya existe una cuenta con ese email', 'EMAIL_TAKEN');

  const passwordHash = await hashPassword(password);
  const { rows } = await query<{ id: string }>(
    `INSERT INTO users (email, password_hash, name, role, institution_id, status, headline)
     VALUES ($1, $2, $3, 'profesor', NULL, 'pending', $4)
     RETURNING id`,
    [email.toLowerCase(), passwordHash, name, headline ?? null],
  );

  await audit({
    actorId: rows[0].id, actorType: 'profesor', action: 'PROFESSOR_REGISTER',
    entity: 'user', entityId: rows[0].id, ip, metadata: { email: email.toLowerCase() },
  });

  res.status(201).json({ ok: true, message: 'Solicitud enviada. Un administrador validará tu cuenta.' });
}

// ---------------------------------------------------------------------------
// Student method 1: register (adults) -> email + password
// ---------------------------------------------------------------------------
export async function studentRegister(req: Request, res: Response): Promise<void> {
  const { displayName, email, password, institutionCode } = studentRegisterSchema.parse(req.body);
  const ip = clientIp(req);

  const inst = await query<{ id: string }>(
    'SELECT id FROM institutions WHERE code = $1 AND is_active = TRUE',
    [institutionCode.toUpperCase()],
  );
  if (inst.rows.length === 0) {
    throw badRequest('Código de institución no válido', 'BAD_INSTITUTION');
  }
  const institutionId = inst.rows[0].id;

  const existing = await query('SELECT 1 FROM students WHERE email = $1', [email.toLowerCase()]);
  if (existing.rows.length > 0) {
    throw conflict('Ya existe una cuenta con ese email', 'EMAIL_TAKEN');
  }

  const passwordHash = await hashPassword(password);
  const accessCode = generateAccessCode();

  const { rows } = await query<{ id: string }>(
    `INSERT INTO students (institution_id, display_name, access_code, is_minor, email, password_hash, identity_hash)
     VALUES ($1, $2, $3, FALSE, $4, $5, $6)
     RETURNING id`,
    [
      institutionId,
      displayName,
      accessCode,
      email.toLowerCase(),
      passwordHash,
      identityHash(institutionId, email.toLowerCase()),
    ],
  );
  const studentId = rows[0].id;

  const token = signToken({
    sub: studentId,
    role: 'student',
    institutionId,
    name: displayName,
  });

  await audit({
    actorId: studentId,
    actorType: 'student',
    action: 'STUDENT_REGISTER',
    entity: 'student',
    entityId: studentId,
    ip,
  });

  res.status(201).json({
    token,
    // Return the access code once so the student can also use quick login later.
    accessCode,
    user: { id: studentId, name: displayName, role: 'student', institutionId },
  });
}

// ---------------------------------------------------------------------------
// Student method 2: login with email + password (adults)
// ---------------------------------------------------------------------------
export async function studentLoginEmail(req: Request, res: Response): Promise<void> {
  const { email, password } = studentLoginEmailSchema.parse(req.body);
  const ip = clientIp(req);

  const { rows } = await query<{
    id: string;
    display_name: string;
    password_hash: string | null;
    institution_id: string;
    is_active: boolean;
  }>(
    `SELECT id, display_name, password_hash, institution_id, is_active
     FROM students WHERE email = $1`,
    [email.toLowerCase()],
  );

  const student = rows[0];
  const ok =
    student && student.password_hash
      ? student.is_active && (await verifyPassword(password, student.password_hash))
      : await verifyPassword(password, '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva');

  if (!student || !student.password_hash || !ok) {
    await audit({ actorType: 'anonymous', action: 'STUDENT_LOGIN_FAILED', ip, metadata: { email: email.toLowerCase() } });
    throw unauthorized('Credenciales incorrectas', 'BAD_CREDENTIALS');
  }

  await query('UPDATE students SET last_login_at = NOW() WHERE id = $1', [student.id]);

  const token = signToken({
    sub: student.id,
    role: 'student',
    institutionId: student.institution_id,
    name: student.display_name,
  });

  await audit({ actorId: student.id, actorType: 'student', action: 'STUDENT_LOGIN_SUCCESS', entity: 'student', entityId: student.id, ip });

  res.json({
    token,
    user: { id: student.id, name: student.display_name, role: 'student', institutionId: student.institution_id },
  });
}

// ---------------------------------------------------------------------------
// Student method 3: login with access code (minors / quick access)
// ---------------------------------------------------------------------------
export async function studentLoginCode(req: Request, res: Response): Promise<void> {
  const { accessCode, nickname, age } = studentLoginCodeSchema.parse(req.body);
  const ip = clientIp(req);
  const normalized = accessCode.trim().toUpperCase();

  const { rows } = await query<{
    id: string;
    display_name: string;
    institution_id: string | null;
    class_id: string | null;
    is_active: boolean;
  }>(
    `SELECT id, display_name, institution_id, class_id, is_active
     FROM students WHERE access_code = $1`,
    [normalized],
  );

  const student = rows[0];
  if (!student || !student.is_active) {
    await audit({ actorType: 'anonymous', action: 'STUDENT_LOGIN_FAILED', ip, metadata: { accessCode: normalized } });
    throw unauthorized('Código de acceso no válido', 'BAD_CODE');
  }

  // Minors identify with a pseudonym + age (RGPD: no real name / email).
  const displayName = nickname?.trim() || student.display_name;
  // El seudónimo debe ser único dentro de la clase.
  if (nickname && student.class_id) {
    const dup = await query('SELECT 1 FROM students WHERE class_id = $1 AND LOWER(display_name) = LOWER($2) AND id <> $3',
      [student.class_id, displayName, student.id]);
    if (dup.rows.length > 0) throw conflict('Ese apodo ya está en uso en tu clase, elige otro', 'NICKNAME_TAKEN');
  }
  if (nickname || age !== undefined) {
    await query('UPDATE students SET display_name = $1, age = COALESCE($2, age), last_login_at = NOW() WHERE id = $3',
      [displayName, age ?? null, student.id]);
  } else {
    await query('UPDATE students SET last_login_at = NOW() WHERE id = $1', [student.id]);
  }

  const token = signToken({
    sub: student.id,
    role: 'student',
    institutionId: student.institution_id,
    name: displayName,
  });

  await audit({ actorId: student.id, actorType: 'student', action: 'STUDENT_LOGIN_SUCCESS', entity: 'student', entityId: student.id, ip, metadata: { method: 'code' } });

  res.json({
    token,
    user: { id: student.id, name: displayName, role: 'student', institutionId: student.institution_id },
  });
}

// ---------------------------------------------------------------------------
// Minor login (method 4): institución + seudónimo + edad (sin el código en mano)
// ---------------------------------------------------------------------------
const studentLoginInstitutionSchema = z.object({
  institutionId: z.string().uuid(),
  nickname: z.string().min(2).max(120),
  age: z.number().int().min(3).max(17),
});

export async function studentLoginInstitution(req: Request, res: Response): Promise<void> {
  const { institutionId, nickname, age } = studentLoginInstitutionSchema.parse(req.body);
  const ip = clientIp(req);

  const { rows } = await query<{ id: string; display_name: string; institution_id: string | null }>(
    `SELECT id, display_name, institution_id FROM students
     WHERE institution_id = $1 AND is_minor = TRUE AND is_active = TRUE
       AND LOWER(display_name) = LOWER($2) AND age = $3`,
    [institutionId, nickname.trim(), age],
  );

  if (rows.length === 0) {
    await audit({ actorType: 'anonymous', action: 'STUDENT_LOGIN_FAILED', ip, metadata: { method: 'institution' } });
    throw unauthorized('No encontramos ese apodo y edad en esa institución. Usa tu código.', 'NOT_FOUND');
  }
  if (rows.length > 1) {
    throw conflict('Hay varios alumnos con ese apodo y edad. Entra con tu código.', 'AMBIGUOUS');
  }

  const student = rows[0];
  await query('UPDATE students SET last_login_at = NOW() WHERE id = $1', [student.id]);
  const token = signToken({ sub: student.id, role: 'student', institutionId: student.institution_id, name: student.display_name });
  await audit({ actorId: student.id, actorType: 'student', action: 'STUDENT_LOGIN_SUCCESS', entity: 'student', entityId: student.id, ip, metadata: { method: 'institution' } });
  res.json({ token, user: { id: student.id, name: student.display_name, role: 'student', institutionId: student.institution_id } });
}

// ---------------------------------------------------------------------------
// Unified login (email + password) — works for admins, professors and students
// ---------------------------------------------------------------------------
const unifiedLoginSchema = z.object({
  email: z.string().email('Email no válido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

export async function unifiedLogin(req: Request, res: Response): Promise<void> {
  const { email, password } = unifiedLoginSchema.parse(req.body);
  const ip = clientIp(req);
  const lower = email.toLowerCase();

  // 1) Staff (super_admin / institution_admin / profesor)
  const u = await query<{
    id: string; password_hash: string; name: string;
    role: 'super_admin' | 'institution_admin' | 'profesor';
    institution_id: string | null; is_active: boolean; status: string;
  }>('SELECT id, password_hash, name, role, institution_id, is_active, status FROM users WHERE email = $1', [lower]);

  if (u.rows.length > 0) {
    const user = u.rows[0];
    if (user.is_active && (await verifyPassword(password, user.password_hash))) {
      if (user.status === 'pending') throw unauthorized('Tu cuenta de profesor está pendiente de validación', 'PENDING_APPROVAL');
      if (user.status === 'rejected') throw unauthorized('Tu solicitud no fue aprobada', 'REJECTED');
      await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);
      const token = signToken({ sub: user.id, role: user.role, institutionId: user.institution_id, name: user.name });
      await audit({ actorId: user.id, actorType: user.role, action: 'AUTH_LOGIN_SUCCESS', entity: 'user', entityId: user.id, ip });
      res.json({ token, user: { id: user.id, name: user.name, role: user.role, institutionId: user.institution_id } });
      return;
    }
  }

  // 2) Students (adults with email + password)
  const s = await query<{
    id: string; display_name: string; password_hash: string | null; institution_id: string | null; is_active: boolean;
  }>('SELECT id, display_name, password_hash, institution_id, is_active FROM students WHERE email = $1', [lower]);

  if (s.rows.length > 0 && s.rows[0].password_hash) {
    const st = s.rows[0];
    if (st.is_active && (await verifyPassword(password, st.password_hash!))) {
      await query('UPDATE students SET last_login_at = NOW() WHERE id = $1', [st.id]);
      const token = signToken({ sub: st.id, role: 'student', institutionId: st.institution_id, name: st.display_name });
      await audit({ actorId: st.id, actorType: 'student', action: 'STUDENT_LOGIN_SUCCESS', entity: 'student', entityId: st.id, ip });
      res.json({ token, user: { id: st.id, name: st.display_name, role: 'student', institutionId: st.institution_id } });
      return;
    }
  }

  await audit({ actorType: 'anonymous', action: 'AUTH_LOGIN_FAILED', ip, metadata: { email: lower } });
  throw unauthorized('Credenciales incorrectas', 'BAD_CREDENTIALS');
}

// ---------------------------------------------------------------------------
// Public student registration (adult) — no institution required
// ---------------------------------------------------------------------------
const publicRegisterSchema = z.object({
  name: z.string().min(2, 'El nombre es obligatorio').max(120),
  email: z.string().email('Email no válido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  institutionId: z.string().uuid().optional(), // institución a la que representa (opcional)
});

export async function studentRegisterPublic(req: Request, res: Response): Promise<void> {
  const { name, email, password, institutionId } = publicRegisterSchema.parse(req.body);
  const ip = clientIp(req);
  const lower = email.toLowerCase();

  const taken = await query('SELECT 1 FROM students WHERE email = $1 UNION SELECT 1 FROM users WHERE email = $1', [lower]);
  if (taken.rows.length > 0) throw conflict('Ya existe una cuenta con ese email', 'EMAIL_TAKEN');

  // Si elige representar a una institución, debe existir y estar activa.
  let instId: string | null = null;
  if (institutionId) {
    const inst = await query('SELECT 1 FROM institutions WHERE id = $1 AND status = $2', [institutionId, 'active']);
    if (inst.rows.length === 0) throw badRequest('Institución no válida', 'BAD_INSTITUTION');
    instId = institutionId;
  }

  const passwordHash = await hashPassword(password);
  const accessCode = generateAccessCode();
  const { rows } = await query<{ id: string }>(
    `INSERT INTO students (institution_id, display_name, access_code, is_minor, email, password_hash, identity_hash)
     VALUES ($1, $2, $3, FALSE, $4, $5, NULL) RETURNING id`,
    [instId, name, accessCode, lower, passwordHash],
  );
  const studentId = rows[0].id;
  const token = signToken({ sub: studentId, role: 'student', institutionId: instId, name });
  await audit({ actorId: studentId, actorType: 'student', action: 'STUDENT_REGISTER', entity: 'student', entityId: studentId, ip });
  res.status(201).json({ token, user: { id: studentId, name, role: 'student', institutionId: instId } });
}

// ---------------------------------------------------------------------------
// Institution self-registration (queda pendiente de validación del super_admin)
// ---------------------------------------------------------------------------
const institutionRegisterSchema = z.object({
  name: z.string().min(2).max(160),
  address: z.string().max(500).optional(),
  contactName: z.string().max(160).optional(),
  contactEmail: z.string().email(),
  contactPhone: z.string().max(40).optional(),
  adminName: z.string().min(2).max(160),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

/** Genera un código único de institución a partir del nombre. */
async function uniqueInstitutionCode(name: string): Promise<string> {
  const base = name.toUpperCase().normalize('NFD').replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'INST';
  for (let i = 0; i < 20; i++) {
    const suffix = Math.floor(1000 + Math.random() * 9000); // 4 dígitos
    const code = `${base}-${suffix}`.slice(0, 32);
    const exists = await query('SELECT 1 FROM institutions WHERE code = $1', [code]);
    if (exists.rows.length === 0) return code;
  }
  return `INST-${Date.now().toString().slice(-8)}`;
}

export async function institutionRegister(req: Request, res: Response): Promise<void> {
  const d = institutionRegisterSchema.parse(req.body);
  const adminEmail = d.adminEmail.toLowerCase();

  const taken = await query('SELECT 1 FROM users WHERE email = $1 UNION SELECT 1 FROM students WHERE email = $1', [adminEmail]);
  if (taken.rows.length > 0) throw conflict('Ya existe una cuenta con ese email', 'EMAIL_TAKEN');

  const code = await uniqueInstitutionCode(d.name);
  const passwordHash = await hashPassword(d.adminPassword);

  const institutionId = await withTransaction(async (client) => {
    const inst = await client.query<{ id: string }>(
      `INSERT INTO institutions (name, code, contact_email, contact_name, contact_phone, address, status, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,'pending',FALSE) RETURNING id`,
      [d.name, code, d.contactEmail.toLowerCase(), d.contactName ?? null, d.contactPhone ?? null, d.address ?? null],
    );
    const id = inst.rows[0].id;
    await client.query(
      `INSERT INTO users (email, password_hash, name, role, institution_id, status)
       VALUES ($1,$2,$3,'institution_admin',$4,'active')`,
      [adminEmail, passwordHash, d.adminName, id],
    );
    return id;
  });

  await audit({ actorId: institutionId, actorType: 'institution_admin', action: 'INSTITUTION_REGISTER', entity: 'institution', entityId: institutionId, ip: clientIp(req) });
  res.status(201).json({ ok: true, message: 'Institución registrada. La validaremos y podrás empezar a crear clases.' });
}

// ---------------------------------------------------------------------------
// Logout (stateless JWT: client discards token; we just log the event)
// ---------------------------------------------------------------------------
export async function logout(req: Request, res: Response): Promise<void> {
  if (req.auth) {
    await audit({ actorId: req.auth.sub, actorType: req.auth.role, action: 'AUTH_LOGOUT', ip: clientIp(req) });
  }
  res.json({ ok: true });
}

// ---------------------------------------------------------------------------
// Who am I (validates token, returns current identity)
// ---------------------------------------------------------------------------
export async function me(req: Request, res: Response): Promise<void> {
  res.json({ user: req.auth });
}
