import { query } from '../config/database.js';

/**
 * Completitud del perfil docente.
 *
 * El currículum es lo que sostiene la confianza en formación sanitaria: el
 * alumno debe saber quién le enseña. Por eso se exige para PUBLICAR un curso,
 * no para registrarse: pedirlo el día del alta espantaría a profesores que aún
 * no han decidido nada, y publicar es el momento en que el currículum importa
 * de verdad, porque es cuando lo van a leer los alumnos.
 */

export interface EstadoPerfil {
  completo: boolean;
  faltan: string[];
  progresoPct: number;
  requisitos: Array<{ clave: string; etiqueta: string; cumplido: boolean; ayuda: string }>;
}

export async function estadoPerfilDocente(userId: string): Promise<EstadoPerfil> {
  const u = await query<{ name: string; headline: string | null; profession: string | null; photo_key: string | null }>(
    'SELECT name, headline, profession, photo_key FROM users WHERE id = $1',
    [userId],
  );
  const cv = await query<{ category: string; n: string }>(
    'SELECT category, COUNT(*)::text AS n FROM cv_items WHERE user_id = $1 GROUP BY category',
    [userId],
  );
  const porCategoria = new Map(cv.rows.map((r) => [r.category, Number(r.n)]));
  const p = u.rows[0];

  // Mínimo razonable, no un currículum completo: lo suficiente para que el
  // alumno sepa quién firma el curso.
  const requisitos = [
    {
      clave: 'headline',
      etiqueta: 'Titular profesional',
      cumplido: !!p?.headline && p.headline.trim().length >= 5,
      ayuda: 'Una línea que te describa: «Enfermero de UCI · Instructor de SVA».',
    },
    {
      clave: 'profession',
      etiqueta: 'Profesión sanitaria',
      cumplido: !!p?.profession && p.profession.trim().length > 0,
      ayuda: 'Tu profesión colegiada: médico, enfermero, técnico de emergencias…',
    },
    {
      clave: 'formacion',
      etiqueta: 'Al menos una formación',
      cumplido: (porCategoria.get('formacion') ?? 0) >= 1,
      ayuda: 'Titulación, especialidad o curso relevante para lo que impartes.',
    },
    {
      clave: 'experiencia',
      etiqueta: 'Al menos una experiencia',
      cumplido: (porCategoria.get('experiencia') ?? 0) >= 1,
      ayuda: 'Dónde ejerces o has ejercido, y desde cuándo.',
    },
  ];

  const cumplidos = requisitos.filter((r) => r.cumplido).length;
  return {
    completo: cumplidos === requisitos.length,
    faltan: requisitos.filter((r) => !r.cumplido).map((r) => r.etiqueta),
    progresoPct: Math.round((cumplidos / requisitos.length) * 100),
    requisitos,
  };
}
