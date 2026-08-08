'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from '@/hooks/useSession';
import { AppShell } from '@/components/AppShell';
import { CourseForum } from '@/components/CourseForum';
import { ExamWizard } from '@/components/ExamWizard';
import { api, ApiError, uploadFile, downloadFile } from '@/lib/api';
import { PageNav } from '@/components/PageNav';
import { AttendancePanel } from '@/components/AttendancePanel';
import { adminNav } from '@/lib/nav';
import { CoursePricing } from '@/components/CoursePricing';
import { ActaPanel } from '@/components/ActaPanel';
import { PerfilDocenteAviso } from '@/components/PerfilDocenteAviso';
import { CourseSubscription } from '@/components/CourseSubscription';
import { ServiciosExtrasCurso } from '@/components/ServiciosExtrasCurso';
import { CoursePayments } from '@/components/CoursePayments';
import { SubgruposPanel } from '@/components/SubgruposPanel';
import { Ayuda } from '@/components/ayuda/Ayuda';

interface Activity {
  id: string;
  type: 'documento' | 'video' | 'enlace' | 'test' | 'examen' | 'texto' | 'imagen';
  title: string;
  url: string | null;
  body: string | null;
  image_url?: string;
  is_mandatory: boolean;
  document_title: string | null;
  exam_id: string | null;
  evaluable?: boolean;
  metodo_eval?: 'examen' | 'finalizacion' | 'manual' | null;
}
interface Module {
  id: string;
  title: string;
  is_mandatory: boolean;
  activities: Activity[];
}
interface Staff {
  id: string;
  name: string;
  email: string;
  role: 'director' | 'instructor';
  parte?: 'teorica' | 'practica' | 'ambas';
  status?: 'pendiente' | 'aceptado' | 'rechazado';
}

const PARTE_LABEL: Record<string, string> = { teorica: 'Teoría', practica: 'Práctica', ambas: 'Teoría y práctica' };
interface Course {
  id: string;
  created_by: string | null;
  title: string;
  tema: string | null;
  subtema: string | null;
  modality: string;
  status: string;
  enrollment_open: boolean;
  resumen: string | null;
  acreditacion: string | null;
  cfc: string | null;
  whatsapp_url: string | null;
  telegram_url: string | null;
  thumbnail_url?: string;
  certifica: string | null;
  firmante1_nombre: string | null;
  firmante1_cargo: string | null;
  firmante2_nombre: string | null;
  firmante2_cargo: string | null;
  cert_bg_url?: string;
  cfc_image_url?: string;
  cert_programa_reverso?: boolean;
  price_cents: number;
  early_bird_until: string | null;
  late_surcharge_pct: number | string | null;
  billing_type: string;
  es_ope: boolean;
  cfc_en_tramite: boolean;
  cfc_solicitado_at: string | null;
  tipo_clinico: string | null;
  empresa: string | null;
  lugar: string | null;
  price_mensual_cents: number | null;
  price_trimestral_cents: number | null;
  price_semestral_cents: number | null;
  price_anual_cents: number | null;
}

const TYPE_ICON: Record<string, string> = { documento: '📄', video: '🎬', enlace: '🔗', test: '📝', examen: '🎓', texto: '📝', imagen: '🖼️' };

// Fila del panel de Resumen: verde si está listo, ámbar si falta.
function ResumenItem({ ok, label, hint }: { ok: boolean; label: string; hint: string }) {
  return (
    <div className="resumen-item">
      <span className={`ficha-dot ficha-dot-${ok ? 'ok' : 'falta'}`} />
      <span className="resumen-label">{label}</span>
      <span className="muted" style={{ fontSize: 12.5 }}>{hint}</span>
    </div>
  );
}

export default function CourseDetailPage() {
  const params = useParams();
  const courseId = params.id as string;
  const user = useSession(['super_admin', 'profesor', 'auditor'], '/login/admin');
  const router = useRouter();

  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [gallery, setGallery] = useState<Array<{ id: string; url: string }>>([]);
  const [students, setStudents] = useState<Array<{ id: string; name: string; email: string | null; status: string; intentos: string; aprobado: boolean; completadas: string; active_seconds: string }>>([]);
  const [totalActivities, setTotalActivities] = useState(0);
  const [cdash, setCdash] = useState<null | {
    matriculas: { mes_anterior: string; mes_actual: string; anio: string; total: string };
    avance: { total_actividades: string; media_pct: string | null };
    tiempo: { horas: string; media_horas: string | null };
    examenes: { aprobados: string; presentados: string };
    pendientes: Array<{ activity_id: string; title: string; type: string; pendientes: string }>;
  }>(null);
  const [surv, setSurv] = useState<null | {
    respuestas: number; matriculados: number; participacionPct: number;
    mediaGlobal: number | null; recomiendanPct: number | null;
    porItem: Array<{ kind: string; label: string; media: number; n: number }>;
    comentarios: Array<{ comments: string; submitted_at: string }>;
  }>(null);
  const [cfc, setCfc] = useState<null | {
    checks: Array<{ clave: string; titulo: string; estado: 'ok' | 'aviso' | 'falta'; detalle: string; comoMejorar?: string }>;
    resumen: { ok: number; avisos: number; faltan: number; total: number };
    aviso: string;
  }>(null);
  const [dur, setDur] = useState<null | {
    parametros: { minPerPage: number; wordsPerMin: number; minPerQuestion: number };
    porTipo: Record<string, number>; totalMinutos: number; totalHoras: number;
    horasDeclaradas: number | null;
    sinEstimar: Array<{ id: string; title: string; type: string }>;
  }>(null);
  const [tempPw, setTempPw] = useState<{ name: string; pw: string } | null>(null);
  const [docs, setDocs] = useState<Array<{ id: string; title: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [pestana, setPestana] = useState('resumen'); // pestaña visible de la ficha
  const [auditoria, setAuditoria] = useState<{
    cambios: Array<{ campo: string; valor_antes: string | null; valor_nuevo: string | null; changed_at: string; quien: string | null }>;
    eventos: Array<{ action: string; actor_type: string; created_at: string; quien: string | null }>;
  } | null>(null);

  const [newModule, setNewModule] = useState('');

  // Ficha del curso (editable)
  const [fResumen, setFResumen] = useState('');
  const [fAcred, setFAcred] = useState('');
  const [fCfc, setFCfc] = useState('');
  const [fWhats, setFWhats] = useState('');
  const [fTelegram, setFTelegram] = useState('');
  // Clasificación temática (tema → subtema), con sugerencias de lo ya usado.
  const [fTema, setFTema] = useState('');
  const [fSubtema, setFSubtema] = useState('');
  const [taxonomia, setTaxonomia] = useState<{ temas: string[]; porTema: Record<string, string[]> }>({ temas: [], porTema: {} });
  // Datos de la parte práctica (para PÚLSAR)
  const [fTipoClinico, setFTipoClinico] = useState('');
  const [fEmpresa, setFEmpresa] = useState('');
  const [fLugar, setFLugar] = useState('');
  const [fichaMsg, setFichaMsg] = useState<string | null>(null);

  // Certificado
  const [certifica, setCertifica] = useState('');
  const [f1n, setF1n] = useState('');
  const [f1c, setF1c] = useState('');
  const [f2n, setF2n] = useState('');
  const [f2c, setF2c] = useState('');
  const [certPrograma, setCertPrograma] = useState(false);
  const [certMsg, setCertMsg] = useState<string | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null); // moduleId
  const [subiendoDoc, setSubiendoDoc] = useState(false);
  const [actType, setActType] = useState<'documento' | 'video' | 'enlace' | 'texto' | 'imagen' | 'test' | 'examen'>('documento');
  const [actTitle, setActTitle] = useState('');
  const [actUrl, setActUrl] = useState('');
  const [actDoc, setActDoc] = useState('');
  const [actBody, setActBody] = useState('');
  const [actDuracion, setActDuracion] = useState(''); // minutos, sobre todo para vídeos (CFC)
  const [actEvaluable, setActEvaluable] = useState(false);
  const [actMetodo, setActMetodo] = useState<'finalizacion' | 'manual'>('finalizacion');
  // Panel de calificación manual de una actividad
  const [gradeAct, setGradeAct] = useState<{ id: string; title: string } | null>(null);
  const [gradeAlumnos, setGradeAlumnos] = useState<Array<{ student_id: string; nombre: string; nota: number | string | null; apto: boolean | null }>>([]);
  const [examAttempts, setExamAttempts] = useState('1');
  const [examPass, setExamPass] = useState('60');
  const [examTime, setExamTime] = useState('');

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'director' | 'instructor'>('instructor');
  const [inviteParte, setInviteParte] = useState<'teorica' | 'practica' | 'ambas'>('ambas');
  const [inviteMsg, setInviteMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    try {
      const [c, d] = await Promise.all([
        api<{ course: Course; modules: Module[]; staff: Staff[]; gallery: Array<{ id: string; url: string }> }>(`/api/courses/${courseId}`, { auth: true }),
        api<{ documents: Array<{ id: string; title: string }> }>('/api/documents', { auth: true }).catch(() => ({ documents: [] })),
      ]);
      setCourse(c.course);
      setGallery(c.gallery ?? []);
      api<{ students: typeof students; totalActivities: number }>(`/api/courses/${courseId}/students`, { auth: true })
        .then((r) => { setStudents(r.students); setTotalActivities(r.totalActivities); }).catch(() => {});
      api<typeof dur>(`/api/courses/${courseId}/duration`, { auth: true })
        .then((r) => setDur(r)).catch(() => {});
      api<typeof cdash>(`/api/courses/${courseId}/dashboard`, { auth: true })
        .then((r) => setCdash(r)).catch(() => {});
      api<typeof cfc>(`/api/courses/${courseId}/cfc`, { auth: true })
        .then((r) => setCfc(r)).catch(() => {});
      api<typeof surv>(`/api/courses/${courseId}/survey/results`, { auth: true })
        .then((r) => setSurv(r)).catch(() => {});
      setFResumen(c.course.resumen ?? '');
      setFAcred(c.course.acreditacion ?? '');
      setFCfc(c.course.cfc ?? '');
      setFWhats(c.course.whatsapp_url ?? '');
      setFTelegram(c.course.telegram_url ?? '');
      setFTema(c.course.tema ?? '');
      setFSubtema(c.course.subtema ?? '');
      api<typeof taxonomia>('/api/courses/taxonomia', { auth: true })
        .then((r) => setTaxonomia(r)).catch(() => {});
      setFTipoClinico(c.course.tipo_clinico ?? '');
      setFEmpresa(c.course.empresa ?? '');
      setFLugar(c.course.lugar ?? '');
      setCertifica(c.course.certifica ?? '');
      setF1n(c.course.firmante1_nombre ?? '');
      setF1c(c.course.firmante1_cargo ?? '');
      setF2n(c.course.firmante2_nombre ?? '');
      setF2c(c.course.firmante2_cargo ?? '');
      setCertPrograma(!!c.course.cert_programa_reverso);
      setModules(c.modules);
      setStaff(c.staff);
      setDocs(d.documents);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error cargando el curso');
    }
  }
  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Las guías paso a paso resaltan elementos que ahora viven en pestañas: cuando
  // una guía necesita una, la pide por evento y aquí la abrimos.
  useEffect(() => {
    const abrirPestana = (e: Event) => {
      const tab = (e as CustomEvent<string>).detail;
      if (typeof tab === 'string') setPestana(tab);
    };
    window.addEventListener('curso-pestana', abrirPestana);
    return () => window.removeEventListener('curso-pestana', abrirPestana);
  }, []);

  // Auditoría del curso: se carga la primera vez que se abre esa pestaña.
  useEffect(() => {
    if (pestana === 'auditoria' && course && !auditoria) {
      api<typeof auditoria>(`/api/courses/${courseId}/auditoria`, { auth: true })
        .then(setAuditoria).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pestana, course]);

  async function patchCourse(body: object) {
    try {
      await api(`/api/courses/${courseId}`, { method: 'PATCH', auth: true, body: JSON.stringify(body) });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
    }
  }

  // Cambiar entre Curso y OPE (solo super admin, solo sin matrículas). Descarta
  // el contenido incompatible del nuevo tipo, así que se avisa antes.
  async function cambiarTipo() {
    if (!course) return;
    const aOpe = !course.es_ope;
    const msg = aOpe
      ? '¿Convertir este curso en una OPE? Se borrarán sus módulos y actividades (una OPE no los tiene). No se puede deshacer una vez haya alumnos.'
      : '¿Convertir esta OPE en un curso? Se desvincularán sus bancos de preguntas y volverá a empezar con un módulo de Bienvenida.';
    if (!confirm(msg)) return;
    try {
      await api(`/api/courses/${courseId}/tipo`, { method: 'PATCH', auth: true, body: JSON.stringify({ tipo: aOpe ? 'ope' : 'curso' }) });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cambiar el tipo');
    }
  }

  // Registrar la solicitud de CFC: congela los campos acreditables. Un clic
  // deliberado, con aviso de lo que implica.
  async function solicitarCfc() {
    if (!confirm(
      'Al registrar la solicitud de CFC se BLOQUEAN los campos acreditables: título, horas lectivas, temario, '
      + 'profesorado y fechas. El resto (materiales, avisos, descripciones, imagen) sigue editable y cada cambio '
      + 'queda registrado.\n\nTramitar los CFC por tu cuenta es gratuito. ¿Registrar la solicitud ahora?')) return;
    try {
      await api(`/api/courses/${courseId}/solicitar-cfc`, { method: 'POST', auth: true });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar la solicitud');
    }
  }

  // Ocultar retira el curso de la portada sin destruir nada: los matriculados
  // conservan su acceso y el histórico queda intacto.
  async function ocultar() {
    if (!confirm('¿Ocultar el curso? Dejará de verse en la portada y nadie podrá matricularse. '
      + 'Los alumnos que ya están dentro conservan su acceso, y podrás recuperarlo cuando quieras.')) return;
    await patchCourse({ status: 'archivado', enrollmentOpen: false });
  }

  // Borrar solo es posible mientras el curso no haya dejado rastro en nadie; si
  // lo tiene, el servidor lo impide y explica por qué.
  async function borrar() {
    if (!confirm('¿Borrar el curso definitivamente? Esta acción no se puede deshacer. '
      + 'Si ya tiene alumnos, cobros, certificados o actas, el borrado se rechazará: en ese caso usa «Ocultar».')) return;
    try {
      await api(`/api/courses/${courseId}`, { method: 'DELETE', auth: true });
      router.push('/admin/cursos');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se ha podido borrar el curso');
    }
  }

  async function saveFicha() {
    setFichaMsg(null);
    try {
      await api(`/api/courses/${courseId}`, { method: 'PATCH', auth: true, body: JSON.stringify({ resumen: fResumen, acreditacion: fAcred, cfc: fCfc, whatsappUrl: fWhats, telegramUrl: fTelegram, tema: fTema.trim(), subtema: fSubtema.trim(), tipoClinico: fTipoClinico, empresa: fEmpresa, lugar: fLugar }) });
      setFichaMsg('Ficha guardada ✅');
      load();
    } catch (err) {
      setFichaMsg(err instanceof ApiError ? err.message : 'Error al guardar');
    }
  }
  async function uploadThumb(file: File | undefined) {
    if (!file) return;
    try {
      await uploadFile(`/api/courses/${courseId}/thumbnail`, file);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al subir la miniatura');
    }
  }
  async function setActivityMinutes(activityId: string, minutes: number | null) {
    try {
      await api(`/api/courses/${courseId}/activities/${activityId}/duration`, {
        method: 'PATCH', auth: true, body: JSON.stringify({ minutes }),
      });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
    }
  }

  async function applyDeclaredHours() {
    if (!dur) return;
    await patchCourse({ durationHours: dur.totalHoras });
  }

  async function resetStudentPassword(s: { id: string; name: string }) {
    if (!confirm(`¿Restablecer la contraseña de ${s.name}? Se generará una clave temporal de un solo uso.`)) return;
    try {
      const r = await api<{ tempPassword: string }>(`/api/courses/${courseId}/students/${s.id}/reset-password`, { method: 'POST', auth: true });
      setTempPw({ name: s.name, pw: r.tempPassword });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al restablecer');
    }
  }

  async function uploadGallery(file: File | undefined) {
    if (!file) return;
    try {
      await uploadFile(`/api/courses/${courseId}/gallery`, file);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al subir la imagen');
    }
  }
  async function deleteGalleryImage(imageId: string) {
    try {
      await api(`/api/courses/${courseId}/gallery/${imageId}`, { method: 'DELETE', auth: true });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al borrar');
    }
  }

  async function saveCert() {
    setCertMsg(null);
    try {
      await api(`/api/courses/${courseId}`, {
        method: 'PATCH', auth: true,
        body: JSON.stringify({ certifica, firmante1Nombre: f1n, firmante1Cargo: f1c, firmante2Nombre: f2n, firmante2Cargo: f2c, certProgramaReverso: certPrograma }),
      });
      setCertMsg('Datos del certificado guardados ✅');
      load();
    } catch (err) {
      setCertMsg(err instanceof ApiError ? err.message : 'Error');
    }
  }
  async function uploadCertImg(kind: 'background' | 'cfc-image', file: File | undefined) {
    if (!file) return;
    try {
      await uploadFile(`/api/courses/${courseId}/certificate/${kind}`, file);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al subir la imagen');
    }
  }
  async function previewCert() {
    try {
      await downloadFile(`/api/courses/${courseId}/certificate/preview`, 'previsualizacion-certificado.pdf');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al previsualizar');
    }
  }

  async function addModule() {
    if (!newModule.trim()) return;
    await api(`/api/courses/${courseId}/modules`, { method: 'POST', auth: true, body: JSON.stringify({ title: newModule }) });
    setNewModule('');
    load();
  }
  async function deleteModule(moduleId: string) {
    await api(`/api/courses/${courseId}/modules/${moduleId}`, { method: 'DELETE', auth: true });
    load();
  }
  async function addActivity(moduleId: string) {
    try {
      if (actType === 'test' || actType === 'examen') {
        // Exams are created through their own endpoint (and get their own activity).
        await api(`/api/courses/${courseId}/modules/${moduleId}/exams`, {
          method: 'POST',
          auth: true,
          body: JSON.stringify({
            title: actTitle,
            kind: actType,
            attemptsAllowed: Number(examAttempts) || 1,
            passPct: Number(examPass) || 60,
            timeLimitMin: examTime ? Number(examTime) : null,
          }),
        });
      } else {
        await api(`/api/courses/${courseId}/modules/${moduleId}/activities`, {
          method: 'POST',
          auth: true,
          body: JSON.stringify({
            type: actType,
            title: actTitle,
            url: actType === 'video' || actType === 'enlace' ? actUrl : undefined,
            documentId: actType === 'documento' ? actDoc : undefined,
            body: actType === 'texto' ? actBody : undefined,
            durationMin: actType === 'video' && actDuracion ? Number(actDuracion) : undefined,
            evaluable: actEvaluable,
            metodoEval: actEvaluable ? actMetodo : undefined,
          }),
        });
      }
      setAddingTo(null); setActTitle(''); setActUrl(''); setActDoc(''); setActBody(''); setActDuracion(''); setActEvaluable(false); setActMetodo('finalizacion');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al añadir actividad');
    }
  }

  async function uploadImageActivity(moduleId: string, file: File | undefined) {
    if (!file) return;
    try {
      await uploadFile(`/api/courses/${courseId}/modules/${moduleId}/activities/image`, file, { title: actTitle || file.name });
      setAddingTo(null); setActTitle('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al subir la imagen');
    }
  }
  /**
   * Sube un PDF a la biblioteca de documentos y lo deja ya elegido para la
   * actividad. Antes solo se podía escoger de un desplegable, así que había que
   * ir a otra pantalla a subirlo primero.
   */
  async function uploadDocAndSelect(file: File | undefined) {
    if (!file) return;
    if (file.type !== 'application/pdf') { setError('El documento debe ser un PDF'); return; }
    setSubiendoDoc(true);
    setError(null);
    try {
      const r = await uploadFile<{ document: { id: string; title: string } }>(
        '/api/documents', file, { title: actTitle.trim() || file.name.replace(/\.pdf$/i, ''), kind: 'otro' },
      );
      setDocs((prev) => [{ id: r.document.id, title: r.document.title }, ...prev]);
      setActDoc(r.document.id);
      if (!actTitle.trim()) setActTitle(r.document.title);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al subir el documento');
    } finally {
      setSubiendoDoc(false);
    }
  }
  async function deleteActivity(activityId: string) {
    await api(`/api/courses/${courseId}/activities/${activityId}`, { method: 'DELETE', auth: true });
    load();
  }
  // Marcar/cambiar si una actividad es evaluable y con qué método.
  async function cambiarEval(a: Activity, valor: string) {
    const evaluable = valor !== 'no';
    try {
      await api(`/api/courses/${courseId}/activities/${a.id}/eval`, {
        method: 'PATCH', auth: true,
        body: JSON.stringify({ evaluable, metodoEval: evaluable ? valor : undefined }),
      });
      load();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Error'); }
  }
  async function abrirCalificar(a: Activity) {
    try {
      const r = await api<{ alumnos: typeof gradeAlumnos }>(`/api/courses/${courseId}/activities/${a.id}/grades`, { auth: true });
      setGradeAlumnos(r.alumnos); setGradeAct({ id: a.id, title: a.title });
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Error'); }
  }
  async function guardarNota(studentId: string, nota: string, apto: boolean | null) {
    if (!gradeAct) return;
    try {
      await api(`/api/courses/${courseId}/activities/${gradeAct.id}/grades/${studentId}`, {
        method: 'PUT', auth: true,
        body: JSON.stringify({ nota: nota === '' ? null : Number(nota), apto }),
      });
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Error'); }
  }
  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setInviteMsg(null);
    try {
      await api(`/api/courses/${courseId}/staff`, { method: 'POST', auth: true, body: JSON.stringify({ email: inviteEmail, role: inviteRole, parte: inviteParte }) });
      setInviteMsg({ ok: true, text: 'Profesor añadido ✅' });
      setInviteEmail('');
      load();
    } catch (err) {
      setInviteMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Error' });
    }
  }

  if (!user) return <div style={{ padding: 40 }}>Cargando…</div>;

  const nav = adminNav(user.role, '/admin/cursos');
  // Sobre un curso ajeno el super admin modera pero no edita: el contenido
  // docente es de quien lo firma.
  const esMio = !course?.created_by || course.created_by === user.id;

  // Pestañas de la ficha. Una OPE no tiene temario, profesorado ni cierre, así
  // que muestra menos pestañas. El punto verde/rojo señala de un vistazo qué
  // secciones están completas sin tener que entrar en cada una.
  const esOpe = !!course?.es_ope;
  const TABS: Array<[string, string]> = esOpe
    ? [['resumen', 'Resumen'], ['ficha', 'Ficha'], ['precio', 'Precio'], ['alumnos', 'Alumnos']]
    : [['resumen', 'Resumen'], ['ficha', 'Ficha'], ['contenido', 'Contenido'], ['precio', 'Precio'], ['alumnos', 'Alumnos'], ['profesorado', 'Profesorado'], ['cierre', 'Cierre'], ['foro', 'Foro']];
  // La comisión CFC (auditor) y el super admin ven una pestaña de auditoría del
  // curso: historial de cambios acreditables + eventos, sin datos de alumnos.
  if (user.role === 'super_admin' || user.role === 'auditor') TABS.push(['auditoria', 'Auditoría']);
  const tabEstado: Record<string, 'ok' | 'falta' | undefined> = {
    contenido: modules.length ? 'ok' : 'falta',
    profesorado: staff.some((s) => s.status === 'pendiente') ? 'falta' : (staff.length ? 'ok' : 'falta'),
    cierre: cfc ? (cfc.resumen.faltan === 0 ? 'ok' : 'falta') : undefined,
  };

  return (
    <AppShell user={user} title={course?.title ?? 'Curso'} nav={nav}>
      <PageNav backHref="/admin/cursos" backLabel="Volver a cursos" />
      {user.role === 'profesor' && <PerfilDocenteAviso compacto />}
      {error && <div className="alert alert-error">{error}</div>}
      {!course ? (
        <div className="muted">Cargando…</div>
      ) : (
        <>
          {/* Cabecera / estado */}
          <div className="card" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <div>
                <div className="card-title">{course.title}</div>
                <div className="card-subtitle">
                  {[course.tema, course.subtema, course.modality].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }} data-tour="estado">
                <span className={`badge ${course.status === 'publicado' ? 'badge-success' : 'badge-warning'}`}>{course.status}</span>
                {course.status === 'publicado' && (
                  <span className="badge badge-primary">{course.enrollment_open ? 'matrícula abierta' : 'próximamente'}</span>
                )}
                {esMio && (course.status === 'publicado' ? (
                  <button className="btn btn-outline btn-small" onClick={() => patchCourse({ status: 'borrador' })}>Pasar a borrador</button>
                ) : (
                  <button className="btn btn-primary btn-small" onClick={() => patchCourse({ status: 'publicado' })}>Publicar</button>
                ))}
                <button className="btn btn-outline btn-small" onClick={() => patchCourse({ enrollmentOpen: !course.enrollment_open })}>
                  {course.enrollment_open ? 'Cerrar matrícula' : 'Abrir matrícula'}
                </button>
                {course.status === 'archivado' ? (
                  <button className="btn btn-outline btn-small" onClick={() => patchCourse({ status: 'publicado' })}>
                    Recuperar
                  </button>
                ) : (
                  <button className="btn btn-outline btn-small" onClick={ocultar}>Ocultar</button>
                )}
                {esMio && <button className="btn btn-danger btn-small" onClick={borrar}>Borrar</button>}
              </div>
            </div>
            {!esMio && (
              <div className="info-box" style={{ marginTop: 12, fontSize: 13 }}>
                Este curso lo creó otra persona. Puedes <strong>ocultarlo</strong> o cerrar su matrícula si hace
                falta retirarlo, pero no editar su contenido: quien lo firma responde de lo que enseña.
              </div>
            )}
            {course.status === 'publicado' && (
              <div className="info-box" style={{ marginTop: 12, fontSize: 13 }}>
                {course.enrollment_open
                  ? <>Visible en la portada, con <strong>matrícula abierta</strong> (los alumnos pueden inscribirse). </>
                  : <>Visible en la portada como <strong>«Próximamente»</strong> (genera interés; aún no se pueden inscribir). Pulsa <strong>«Abrir matrícula»</strong> cuando quieras permitir inscripciones. </>}
                <Link href={`/curso/${course.id}`} target="_blank">Ver ficha pública ↗</Link>
              </div>
            )}
          </div>

          {/* Barra de pestañas: divide la ficha por bloques para no abrumar */}
          <div className="ficha-tabs">
            {TABS.map(([id, label]) => (
              <button
                key={id}
                className={`ficha-tab ${pestana === id ? 'ficha-tab-on' : ''}`}
                onClick={() => setPestana(id)}
              >
                {label}
                {tabEstado[id] && <span className={`ficha-dot ficha-dot-${tabEstado[id]}`} />}
              </button>
            ))}
          </div>

          {/* Resumen: estado del curso de un vistazo */}
          {pestana === 'resumen' && (
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-header">
                <div className="card-title">Situación del curso</div>
                <div className="card-subtitle">De un vistazo: qué está listo y qué falta</div>
              </div>
              <div className="resumen-checklist">
                <ResumenItem ok={course.status === 'publicado'}
                  label={course.status === 'publicado' ? 'Publicado' : 'En borrador'}
                  hint={course.status === 'publicado' ? (course.enrollment_open ? 'matrícula abierta' : 'próximamente') : 'no visible en la portada'} />
                <ResumenItem ok={!!course.resumen}
                  label="Ficha" hint={course.resumen ? 'resumen y datos rellenados' : 'falta el resumen'} />
                {!esOpe && (
                  <ResumenItem ok={modules.length > 0}
                    label="Contenido" hint={`${modules.length} módulo(s)`} />
                )}
                <ResumenItem ok={course.price_cents > 0 || !!course.price_mensual_cents}
                  label="Precio" hint={course.price_cents > 0 ? `${(course.price_cents / 100).toFixed(2)} €` : (course.price_mensual_cents ? 'suscripción' : 'gratuito / sin definir')} />
                <ResumenItem ok={students.length > 0}
                  label="Alumnos" hint={`${students.length} matriculado(s)`} />
                {!esOpe && (
                  <ResumenItem ok={staff.length > 0 && !staff.some((s) => s.status === 'pendiente')}
                    label="Profesorado" hint={staff.some((s) => s.status === 'pendiente') ? 'hay invitaciones sin aceptar' : `${staff.length} profesor(es)`} />
                )}
                {!esOpe && (
                  <ResumenItem ok={!!course.cfc_solicitado_at}
                    label="CFC" hint={course.cfc_solicitado_at ? 'solicitud registrada' : 'sin solicitar'} />
                )}
              </div>
            </div>
          )}

          {/* Panel del curso */}
          {pestana === 'resumen' && cdash && (
            <div className="card animate-in" style={{ marginBottom: 24 }}>
              <div className="card-header">
                <div className="card-title">Panel del curso</div>
                <div className="card-subtitle">Cómo va tu curso ahora mismo</div>
              </div>
              <div className="grid grid-4" style={{ marginBottom: 14 }}>
                <div className="info-box">Matriculados: <strong style={{ fontSize: 20 }}>{cdash.matriculas.total}</strong>
                  <div className="muted" style={{ fontSize: 11 }}>este mes: {cdash.matriculas.mes_actual} · mes anterior: {cdash.matriculas.mes_anterior}</div>
                </div>
                <div className="info-box">Avance medio: <strong style={{ fontSize: 20 }}>{cdash.avance.media_pct ?? 0}%</strong>
                  <div className="muted" style={{ fontSize: 11 }}>{cdash.avance.total_actividades} actividades</div>
                </div>
                <div className="info-box">Estudio: <strong style={{ fontSize: 20 }}>{cdash.tiempo.horas} h</strong>
                  <div className="muted" style={{ fontSize: 11 }}>media: {cdash.tiempo.media_horas ?? 0} h/alumno</div>
                </div>
                <div className="info-box">Aprobados: <strong style={{ fontSize: 20 }}>{cdash.examenes.aprobados}</strong>
                  <div className="muted" style={{ fontSize: 11 }}>de {cdash.examenes.presentados} presentados</div>
                </div>
              </div>
              {cdash.pendientes.filter((p) => Number(p.pendientes) > 0).length > 0 && (
                <>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Alumnos pendientes por actividad</div>
                  <div className="table-responsive">
                    <table>
                      <thead><tr><th>Actividad</th><th>Tipo</th><th>Pendientes</th></tr></thead>
                      <tbody>
                        {cdash.pendientes.filter((p) => Number(p.pendientes) > 0).slice(0, 8).map((p) => (
                          <tr key={p.activity_id}>
                            <td>{p.title}</td>
                            <td className="muted" style={{ fontSize: 12 }}>{p.type}</td>
                            <td><span className="badge badge-warning">{p.pendientes}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Acta: un curso OPE no titula, así que no la necesita */}
        {pestana === 'cierre' && !course.es_ope && <div data-tour="acta"><ActaPanel courseId={courseId} /></div>}

        {/* Tipo (Curso u OPE): se elige al crear. El super admin puede cambiarlo
            solo mientras no haya ninguna matrícula; después queda fijo. */}
        {pestana === 'ficha' && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14.5 }}>
              Tipo: <strong>{course.es_ope ? 'OPE (generador de exámenes)' : 'Curso'}</strong>
            </span>
            {user.role === 'super_admin' && students.length === 0 && (
              <button className="btn btn-outline btn-small" onClick={cambiarTipo}>
                Cambiar a {course.es_ope ? 'Curso' : 'OPE'}
              </button>
            )}
          </div>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 6, marginBottom: 0 }}>
            {course.es_ope
              ? 'Una OPE es un generador de exámenes: no tiene profesorado, temario, acta ni certificado.'
              : 'Un curso imparte docencia, con temario, exámenes y certificado.'}
            {user.role === 'super_admin' && students.length > 0 && ' El tipo ya no puede cambiarse: hay alumnos matriculados.'}
          </p>
        </div>
        )}

        {/* Acreditación CFC: solicitud y bloqueo de campos acreditables */}
        {pestana === 'ficha' && !course.es_ope && (
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header">
              <div className="card-title">Acreditación CFC</div>
            </div>
            {course.cfc_solicitado_at ? (
              <div className="alert alert-success" style={{ fontSize: 13.5 }}>
                <strong>✓ Solicitud de CFC registrada</strong> el {new Date(course.cfc_solicitado_at).toLocaleDateString('es-ES')}.
                <div style={{ marginTop: 4 }}>
                  Los campos acreditables (título, horas, temario, profesorado y fechas) están <strong>bloqueados</strong>.
                  El resto —materiales, avisos, descripciones, imagen— sigue editable, y cada cambio queda registrado.
                </div>
              </div>
            ) : (
              <>
                <p className="muted" style={{ fontSize: 13.5, marginTop: 0 }}>
                  Tramitar los CFC por tu cuenta es <strong>gratuito</strong>. Al registrar la solicitud aquí, se
                  fijan los campos acreditables para garantizar que lo impartido coincide con lo acreditado.
                </p>
                <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13.5, cursor: 'pointer', margin: '4px 0 14px' }}>
                  <input type="checkbox" checked={!!course.cfc_en_tramite} style={{ marginTop: 3 }}
                    onChange={(e) => patchCourse({ cfcEnTramite: e.target.checked })} />
                  <span>
                    <strong>En trámite</strong> — deja que la Comisión CFC vea el curso aunque no esté publicado, sin
                    bloquear todavía nada.
                  </span>
                </label>
                <button className="btn btn-primary btn-small" onClick={solicitarCfc}>Registrar solicitud de CFC</button>
              </>
            )}
          </div>
        )}

        {pestana === 'precio' && (
        <>
        {/* Precio de matrícula, con matrícula anticipada */}
        <CoursePricing courseId={courseId} course={course} onSaved={load} />

        {/* Quién ha pagado y cuánto se lleva cobrado */}
        <CoursePayments courseId={courseId} />

        {/* Cobro recurrente por periodos */}
        <CourseSubscription courseId={courseId} course={course} onSaved={load} />

        {/* Servicios extras: heredados de la academia, ajustables por el super admin */}
        <ServiciosExtrasCurso courseId={courseId} canEdit={user.role === 'super_admin'} />
        </>
        )}

        {/* Asistencia presencial: no aplica a un curso OPE */}
        {pestana === 'alumnos' && !course.es_ope && <AttendancePanel courseId={courseId} />}

        {/* Subgrupos + puente con PÚLSAR: solo para cursos con parte práctica */}
        {pestana === 'alumnos' && !course.es_ope && <div data-tour="pulsar"><SubgruposPanel courseId={courseId} /></div>}

        {/* Ficha del curso */}
          {pestana === 'ficha' && (<>
          <div className="card" data-tour="ficha" style={{ marginBottom: 24 }}>
            <div className="card-header">
              <div className="card-title">Ficha del curso <Ayuda tema="profesor-curso-crear" /></div>
              <div className="card-subtitle">Se muestra a los alumnos antes de matricularse</div>
            </div>
            {fichaMsg && <div className={`alert ${fichaMsg.includes('✅') ? 'alert-success' : 'alert-error'}`}>{fichaMsg}</div>}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ width: 140, flexShrink: 0 }}>
                <div style={{ width: 140, height: 90, background: 'var(--gray-200)', borderRadius: 8, overflow: 'hidden', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {course.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={course.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: 26 }}>🖼️</span>
                  )}
                </div>
                <label className="btn btn-outline btn-small btn-full" style={{ cursor: 'pointer' }}>
                  Miniatura
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { uploadThumb(e.target.files?.[0]); e.target.value = ''; }} />
                </label>
              </div>
              <div style={{ flex: 1, minWidth: 240 }}>
                <div className="form-group">
                  <label className="form-label">Resumen</label>
                  <textarea className="form-input" style={{ height: 70, padding: 10 }} value={fResumen} onChange={(e) => setFResumen(e.target.value)} />
                </div>
                {/* Clasificación temática: dos niveles (tema → subtema). Texto
                    libre con sugerencias de lo ya usado en la academia. */}
                <div className="grid grid-2" style={{ gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Tema</label>
                    <input className="form-input" list="lista-temas" placeholder="Ej.: Soporte Vital"
                      value={fTema} onChange={(e) => setFTema(e.target.value)} />
                    <datalist id="lista-temas">
                      {taxonomia.temas.map((t) => <option key={t} value={t} />)}
                    </datalist>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Subtema</label>
                    <input className="form-input" list="lista-subtemas" placeholder="Ej.: Adulto"
                      value={fSubtema} onChange={(e) => setFSubtema(e.target.value)} />
                    <datalist id="lista-subtemas">
                      {(taxonomia.porTema[fTema] ?? Object.values(taxonomia.porTema).flat()).map((s) => <option key={s} value={s} />)}
                    </datalist>
                  </div>
                </div>
                <div className="grid grid-2" style={{ gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Acreditación</label>
                    <input className="form-input" value={fAcred} onChange={(e) => setFAcred(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">CFC</label>
                    <input className="form-input" value={fCfc} onChange={(e) => setFCfc(e.target.value)} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Grupo de WhatsApp del curso (enlace de invitación)</label>
                  <input className="form-input" placeholder="https://chat.whatsapp.com/..." value={fWhats} onChange={(e) => setFWhats(e.target.value)} />
                  <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>Se ofrecerá a los alumnos al entrar. Unirse es voluntario.</p>
                </div>
                <div className="form-group">
                  <label className="form-label">Grupo de Telegram del curso (enlace de invitación)</label>
                  <input className="form-input" placeholder="https://t.me/..." value={fTelegram} onChange={(e) => setFTelegram(e.target.value)} />
                  <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    Igual que el de WhatsApp: al alumno se le ofrece unirse para recibir novedades y actividades. Unirse es voluntario.
                  </p>
                </div>
                {!course.es_ope && (
                  <>
                    <div style={{ borderTop: '1px solid var(--gray-200)', margin: '4px 0 12px' }} />
                    <p className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>
                      Datos de la parte práctica (se envían a PÚLSAR al exportar el curso):
                    </p>
                    <div className="grid grid-2" style={{ gap: 12 }}>
                      <div className="form-group">
                        <label className="form-label">Tipo clínico</label>
                        <select className="form-input" value={fTipoClinico} onChange={(e) => setFTipoClinico(e.target.value)}>
                          <option value="">— sin especificar —</option>
                          <option value="SVA">SVA · Soporte Vital Avanzado</option>
                          <option value="SVB">SVB · Soporte Vital Básico</option>
                          <option value="SVI">SVI · Soporte Vital Intermedio</option>
                          <option value="otro">Otro</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Empresa / entidad</label>
                        <input className="form-input" value={fEmpresa} onChange={(e) => setFEmpresa(e.target.value)} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Lugar de la práctica</label>
                      <input className="form-input" placeholder="Aula de simulación, hospital…" value={fLugar} onChange={(e) => setFLugar(e.target.value)} />
                    </div>
                  </>
                )}
                <button className="btn btn-primary btn-small" onClick={saveFicha}>Guardar ficha</button>
              </div>
            </div>
          </div>

          {/* Galería / carrusel */}
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header">
              <div className="card-title">Galería (carrusel de la ficha)</div>
              <div className="card-subtitle">Varias imágenes que rotan en la página pública del curso</div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              {gallery.map((g) => (
                <div key={g.id} style={{ position: 'relative', width: 120, height: 80 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={g.url} alt="" style={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--gray-200)' }} />
                  <button
                    onClick={() => deleteGalleryImage(g.id)}
                    title="Borrar"
                    style={{ position: 'absolute', top: -8, right: -8, background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 999, width: 22, height: 22, cursor: 'pointer', lineHeight: 1 }}
                  >×</button>
                </div>
              ))}
              <label className="btn btn-outline btn-small" style={{ cursor: 'pointer', height: 80, width: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                + Añadir imagen
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { uploadGallery(e.target.files?.[0]); e.target.value = ''; }} />
              </label>
            </div>
            {gallery.length === 0 && <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>Sin imágenes. Si no añades ninguna, la ficha usa la miniatura.</p>}
          </div>
          </>)}

          {/* Duración lectiva (CFC) */}
          {pestana === 'contenido' && dur && (
            <div className="card animate-in" style={{ marginBottom: 24 }}>
              <div className="card-header">
                <div className="card-title">Duración lectiva estimada</div>
                <div className="card-subtitle">Es el dato que se justifica ante la comisión de formación continuada (CFC)</div>
              </div>
              <div className="grid grid-4" style={{ marginBottom: 12 }}>
                <div className="info-box">📄 Documentos: <strong>{dur.porTipo.documentos} min</strong></div>
                <div className="info-box">📝 Textos: <strong>{dur.porTipo.textos} min</strong></div>
                <div className="info-box">🎬 Vídeos: <strong>{dur.porTipo.videos} min</strong></div>
                <div className="info-box">🎓 Evaluación: <strong>{dur.porTipo.evaluacion} min</strong></div>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--primary-dark)' }}>{dur.totalHoras} h</div>
                <span className="muted">({dur.totalMinutos} minutos en total)</span>
                {dur.horasDeclaradas != null && (
                  <span className={`badge ${Math.abs(dur.horasDeclaradas - dur.totalHoras) < 0.6 ? 'badge-success' : 'badge-warning'}`}>
                    declaradas en la ficha: {dur.horasDeclaradas} h
                  </span>
                )}
                <button className="btn btn-outline btn-small" onClick={applyDeclaredHours}>Usar {dur.totalHoras} h como duración del curso</button>
              </div>
              {dur.sinEstimar.length > 0 && (
                <div className="alert alert-warning">
                  <strong>Faltan datos para {dur.sinEstimar.length} actividad(es)</strong>, así que la duración real es mayor:
                  <ul style={{ margin: '6px 0 0 18px' }}>
                    {dur.sinEstimar.map((a) => (
                      <li key={a.id} style={{ fontSize: 13 }}>
                        {a.title} ({a.type}) —{' '}
                        <button className="link-action" onClick={() => {
                          const m = prompt(`Duración en minutos de «${a.title}»`);
                          if (m && !Number.isNaN(Number(m))) setActivityMinutes(a.id, Number(m));
                        }}>indicar minutos</button>
                        {a.type === 'documento' && <span className="muted"> · o indica sus páginas en Documentos</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="muted" style={{ fontSize: 12 }}>
                Estimación: {dur.parametros.minPerPage} min por página de documento · {dur.parametros.wordsPerMin} palabras/min de lectura ·
                {' '}{dur.parametros.minPerQuestion} min por pregunta en tests sin límite de tiempo. Los exámenes con tiempo configurado usan ese tiempo.
              </p>
            </div>
          )}

          {/* Resultados de la encuesta: un curso OPE no evalúa docencia */}
          {pestana === 'cierre' && surv && !course.es_ope && (
            <div className="card animate-in" style={{ marginBottom: 24 }}>
              <div className="card-header">
                <div className="card-title">Encuesta de satisfacción</div>
                <div className="card-subtitle">{surv.respuestas} de {surv.matriculados} alumnos ({surv.participacionPct}%)</div>
              </div>
              {surv.respuestas === 0 ? (
                <div className="info-box">Aún no hay respuestas. La encuesta aparece a tus alumnos dentro del curso.</div>
              ) : (
                <>
                  <div className="grid grid-2" style={{ marginBottom: 14 }}>
                    <div className="info-box">Valoración global: <strong style={{ fontSize: 20 }}>{surv.mediaGlobal ?? '—'}</strong> / 5</div>
                    <div className="info-box">Lo recomendarían: <strong style={{ fontSize: 20 }}>{surv.recomiendanPct ?? '—'}%</strong></div>
                  </div>
                  {(['modulo', 'profesor', 'general'] as const).map((k) => {
                    const del = surv.porItem.filter((i) => i.kind === k);
                    if (del.length === 0) return null;
                    const titulo = k === 'modulo' ? 'Por módulo' : k === 'profesor' ? 'Por profesor' : 'Aspectos generales';
                    return (
                      <div key={k} style={{ marginBottom: 12 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{titulo}</div>
                        {del.map((i) => (
                          <div key={i.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '5px 0', borderBottom: '1px solid var(--gray-200)' }}>
                            <span style={{ fontSize: 13 }}>{i.label}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ width: 90, height: 8, background: 'var(--gray-200)', borderRadius: 999, overflow: 'hidden', display: 'inline-block' }}>
                                <span style={{ display: 'block', width: `${(i.media / 5) * 100}%`, height: '100%', background: i.media >= 4 ? 'var(--success)' : i.media >= 3 ? 'var(--secondary-dark)' : 'var(--danger)' }} />
                              </span>
                              <strong style={{ fontSize: 13, minWidth: 32 }}>{i.media}</strong>
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                  {surv.comentarios.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Sugerencias de los alumnos</div>
                      {surv.comentarios.slice(0, 6).map((c, i) => (
                        <div key={i} className="info-box" style={{ fontSize: 13, marginBottom: 6 }}>{c.comments}</div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Asistente CFC: un curso OPE no se acredita */}
          {pestana === 'cierre' && cfc && !course.es_ope && (
            <div className="card animate-in" style={{ marginBottom: 24 }}>
              <div className="card-header">
                <div className="card-title">Asistente de acreditación (CFC)</div>
                <div className="card-subtitle">
                  {cfc.resumen.ok}/{cfc.resumen.total} cumplidos · {cfc.resumen.avisos} a revisar · {cfc.resumen.faltan} pendientes
                </div>
              </div>
              <div style={{ height: 10, background: 'var(--gray-200)', borderRadius: 999, overflow: 'hidden', marginBottom: 14 }}>
                <div style={{ width: `${Math.round((cfc.resumen.ok / cfc.resumen.total) * 100)}%`, height: '100%', background: 'linear-gradient(90deg,#2c5282,#22c55e)', transition: 'width .5s ease' }} />
              </div>
              {cfc.checks.map((ch) => (
                <div key={ch.clave} style={{ display: 'flex', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--gray-200)' }}>
                  <span style={{ fontSize: 16, lineHeight: 1.2 }}>{ch.estado === 'ok' ? '✅' : ch.estado === 'aviso' ? '⚠️' : '❌'}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{ch.titulo}</div>
                    <div className="muted" style={{ fontSize: 13 }}>{ch.detalle}</div>
                    {ch.estado !== 'ok' && ch.comoMejorar && (
                      <div style={{ fontSize: 12.5, marginTop: 3, color: 'var(--secondary-dark)' }}>→ {ch.comoMejorar}</div>
                    )}
                  </div>
                </div>
              ))}
              <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>{cfc.aviso}</p>
            </div>
          )}

          {/* Certificado: un curso OPE no titula, así que no lo emite */}
          {pestana === 'cierre' && !course.es_ope && (
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header">
              <div className="card-title">Certificado <Ayuda tema="profesor-certificados" /></div>
              <div className="card-subtitle">Se genera al aprobar el curso. Si no subes fondo, será blanco.</div>
            </div>
            {certMsg && <div className={`alert ${certMsg.includes('✅') ? 'alert-success' : 'alert-error'}`}>{certMsg}</div>}
            <div className="form-group">
              <label className="form-label">Quién certifica</label>
              <input className="form-input" placeholder="Ej.: GranCanaria RCP Academy" value={certifica} onChange={(e) => setCertifica(e.target.value)} />
            </div>
            <div className="grid grid-2" style={{ gap: 12 }}>
              <div>
                <div className="form-group"><label className="form-label">Firmante 1 · nombre</label><input className="form-input" value={f1n} onChange={(e) => setF1n(e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Firmante 1 · cargo</label><input className="form-input" value={f1c} onChange={(e) => setF1c(e.target.value)} /></div>
              </div>
              <div>
                <div className="form-group"><label className="form-label">Firmante 2 · nombre</label><input className="form-input" value={f2n} onChange={(e) => setF2n(e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Firmante 2 · cargo</label><input className="form-input" value={f2c} onChange={(e) => setF2c(e.target.value)} /></div>
              </div>
            </div>
            <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>Si un firmante queda vacío, no aparece en el certificado. Los CFC y las fechas se toman de la ficha del curso.</p>

            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13.5, cursor: 'pointer', marginBottom: 12 }}>
              <input type="checkbox" checked={certPrograma} style={{ marginTop: 3 }} onChange={(e) => setCertPrograma(e.target.checked)} />
              <span><strong>Imprimir el programa del curso en el reverso</strong> — el certificado llevará una segunda página con el temario completo (módulos y actividades).</span>
            </label>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
              <label className="btn btn-outline btn-small" style={{ cursor: 'pointer' }}>
                {course.cert_bg_url ? 'Cambiar fondo' : 'Subir fondo'}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { uploadCertImg('background', e.target.files?.[0]); e.target.value = ''; }} />
              </label>
              <label className="btn btn-outline btn-small" style={{ cursor: 'pointer' }}>
                {course.cfc_image_url ? 'Cambiar imagen CFC' : 'Subir imagen CFC'}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { uploadCertImg('cfc-image', e.target.files?.[0]); e.target.value = ''; }} />
              </label>
              {course.cert_bg_url && <span className="badge badge-success">Fondo ✓</span>}
              {course.cfc_image_url && <span className="badge badge-success">CFC ✓</span>}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-small" onClick={saveCert}>Guardar datos</button>
              <button className="btn btn-outline btn-small" onClick={previewCert}>👁️ Ver previsualización</button>
            </div>
          </div>
          )}

          {/* Módulos + actividades */}
          {pestana === 'contenido' && (
            <div className="card" data-tour="contenido" style={{ marginBottom: 24 }}>
              <div className="card-header">
                <div className="card-title">Contenido del curso <Ayuda tema="profesor-curso-modulos" /></div>
                <div className="card-subtitle">{modules.length} módulos</div>
              </div>

              {modules.map((m) => (
                <div key={m.id} style={{ border: '1px solid var(--gray-200)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{m.title}</strong>
                    <div>
                      <button className="btn btn-outline btn-small" onClick={() => setAddingTo(addingTo === m.id ? null : m.id)}>+ Actividad</button>{' '}
                      {m.title !== 'Bienvenida' && (
                        <button className="btn btn-outline btn-small" onClick={() => deleteModule(m.id)} title="Eliminar módulo">🗑</button>
                      )}
                    </div>
                  </div>

                  {/* actividades */}
                  <div style={{ marginTop: 8 }}>
                    {m.activities.map((a) => (
                      <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: 14 }}>
                        <span>
                          {TYPE_ICON[a.type]} {a.title}{a.document_title ? ` — ${a.document_title}` : ''}
                          {a.type === 'imagen' && a.image_url && <img src={a.image_url} alt="" style={{ height: 24, marginLeft: 8, borderRadius: 4, verticalAlign: 'middle' }} />}
                        </span>
                        <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {['documento', 'video', 'enlace', 'texto', 'imagen'].includes(a.type) && (
                            <select className="form-select" style={{ width: 'auto', height: 28, fontSize: 12, padding: '0 6px' }}
                              value={a.evaluable ? (a.metodo_eval ?? 'finalizacion') : 'no'} onChange={(e) => cambiarEval(a, e.target.value)} title="¿Cuenta como calificación?">
                              <option value="no">No evaluable</option>
                              <option value="finalizacion">Eval: finalización</option>
                              <option value="manual">Eval: nota manual</option>
                            </select>
                          )}
                          {a.evaluable && a.metodo_eval === 'manual' && (
                            <button className="btn btn-outline btn-small" onClick={() => abrirCalificar(a)}>Calificar</button>
                          )}
                          {a.exam_id && (
                            <Link className="btn btn-outline btn-small" href={`/admin/cursos/${courseId}/examen/${a.exam_id}`}>Editar</Link>
                          )}
                          <button className="btn btn-outline btn-small" onClick={() => deleteActivity(a.id)}>✕</button>
                        </span>
                      </div>
                    ))}
                    {m.activities.length === 0 && <div className="muted" style={{ fontSize: 13 }}>Sin actividades</div>}
                  </div>

                  {/* form añadir actividad */}
                  {addingTo === m.id && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--gray-300)' }}>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                        {(['documento', 'texto', 'imagen', 'video', 'enlace', 'test', 'examen'] as const).map((t) => (
                          <button key={t} type="button" className={`tab ${actType === t ? 'active' : ''}`} style={{ flex: 'unset', padding: '6px 10px' }} onClick={() => setActType(t)}>
                            {TYPE_ICON[t]} {t}
                          </button>
                        ))}
                      </div>
                      {actType !== 'test' && actType !== 'examen' && (
                        <input className="form-input" placeholder="Título de la actividad" value={actTitle} onChange={(e) => setActTitle(e.target.value)} style={{ marginBottom: 8 }} />
                      )}
                      {actType === 'documento' && (
                        <div style={{ marginBottom: 8 }}>
                          <label className={`btn btn-primary btn-small btn-full ${subiendoDoc ? 'disabled' : ''}`} style={{ cursor: subiendoDoc ? 'wait' : 'pointer' }}>
                            {subiendoDoc ? 'Subiendo…' : '📄 Subir un PDF desde mi equipo'}
                            <input type="file" accept="application/pdf,.pdf" style={{ display: 'none' }} disabled={subiendoDoc}
                              onChange={(e) => { uploadDocAndSelect(e.target.files?.[0]); e.target.value = ''; }} />
                          </label>
                          {docs.length > 0 && (
                            <>
                              <p className="muted" style={{ fontSize: 12, textAlign: 'center', margin: '8px 0 6px' }}>o elige uno ya subido</p>
                              <select className="form-select" value={actDoc} onChange={(e) => setActDoc(e.target.value)}>
                                <option value="">Documentos de la biblioteca…</option>
                                {docs.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
                              </select>
                            </>
                          )}
                          {actDoc && <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>✓ Documento seleccionado</p>}
                        </div>
                      )}
                      {(actType === 'video' || actType === 'enlace') && (
                        <input className="form-input" placeholder="https://…" value={actUrl} onChange={(e) => setActUrl(e.target.value)} style={{ marginBottom: 8 }} />
                      )}
                      {actType === 'video' && (
                        <div style={{ marginBottom: 8 }}>
                          <input className="form-input" type="number" min="0" step="1" placeholder="Duración en minutos"
                            value={actDuracion} onChange={(e) => setActDuracion(e.target.value)} />
                          <p className="muted" style={{ fontSize: 11.5, marginTop: 3 }}>
                            Necesaria para el cómputo de horas CFC. Es la duración del vídeo.
                          </p>
                        </div>
                      )}
                      {actType === 'texto' && (
                        <textarea className="form-input" style={{ height: 90, padding: 10, marginBottom: 8 }} placeholder="Escribe el contenido…" value={actBody} onChange={(e) => setActBody(e.target.value)} />
                      )}
                      {actType === 'imagen' && (
                        <label className="btn btn-primary btn-small btn-full" style={{ cursor: 'pointer', marginBottom: 8 }}>
                          🖼️ Elegir imagen y subir
                          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { uploadImageActivity(m.id, e.target.files?.[0]); e.target.value = ''; }} />
                        </label>
                      )}
                      {(actType === 'test' || actType === 'examen') && (
                        <ExamWizard courseId={courseId} moduleId={m.id} onCreated={() => { setAddingTo(null); load(); }} />
                      )}
                      {actType !== 'imagen' && actType !== 'test' && actType !== 'examen' && (
                        <div style={{ background: 'var(--gray-50, #f7fafc)', borderRadius: 8, padding: 10, marginBottom: 8 }}>
                          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, cursor: 'pointer' }}>
                            <input type="checkbox" checked={actEvaluable} onChange={(e) => setActEvaluable(e.target.checked)} />
                            <span>Actividad <strong>evaluable</strong> (aparece en las calificaciones del alumno)</span>
                          </label>
                          {actEvaluable && (
                            <select className="form-select" style={{ marginTop: 8 }} value={actMetodo} onChange={(e) => setActMetodo(e.target.value as typeof actMetodo)}>
                              <option value="finalizacion">Por finalización — apto al completarla</option>
                              <option value="manual">Nota manual — la pones tú por alumno</option>
                            </select>
                          )}
                        </div>
                      )}
                      {actType !== 'imagen' && actType !== 'test' && actType !== 'examen' && (
                        <button className="btn btn-primary btn-small btn-full" onClick={() => addActivity(m.id)} disabled={!actTitle.trim() || (actType === 'documento' && !actDoc)}>
                          Añadir
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}

              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input className="form-input" placeholder="Nombre del nuevo módulo" value={newModule} onChange={(e) => setNewModule(e.target.value)} />
                <button className="btn btn-primary btn-small" onClick={addModule}>+ Módulo</button>
              </div>
            </div>
          )}

          {/* Alumnos matriculados */}
          {pestana === 'alumnos' && (
            <div className="card animate-in" style={{ marginBottom: 24 }}>
              <div className="card-header">
                <div className="card-title">Alumnos matriculados <Ayuda tema="profesor-alumnos" /></div>
                <div className="card-subtitle">{students.length}</div>
              </div>
              {tempPw && (
                <div className="alert alert-success">
                  Clave temporal para <strong>{tempPw.name}</strong>: <code style={{ fontSize: 16, fontWeight: 700 }}>{tempPw.pw}</code>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Comunícasela; al entrar deberá definir su propia contraseña. No volverá a mostrarse.</div>
                </div>
              )}
              {students.length === 0 ? (
                <div className="muted">Aún no hay alumnos matriculados.</div>
              ) : (
                <div className="table-responsive">
                  <table>
                    <thead><tr><th>Alumno</th><th>Avance</th><th>Estudio</th><th>Examen</th><th></th></tr></thead>
                    <tbody>
                      {students.map((s) => (
                        <tr key={s.id}>
                          <td><strong>{s.name}</strong>{s.email && <div className="muted" style={{ fontSize: 12 }}>{s.email}</div>}</td>
                          <td style={{ minWidth: 140 }}>
                            {(() => {
                              const pct = totalActivities > 0 ? Math.round((Number(s.completadas) / totalActivities) * 100) : 0;
                              return (
                                <>
                                  <div style={{ height: 8, background: 'var(--gray-200)', borderRadius: 999, overflow: 'hidden' }}>
                                    <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? 'var(--success)' : 'linear-gradient(90deg,#2c5282,#22c55e)' }} />
                                  </div>
                                  <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>{s.completadas}/{totalActivities} · {pct}%</div>
                                </>
                              );
                            })()}
                          </td>
                          <td>{Number(s.active_seconds) > 0 ? `${Math.round((Number(s.active_seconds) / 3600) * 10) / 10} h` : <span className="muted">—</span>}</td>
                          <td>{s.aprobado ? <span className="badge badge-success">aprobado</span> : <span className="muted" style={{ fontSize: 12 }}>{Number(s.intentos) > 0 ? `${s.intentos} intento(s)` : 'sin intentos'}</span>}</td>
                          <td>
                            <div className="row-actions">
                              {s.email && <button className="link-action" onClick={() => resetStudentPassword(s)} title="Genera una clave temporal de un solo uso">Restablecer</button>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Staff */}
          {pestana === 'profesorado' && !course.es_ope && (
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-header">
                <div className="card-title">Profesores del curso</div>
                <div className="card-subtitle">Directores e instructores</div>
              </div>
              <div className="table-responsive" style={{ marginBottom: 16 }}>
                <table>
                  <thead><tr><th>Nombre</th><th>Rol</th><th>Participa en</th></tr></thead>
                  <tbody>
                    {staff.map((s) => (
                      <tr key={s.id}>
                        <td>
                          {s.name}
                          {s.status === 'pendiente' && <span className="badge badge-warning" style={{ marginLeft: 8, fontSize: 10.5 }}>pendiente de aceptar</span>}
                          {s.status === 'rechazado' && <span className="badge badge-danger" style={{ marginLeft: 8, fontSize: 10.5 }}>rechazó</span>}
                          <div className="muted" style={{ fontSize: 12 }}>{s.email}</div>
                        </td>
                        <td><span className={`badge ${s.role === 'director' ? 'badge-primary' : 'badge-success'}`}>{s.role}</span></td>
                        <td className="muted" style={{ fontSize: 12.5 }}>{PARTE_LABEL[s.parte ?? 'ambas']}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="info-box" style={{ marginBottom: 12, fontSize: 13 }}>
                Invita a un profesor <strong>ya registrado, aprobado y con su perfil docente completo</strong> por su email.
                Si le falta el perfil, tendrá que completarlo antes de poder añadirlo.
              </div>
              {inviteMsg && <div className={`alert ${inviteMsg.ok ? 'alert-success' : 'alert-error'}`}>{inviteMsg.text}</div>}
              <form onSubmit={invite}>
                <div className="form-group">
                  <label className="form-label">Email del profesor</label>
                  <input className="form-input" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required />
                </div>
                <div className="grid grid-2" style={{ gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Rol</label>
                    <select className="form-select" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as 'director' | 'instructor')}>
                      <option value="instructor">Instructor</option>
                      <option value="director">Director</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Participa en</label>
                    <select className="form-select" value={inviteParte} onChange={(e) => setInviteParte(e.target.value as 'teorica' | 'practica' | 'ambas')}>
                      <option value="ambas">Teoría y práctica</option>
                      <option value="teorica">Solo teoría</option>
                      <option value="practica">Solo práctica (PÚLSAR)</option>
                    </select>
                  </div>
                </div>
                <button className="btn btn-primary btn-full">Añadir al curso</button>
              </form>
            </div>
            )}
        </>
      )}

      {course && pestana === 'foro' && (
        <div className="card" style={{ marginTop: 24 }}>
          <CourseForum courseId={courseId} />
        </div>
      )}

      {/* Auditoría del curso (super admin / comisión CFC): historial sin datos de alumnos */}
      {course && pestana === 'auditoria' && (
        <>
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header">
              <div className="card-title">Cambios en campos acreditables</div>
              <div className="card-subtitle">Qué se cambió tras registrar la solicitud de CFC (la prueba de que lo impartido coincide con lo acreditado)</div>
            </div>
            {!auditoria ? <div className="muted">Cargando…</div> : auditoria.cambios.length === 0 ? (
              <div className="info-box" style={{ fontSize: 13 }}>Sin cambios registrados. (El registro empieza al pulsar «Registrar solicitud de CFC».)</div>
            ) : (
              <div className="table-responsive">
                <table>
                  <thead><tr><th>Fecha</th><th>Campo</th><th>Antes</th><th>Después</th><th>Quién</th></tr></thead>
                  <tbody>
                    {auditoria.cambios.map((c, i) => (
                      <tr key={i}>
                        <td className="muted" style={{ fontSize: 12 }}>{new Date(c.changed_at).toLocaleString('es-ES')}</td>
                        <td><strong>{c.campo}</strong></td>
                        <td className="muted" style={{ fontSize: 12 }}>{c.valor_antes ?? '—'}</td>
                        <td style={{ fontSize: 12 }}>{c.valor_nuevo ?? '—'}</td>
                        <td className="muted" style={{ fontSize: 12 }}>{c.quien ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">Eventos del curso</div>
              <div className="card-subtitle">Publicación, ficha, temario, profesorado, solicitud CFC… (no incluye datos de alumnos)</div>
            </div>
            {!auditoria ? <div className="muted">Cargando…</div> : auditoria.eventos.length === 0 ? (
              <div className="muted">Sin eventos registrados.</div>
            ) : (
              <div className="table-responsive">
                <table>
                  <thead><tr><th>Fecha</th><th>Acción</th><th>Quién</th></tr></thead>
                  <tbody>
                    {auditoria.eventos.map((e, i) => (
                      <tr key={i}>
                        <td className="muted" style={{ fontSize: 12 }}>{new Date(e.created_at).toLocaleString('es-ES')}</td>
                        <td><span className="badge badge-primary">{e.action}</span></td>
                        <td className="muted" style={{ fontSize: 12 }}>{e.quien ?? e.actor_type}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Panel de calificación manual de una actividad */}
      {gradeAct && (
        <div className="modal-backdrop" onClick={() => setGradeAct(null)} role="presentation">
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Calificar actividad" style={{ maxWidth: 560 }}>
            <div className="card-header">
              <div className="card-title">Calificar · {gradeAct.title}</div>
              <div className="card-subtitle">Pon la nota (0–100) y/o marca apto. Se guarda al salir de cada casilla.</div>
            </div>
            {gradeAlumnos.length === 0 ? (
              <p className="empty-state">No hay alumnos matriculados todavía.</p>
            ) : (
              <div className="table-responsive" style={{ maxHeight: 420, overflowY: 'auto' }}>
                <table>
                  <thead><tr><th>Alumno</th><th style={{ width: 90 }}>Nota</th><th style={{ width: 70 }}>Apto</th></tr></thead>
                  <tbody>
                    {gradeAlumnos.map((al, i) => (
                      <tr key={al.student_id}>
                        <td style={{ fontSize: 13 }}>{al.nombre}</td>
                        <td>
                          <input className="form-input" type="number" min="0" max="100" step="0.5" style={{ height: 32, padding: '0 8px' }}
                            defaultValue={al.nota ?? ''} onBlur={(e) => guardarNota(al.student_id, e.target.value, gradeAlumnos[i].apto ?? null)} />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input type="checkbox" defaultChecked={!!al.apto}
                            onChange={(e) => { gradeAlumnos[i].apto = e.target.checked; guardarNota(al.student_id, String(gradeAlumnos[i].nota ?? ''), e.target.checked); }} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <button className="btn btn-primary btn-small" style={{ marginTop: 12 }} onClick={() => setGradeAct(null)}>Cerrar</button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
