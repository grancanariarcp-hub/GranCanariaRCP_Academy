'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { PageNav } from '@/components/PageNav';
import { useSession } from '@/hooks/useSession';
import { adminNav } from '@/lib/nav';
import { api, ApiError, downloadFile, uploadFile } from '@/lib/api';

/**
 * Certificados de reconocimiento: plantillas.
 *
 * Misma lógica que los certificados de aprobación (quién certifica, firmantes e
 * imagen de fondo), pero con dos motivos: ganar un desafío o acumular horas de
 * práctica. El cuerpo admite marcadores que se sustituyen al emitirlo.
 */

interface Plantilla {
  id: string;
  kind: 'desafio' | 'horas';
  title: string;
  body_template: string;
  frase: string | null;
  certifica: string | null;
  firmante1_nombre: string | null;
  firmante1_cargo: string | null;
  firmante2_nombre: string | null;
  firmante2_cargo: string | null;
  bg_key: string | null;
  max_position: number | null;
  threshold_hours: string | null;
  challenge_title: string | null;
  is_active: boolean;
  emitidos: number;
}

const VACIA = {
  kind: 'horas' as 'desafio' | 'horas',
  title: '',
  bodyTemplate: 'Ha dedicado {horas} horas a entrenar sus conocimientos en reanimación cardiopulmonar y primeros auxilios.',
  frase: 'Gracias por contribuir a que nuestra sociedad cada día esté más cardioprotegida.',
  certifica: 'Gran Canaria RCP',
  firmante1Nombre: '',
  firmante1Cargo: '',
  firmante2Nombre: '',
  firmante2Cargo: '',
  maxPosition: '',
  thresholdHours: '',
};

export default function ReconocimientosPage() {
  const user = useSession(['super_admin'], '/login/admin');
  const [items, setItems] = useState<Plantilla[]>([]);
  const [form, setForm] = useState({ ...VACIA });
  const [editando, setEditando] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await api<{ templates: Plantilla[] }>('/api/admin/recognition-templates', { auth: true });
      setItems(r.templates);
    } catch { /* la pantalla ya avisa al guardar */ }
  }, []);

  useEffect(() => { if (user) cargar(); }, [user, cargar]);

  function editar(p: Plantilla) {
    setEditando(p.id);
    setForm({
      kind: p.kind,
      title: p.title,
      bodyTemplate: p.body_template,
      frase: p.frase ?? '',
      certifica: p.certifica ?? '',
      firmante1Nombre: p.firmante1_nombre ?? '',
      firmante1Cargo: p.firmante1_cargo ?? '',
      firmante2Nombre: p.firmante2_nombre ?? '',
      firmante2Cargo: p.firmante2_cargo ?? '',
      maxPosition: p.max_position ? String(p.max_position) : '',
      thresholdHours: p.threshold_hours ? String(Number(p.threshold_hours)) : '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const cuerpo = {
      kind: form.kind,
      title: form.title,
      bodyTemplate: form.bodyTemplate,
      frase: form.frase || null,
      certifica: form.certifica || null,
      firmante1Nombre: form.firmante1Nombre || null,
      firmante1Cargo: form.firmante1Cargo || null,
      firmante2Nombre: form.firmante2Nombre || null,
      firmante2Cargo: form.firmante2Cargo || null,
      maxPosition: form.kind === 'desafio' && form.maxPosition ? Number(form.maxPosition) : null,
      thresholdHours: form.kind === 'horas' && form.thresholdHours ? Number(form.thresholdHours) : null,
    };
    try {
      if (editando) {
        await api(`/api/admin/recognition-templates/${editando}`, { method: 'PATCH', auth: true, body: JSON.stringify(cuerpo) });
      } else {
        await api('/api/admin/recognition-templates', { method: 'POST', auth: true, body: JSON.stringify(cuerpo) });
      }
      setMsg({ ok: true, text: '✅ Plantilla guardada' });
      setForm({ ...VACIA });
      setEditando(null);
      cargar();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : 'No se pudo guardar' });
    }
  }

  async function borrar(p: Plantilla) {
    if (!confirm(`¿Eliminar «${p.title}»? Los reconocimientos ya emitidos se conservan.`)) return;
    await api(`/api/admin/recognition-templates/${p.id}`, { method: 'DELETE', auth: true });
    cargar();
  }

  async function subirFondo(id: string, file: File | undefined) {
    if (!file) return;
    try {
      await uploadFile(`/api/admin/recognition-templates/${id}/background`, file);
      setMsg({ ok: true, text: '✅ Fondo actualizado' });
      cargar();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : 'No se pudo subir el fondo' });
    }
  }

  if (!user) return <div style={{ padding: 40 }}>Cargando…</div>;

  return (
    <AppShell user={user} title="Reconocimientos" nav={adminNav(user.role, '/admin/reconocimientos')}>
      <PageNav backHref="/admin" backLabel="Volver al panel" />

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">{editando ? 'Editar plantilla' : 'Nueva plantilla'}</div>
            {editando && (
              <button className="btn btn-outline btn-small" onClick={() => { setEditando(null); setForm({ ...VACIA }); }}>
                Cancelar edición
              </button>
            )}
          </div>

          {msg && <div className={`alert ${msg.ok ? 'alert-success' : 'alert-error'}`}>{msg.text}</div>}

          <form onSubmit={guardar}>
            <div className="form-group">
              <label className="form-label" htmlFor="r-kind">Motivo</label>
              <select id="r-kind" className="form-select" value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value as 'desafio' | 'horas' })}>
                <option value="horas">Horas de práctica acumuladas</option>
                <option value="desafio">Participación en un desafío</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="r-title">Título interno</label>
              <input id="r-title" className="form-input" required value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder={form.kind === 'horas' ? 'Reconocimiento por 25 horas' : 'Reconocimiento por desafío'} />
            </div>

            {form.kind === 'horas' ? (
              <div className="form-group">
                <label className="form-label" htmlFor="r-horas">Se emite al alcanzar (horas)</label>
                <input id="r-horas" className="form-input" inputMode="decimal" required value={form.thresholdHours}
                  onChange={(e) => setForm({ ...form, thresholdHours: e.target.value })} placeholder="25" />
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label" htmlFor="r-puesto">Hasta qué puesto lo recibe</label>
                <input id="r-puesto" className="form-input" inputMode="numeric" value={form.maxPosition}
                  onChange={(e) => setForm({ ...form, maxPosition: e.target.value })} placeholder="3" />
                <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  Déjalo vacío para que lo reciba todo el que complete el desafío: es lo que más se comparte en redes.
                </p>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="r-cuerpo">Texto del certificado</label>
              <textarea id="r-cuerpo" className="form-input" style={{ height: 80, padding: 10 }} required
                value={form.bodyTemplate} onChange={(e) => setForm({ ...form, bodyTemplate: e.target.value })} />
              <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                Marcadores disponibles: <code>{'{nombre}'}</code> <code>{'{desafio}'}</code> <code>{'{puesto}'}</code>{' '}
                <code>{'{horas}'}</code> <code>{'{fecha}'}</code>
              </p>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="r-frase">Frase de cierre</label>
              <textarea id="r-frase" className="form-input" style={{ height: 60, padding: 10 }}
                value={form.frase} onChange={(e) => setForm({ ...form, frase: e.target.value })} />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="r-certifica">Quién reconoce</label>
              <input id="r-certifica" className="form-input" value={form.certifica}
                onChange={(e) => setForm({ ...form, certifica: e.target.value })} />
            </div>

            <div className="grid grid-2" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="form-label" htmlFor="r-f1n">Firmante 1</label>
                <input id="r-f1n" className="form-input" value={form.firmante1Nombre}
                  onChange={(e) => setForm({ ...form, firmante1Nombre: e.target.value })} placeholder="Nombre" />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="r-f1c">Cargo</label>
                <input id="r-f1c" className="form-input" value={form.firmante1Cargo}
                  onChange={(e) => setForm({ ...form, firmante1Cargo: e.target.value })} placeholder="Cargo" />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="r-f2n">Firmante 2</label>
                <input id="r-f2n" className="form-input" value={form.firmante2Nombre}
                  onChange={(e) => setForm({ ...form, firmante2Nombre: e.target.value })} placeholder="Nombre" />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="r-f2c">Cargo</label>
                <input id="r-f2c" className="form-input" value={form.firmante2Cargo}
                  onChange={(e) => setForm({ ...form, firmante2Cargo: e.target.value })} placeholder="Cargo" />
              </div>
            </div>

            <button className="btn btn-primary btn-full">{editando ? 'Guardar cambios' : 'Crear plantilla'}</button>
          </form>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Plantillas</div>
            <div className="card-subtitle">{items.length} configuradas</div>
          </div>

          {items.length === 0 ? (
            <p className="muted">Aún no hay plantillas.</p>
          ) : (
            <div className="table-responsive">
              <table className="table-plain">
                <thead>
                  <tr><th>Plantilla</th><th>Se emite</th><th>Emitidos</th><th></th></tr>
                </thead>
                <tbody>
                  {items.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.title}</strong>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {p.kind === 'horas' ? 'Horas de práctica' : 'Desafío'}
                          {p.bg_key && ' · con fondo'}
                          {!p.is_active && ' · inactiva'}
                        </div>
                      </td>
                      <td style={{ fontSize: 13 }}>
                        {p.kind === 'horas'
                          ? `Al llegar a ${Number(p.threshold_hours)} h`
                          : p.max_position ? `Hasta el puesto ${p.max_position}` : 'A todo participante'}
                      </td>
                      <td>{p.emitidos}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button className="link-action"
                          onClick={() => downloadFile(`/api/admin/recognition-templates/${p.id}/preview.pdf`, 'reconocimiento-ejemplo.pdf')}>
                          Ver
                        </button>{' · '}
                        <button className="link-action" onClick={() => editar(p)}>Editar</button>{' · '}
                        <label className="link-action" style={{ cursor: 'pointer' }}>
                          Fondo
                          <input type="file" accept="image/*" style={{ display: 'none' }}
                            onChange={(e) => { subirFondo(p.id, e.target.files?.[0]); e.target.value = ''; }} />
                        </label>{' · '}
                        <button className="link-action danger" onClick={() => borrar(p)}>Borrar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
