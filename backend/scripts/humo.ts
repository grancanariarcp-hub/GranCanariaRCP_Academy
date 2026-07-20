import 'dotenv/config';

/**
 * Prueba de humo: ¿sigue todo en pie?
 *
 *   npm run humo                 (contra el servidor local, en el puerto 5000)
 *   npm run humo -- https://…    (contra otro, por ejemplo producción)
 *
 * No sustituye a los tests (`npm test`), que comprueban reglas concretas sin
 * base de datos. Esto comprueba lo contrario: que la aplicación entera responde
 * y que las puertas que deben estar cerradas lo están.
 *
 * Se ejecuta antes de publicar. Es rápido y ha pillado ya varias regresiones
 * que la compilación no ve: una ruta que deja de existir, un permiso que se
 * afloja, un panel que se rompe al tocar otra cosa.
 *
 * Crea una cuenta de alumno de usar y tirar en cada ejecución; no borra nada.
 */

const API = process.argv[2] || 'http://localhost:5000';
let fallos = 0;

const ok = (etiqueta: string, cumple: boolean, detalle?: unknown): void => {
  console.log(`${cumple ? '  OK  ' : ' FALLO'} ${etiqueta}${cumple ? '' : ` -> ${JSON.stringify(detalle ?? null).slice(0, 140)}`}`);
  if (!cumple) fallos++;
};

async function call(ruta: string, opts: { method?: string; token?: string; body?: unknown } = {}) {
  const r = await fetch(`${API}${ruta}`, {
    method: opts.method ?? 'GET',
    headers: { 'Content-Type': 'application/json', ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  return { status: r.status, json: await r.json().catch(() => ({} as Record<string, unknown>)) };
}

async function main(): Promise<void> {
  console.log(`\nProbando ${API}\n`);

  console.log('— Público (sin sesión)');
  for (const ruta of [
    '/api/health', '/api/public/courses', '/api/public/challenges', '/api/public/professors',
    '/api/public/banks', '/api/public/rankings/individuals', '/api/public/institutions',
  ]) {
    ok(ruta, (await call(ruta)).status === 200);
  }

  // Lo que NO debe verse sin sesión. Cada una de estas fue una fuga real.
  const bancos = (await call('/api/public/banks')).json as { banks?: Array<Record<string, unknown>> };
  const lista = bancos.banks ?? [];
  ok('ningún banco privado en la lista pública', !lista.some((b) => b.visibility !== 'publico'));
  ok('ningún banco de oposición en la lista pública', !lista.some((b) => b.kind === 'ope' || b.kind === 'mir'));
  ok('nada marcado como administrable sin sesión', !lista.some((b) => b.canManage === true));
  ok('el acceso sin credencial de menores no existe',
    (await call('/api/auth/student/login-institution', { method: 'POST', body: { institutionId: '00000000-0000-0000-0000-000000000000', nickname: 'x', age: 10 } })).status === 404);

  console.log('\n— Administración');
  const admin = (await call('/api/auth/login', {
    method: 'POST', body: { email: process.env.SUPERADMIN_EMAIL, password: process.env.SUPERADMIN_PASSWORD },
  })).json.token as string | undefined;
  ok('acceso del super admin', !!admin);
  if (admin) {
    for (const ruta of [
      '/api/admin/dashboard', '/api/admin/stats', '/api/admin/leads', '/api/admin/anon-practice',
      '/api/admin/stripe-status', '/api/admin/convocatorias', '/api/admin/auditores',
      '/api/admin/recognition-templates', '/api/admin/challenges', '/api/admin/professors',
      '/api/banks', '/api/questions', '/api/documents', '/api/courses',
    ]) {
      const r = await call(ruta, { token: admin });
      ok(ruta, r.status === 200, r.json);
    }
    // Rutas duplicadas que se retiraron: si vuelven, es que alguien las remontó.
    for (const ruta of ['/api/admin/questions', '/api/admin/banks', '/api/admin/documents']) {
      ok(`${ruta} sigue retirada`, (await call(ruta, { token: admin })).status === 404);
    }
  }

  console.log('\n— Alumno');
  const email = `humo${Date.now()}@prueba.local`;
  await call('/api/auth/student/register-public', {
    method: 'POST', body: { name: 'Prueba de Humo', email, password: 'Alumno123!', acceptTerms: true },
  });
  const alumno = (await call('/api/auth/login', { method: 'POST', body: { email, password: 'Alumno123!' } })).json.token as string | undefined;
  ok('alta y acceso de un alumno', !!alumno);
  if (alumno) {
    for (const ruta of [
      '/api/student/dashboard', '/api/student/courses', '/api/student/available-courses',
      '/api/student/attendance', '/api/student/payments', '/api/practice/ope-banks',
      '/api/practice/convocatorias', '/api/practice/tests', '/api/practice/stats',
      '/api/profile', '/api/profile/sessions', '/api/profile/consents',
      '/api/profile/recognitions', '/api/notifications',
    ]) {
      const r = await call(ruta, { token: alumno });
      ok(ruta, r.status === 200, r.json);
    }
    ok('práctica de RCP con cuenta',
      (await call('/api/practice/start', { method: 'POST', token: alumno, body: { count: 5 } })).status === 200);
    ok('registro del tiempo de estudio',
      (await call('/api/profile/heartbeat', { method: 'POST', token: alumno, body: { seconds: 60, active: true } })).status === 200);
  }

  console.log('\n— Práctica libre (sin registrarse)');
  const visitante = `eeeeeeee-eeee-eeee-eeee-${String(Date.now()).slice(-12)}`;
  const libre = await call('/api/public/practice/start', { method: 'POST', body: { visitor: visitante } });
  ok(`sirve preguntas (${((libre.json as { questions?: unknown[] }).questions ?? []).length})`,
    libre.status === 200 && ((libre.json as { questions?: unknown[] }).questions ?? []).length > 0, libre.json);

  console.log(fallos === 0 ? '\n=== TODO EN PIE ===\n' : `\n=== ${fallos} FALLOS ===\n`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('\nLa prueba no ha podido completarse:', e instanceof Error ? e.message : e);
  console.error('¿Está arrancado el servidor?  npm run dev\n');
  process.exit(1);
});
