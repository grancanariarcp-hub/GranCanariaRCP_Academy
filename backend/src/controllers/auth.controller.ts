import type { Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../config/database.js';
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
  const { accessCode } = studentLoginCodeSchema.parse(req.body);
  const ip = clientIp(req);
  const normalized = accessCode.trim().toUpperCase();

  const { rows } = await query<{
    id: string;
    display_name: string;
    institution_id: string;
    is_active: boolean;
  }>(
    `SELECT id, display_name, institution_id, is_active
     FROM students WHERE access_code = $1`,
    [normalized],
  );

  const student = rows[0];
  if (!student || !student.is_active) {
    await audit({ actorType: 'anonymous', action: 'STUDENT_LOGIN_FAILED', ip, metadata: { accessCode: normalized } });
    throw unauthorized('Código de acceso no válido', 'BAD_CODE');
  }

  await query('UPDATE students SET last_login_at = NOW() WHERE id = $1', [student.id]);

  const token = signToken({
    sub: student.id,
    role: 'student',
    institutionId: student.institution_id,
    name: student.display_name,
  });

  await audit({ actorId: student.id, actorType: 'student', action: 'STUDENT_LOGIN_SUCCESS', entity: 'student', entityId: student.id, ip, metadata: { method: 'code' } });

  res.json({
    token,
    user: { id: student.id, name: student.display_name, role: 'student', institutionId: student.institution_id },
  });
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
