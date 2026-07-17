'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/hooks/useSession';
import { AppShell } from '@/components/AppShell';
import { api, ApiError } from '@/lib/api';

interface Bank {
  id: string;
  name: string;
  kind: string;
  comunidad_autonoma: string | null;
  anio: number | null;
  categoria_profesional: string | null;
  official: boolean;
  questions: string;
}

export default function BancosPage() {
  const user = useSession(['super_admin'], '/login');
  const [banks, setBanks] = useState<Bank[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // create
  const [name, setName] = useState('');
  const [kind, setKind] = useState('ope');
  const [ca, setCa] = useState('');
  const [anio, setAnio] = useState('');
  const [categoria, setCategoria] = useState('');
  const [official, setOfficial] = useState(false);

  // import
  const [selBank, setSelBank] = useState('');
  const [json, setJson] = useState('');
  const [temas, setTemas] = useState<Array<{ tema: string; questions: string }>>([]);
  const [impMsg, setImpMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    try {
      setBanks((await api<{ banks: Bank[] }>('/api/admin/banks', { auth: true })).banks);
    } catch { /* ignore */ }
  }
  useEffect(() => { if (user) load(); /* eslint-disable-next-line */ }, [user]);

  async function loadTemas(id: string) {
    setSelBank(id);
    try {
      setTemas((await api<{ temas: Array<{ tema: string; questions: string }> }>(`/api/public/banks/${id}/temas`)).temas);
    } catch { setTemas([]); }
  }

  async function createBank(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await api('/api/admin/banks', {
        method: 'POST', auth: true,
        body: JSON.stringify({ name, kind, comunidadAutonoma: ca || undefined, anio: anio ? Number(anio) : undefined, categoriaProfesional: categoria || undefined, official }),
      });
      setMsg({ ok: true, text: 'Banco creado ✅' });
      setName(''); setCa(''); setAnio(''); setCategoria(''); setOfficial(false);
      load();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Error' });
    }
  }

  async function importJson() {
    setImpMsg(null);
    if (!selBank) { setImpMsg({ ok: false, text: 'Elige un banco primero' }); return; }
    let parsed: unknown;
    try { parsed = JSON.parse(json); } catch { setImpMsg({ ok: false, text: 'JSON no válido' }); return; }
    if (!Array.isArray(parsed)) { setImpMsg({ ok: false, text: 'Debe ser una lista [ ... ]' }); return; }
    try {
      const r = await api<{ created: number; total: number; errors: Array<{ fila: number }> }>(`/api/admin/banks/${selBank}/import`, { method: 'POST', auth: true, body: JSON.stringify({ questions: parsed }) });
      setImpMsg({ ok: r.errors.length === 0, text: `Creadas ${r.created}/${r.total}.` + (r.errors.length ? ` Errores en filas: ${r.errors.map((e) => e.fila).join(', ')}` : '') });
      setJson('');
      loadTemas(selBank); load();
    } catch (err) {
      setImpMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Error' });
    }
  }

  if (!user) return <div style={{ padding: 40 }}>Cargando…</div>;

  return (
    <AppShell
      user={user}
      title="Bancos de preguntas"
      nav={[
        { label: 'Resumen', href: '/admin' },
        { label: 'Cursos', href: '/admin/cursos' },
        { label: 'Preguntas', href: '/admin/preguntas' },
        { label: 'Bancos', href: '/admin/bancos', active: true },
        { label: 'Desafíos', href: '/admin/desafios' },
      ]}
    >
      <div className="grid grid-2">
        <div className="card">
          <div className="card-header"><div className="card-title">Nuevo banco (OPE / MIR)</div></div>
          {msg && <div className={`alert ${msg.ok ? 'alert-success' : 'alert-error'}`}>{msg.text}</div>}
          <form onSubmit={createBank}>
            <div className="form-group"><label className="form-label">Nombre</label><input className="form-input" value={name} onChange={(e) => setName(e.target.value)} required /></div>
            <div className="grid grid-2" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <select className="form-select" value={kind} onChange={(e) => setKind(e.target.value)}>
                  <option value="ope">OPE</option><option value="mir">MIR</option><option value="rcp">RCP</option><option value="otro">Otro</option>
                </select>
              </div>
              <div className="form-group"><label className="form-label">Año</label><input className="form-input" type="number" value={anio} onChange={(e) => setAnio(e.target.value)} /></div>
            </div>
            <div className="grid grid-2" style={{ gap: 12 }}>
              <div className="form-group"><label className="form-label">Comunidad autónoma</label><input className="form-input" value={ca} onChange={(e) => setCa(e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Categoría profesional</label><input className="form-input" value={categoria} onChange={(e) => setCategoria(e.target.value)} /></div>
            </div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, marginBottom: 12 }}>
              <input type="checkbox" checked={official} onChange={(e) => setOfficial(e.target.checked)} /> Preguntas oficiales (no pool)
            </label>
            <button className="btn btn-primary btn-full">Crear banco</button>
          </form>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">Bancos</div><div className="card-subtitle">{banks.length}</div></div>
          <div className="table-responsive">
            <table>
              <thead><tr><th>Banco</th><th>Preguntas</th><th></th></tr></thead>
              <tbody>
                {banks.map((b) => (
                  <tr key={b.id}>
                    <td>{b.name}<div className="muted" style={{ fontSize: 12 }}>{b.kind.toUpperCase()}{b.comunidad_autonoma ? ` · ${b.comunidad_autonoma}` : ''}{b.anio ? ` · ${b.anio}` : ''}{b.official ? ' · oficial' : ''}</div></td>
                    <td>{b.questions}</td>
                    <td><button className="btn btn-outline btn-small" onClick={() => loadTemas(b.id)}>Importar/ver</button></td>
                  </tr>
                ))}
                {banks.length === 0 && <tr><td colSpan={3} className="muted">Sin bancos</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Importar preguntas al banco seleccionado */}
      {selBank && (
        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-header">
            <div className="card-title">Importar preguntas (JSON) al banco</div>
            <div className="card-subtitle">Cada pregunta: tema, text, options, correcta (A/B/C/D), explicacion</div>
          </div>
          {temas.length > 0 && <p style={{ fontSize: 13, marginBottom: 8 }}><strong>Temas actuales:</strong> {temas.map((t) => `${t.tema} (${t.questions})`).join(' · ')}</p>}
          {impMsg && <div className={`alert ${impMsg.ok ? 'alert-success' : 'alert-error'}`}>{impMsg.text}</div>}
          <textarea className="form-input" style={{ height: 140, padding: 10, fontFamily: 'monospace', fontSize: 12 }} placeholder='[{"tema":"ICC","text":"...","options":["a","b","c"],"correcta":"B","explicacion":"..."}]' value={json} onChange={(e) => setJson(e.target.value)} />
          <button className="btn btn-primary btn-small" style={{ marginTop: 8 }} onClick={importJson} disabled={!json.trim()}>Importar</button>
        </div>
      )}
    </AppShell>
  );
}
