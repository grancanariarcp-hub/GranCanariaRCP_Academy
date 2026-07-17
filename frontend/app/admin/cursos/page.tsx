'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/hooks/useSession';
import { AppShell } from '@/components/AppShell';
import { api, ApiError } from '@/lib/api';

interface Course {
  id: string;
  title: string;
  tema: string | null;
  subtema: string | null;
  status: string;
  modality: string;
  modules: string;
  enrollment_open: boolean;
}
interface Tax {
  id: string;
  label: string;
}

export default function CursosPage() {
  const user = useSession(['super_admin', 'profesor'], '/login/admin');

  const [courses, setCourses] = useState<Course[]>([]);
  const [temas, setTemas] = useState<Tax[]>([]);
  const [subtemas, setSubtemas] = useState<Tax[]>([]);
  const [publicos, setPublicos] = useState<Tax[]>([]);

  const [title, setTitle] = useState('');
  const [tema, setTema] = useState('');
  const [subtema, setSubtema] = useState('');
  const [durationHours, setDurationHours] = useState('');
  const [modality, setModality] = useState('online');
  const [publicoObjetivo, setPublicoObjetivo] = useState<string[]>([]);
  const [objetivoGeneral, setObjetivoGeneral] = useState('');
  const [objetivosEspecificos, setObjetivosEspecificos] = useState('');

  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const [c, t] = await Promise.all([
        api<{ courses: Course[] }>('/api/courses', { auth: true }),
        api<{ temas: Tax[]; subtemas: Tax[]; publicos: Tax[] }>('/api/taxonomies', { auth: true }),
      ]);
      setCourses(c.courses);
      setTemas(t.temas);
      setSubtemas(t.subtemas);
      setPublicos(t.publicos);
    } catch {
      /* ignore */
    }
  }
  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function togglePublico(label: string) {
    setPublicoObjetivo((prev) => (prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label]));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setSaving(true);
    try {
      await api('/api/courses', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({
          title,
          tema: tema || undefined,
          subtema: subtema || undefined,
          durationHours: durationHours ? Number(durationHours) : undefined,
          modality,
          objetivoGeneral: objetivoGeneral || undefined,
          objetivosEspecificos: objetivosEspecificos || undefined,
          publicoObjetivo,
        }),
      });
      setMsg({ ok: true, text: 'Curso creado (en borrador). Ya puedes añadirle módulos ✅' });
      setTitle('');
      setDurationHours('');
      setObjetivoGeneral('');
      setObjetivosEspecificos('');
      setPublicoObjetivo([]);
      load();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Error al crear el curso' });
    } finally {
      setSaving(false);
    }
  }

  if (!user) return <div style={{ padding: 40 }}>Cargando…</div>;

  const nav =
    user.role === 'super_admin'
      ? [
          { label: 'Resumen', href: '/admin' },
          { label: 'Cursos', href: '/admin/cursos', active: true },
          { label: 'Preguntas', href: '/admin/preguntas' },
          { label: 'Documentos', href: '/admin/documentos' },
          { label: 'Profesores', href: '/admin/profesores' },
        ]
      : [{ label: 'Mis cursos', href: '/admin/cursos', active: true }];

  return (
    <AppShell user={user} title="Cursos" nav={nav}>
      <div className="grid grid-2">
        {/* Crear curso */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Crear nuevo curso</div>
            <div className="card-subtitle">Se crea en borrador con Bienvenida + Módulo 1</div>
          </div>

          {msg && <div className={`alert ${msg.ok ? 'alert-success' : 'alert-error'}`}>{msg.text}</div>}

          <form onSubmit={onSubmit}>
            <div className="form-group">
              <label className="form-label">Nombre del curso</label>
              <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>

            <div className="grid grid-2" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Tema</label>
                <select className="form-select" value={tema} onChange={(e) => setTema(e.target.value)}>
                  <option value="">—</option>
                  {temas.map((t) => <option key={t.id} value={t.label}>{t.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Subtema</label>
                <select className="form-select" value={subtema} onChange={(e) => setSubtema(e.target.value)}>
                  <option value="">—</option>
                  {subtemas.map((t) => <option key={t.id} value={t.label}>{t.label}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-2" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Duración (horas)</label>
                <input className="form-input" type="number" min="0" step="0.5" value={durationHours} onChange={(e) => setDurationHours(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Modalidad</label>
                <select className="form-select" value={modality} onChange={(e) => setModality(e.target.value)}>
                  <option value="online">Online</option>
                  <option value="mixto">Mixto</option>
                  <option value="presencial">Presencial</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Público objetivo</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {publicos.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => togglePublico(p.label)}
                    className={`tab ${publicoObjetivo.includes(p.label) ? 'active' : ''}`}
                    style={{ flex: 'unset', padding: '8px 12px' }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Objetivo general</label>
              <textarea className="form-input" style={{ height: 60, padding: 10 }} value={objetivoGeneral} onChange={(e) => setObjetivoGeneral(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Objetivos específicos</label>
              <textarea className="form-input" style={{ height: 60, padding: 10 }} value={objetivosEspecificos} onChange={(e) => setObjetivosEspecificos(e.target.value)} />
            </div>

            <button className="btn btn-primary btn-full" disabled={saving}>
              {saving ? 'Creando…' : 'Crear curso'}
            </button>
          </form>
        </div>

        {/* Listado */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Mis cursos</div>
            <div className="card-subtitle">{courses.length} cursos</div>
          </div>
          <div className="table-responsive">
            <table>
              <thead>
                <tr><th>Curso</th><th>Tema</th><th>Módulos</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {courses.map((c) => (
                  <tr key={c.id}>
                    <td>{c.title}</td>
                    <td style={{ fontSize: 12 }}>{[c.tema, c.subtema].filter(Boolean).join(' · ') || '—'}</td>
                    <td>{c.modules}</td>
                    <td>
                      <span className={`badge ${c.status === 'publicado' ? 'badge-success' : 'badge-warning'}`}>
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {courses.length === 0 && (
                  <tr><td colSpan={4} className="muted">Aún no hay cursos</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
