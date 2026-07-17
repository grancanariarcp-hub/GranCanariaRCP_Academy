'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from '@/hooks/useSession';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';
import { getToken } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

interface DocRow {
  id: string;
  title: string;
  kind: 'erc' | 'pnrcp' | 'otro';
  size_bytes: number | null;
  pages: number | null;
  has_file: boolean;
  created_at: string;
}

const KIND_LABEL = { erc: 'ERC 2025', pnrcp: 'PNRCP', otro: 'Otro' } as const;

function humanSize(bytes: number | null): string {
  if (!bytes) return '—';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

export default function DocumentosPage() {
  const user = useSession(['super_admin'], '/login/admin');
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'erc' | 'pnrcp' | 'otro'>('erc');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function loadDocs() {
    try {
      const r = await api<{ documents: DocRow[] }>('/api/admin/documents', { auth: true });
      setDocs(r.documents);
    } catch {
      /* ignore */
    }
  }
  useEffect(() => {
    if (user) loadDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!file) {
      setMsg({ ok: false, text: 'Elige un archivo PDF' });
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', title);
      fd.append('kind', kind);
      const res = await fetch(`${API_URL}/api/admin/documents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      });
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        throw new Error(b?.error ?? `Error ${res.status}`);
      }
      setMsg({ ok: true, text: 'Documento subido correctamente ✅' });
      setTitle('');
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      loadDocs();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Error al subir' });
    } finally {
      setUploading(false);
    }
  }

  async function view(id: string) {
    try {
      const r = await api<{ url: string }>(`/api/admin/documents/${id}/url`, { auth: true });
      window.open(r.url, '_blank');
    } catch {
      alert('No se pudo abrir el documento');
    }
  }

  if (!user) return <div style={{ padding: 40 }}>Cargando…</div>;

  return (
    <AppShell
      user={user}
      title="Documentos"
      nav={[
        { label: 'Resumen', href: '/admin' },
        { label: 'Preguntas', href: '/admin/preguntas' },
        { label: 'Documentos', href: '/admin/documentos', active: true },
      ]}
    >
      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Subir guía / manual (PDF)</div>
            <div className="card-subtitle">ERC 2025, PNRCP… — se guardan en tu almacén R2, no en la base de datos</div>
          </div>
          {msg && <div className={`alert ${msg.ok ? 'alert-success' : 'alert-error'}`}>{msg.text}</div>}
          <form onSubmit={onUpload}>
            <div className="form-group">
              <label className="form-label">Título</label>
              <input className="form-input" placeholder="Guía ERC 2025 - SVB" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Tipo</label>
              <select className="form-select" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
                <option value="erc">ERC 2025</option>
                <option value="pnrcp">Plan Nacional RCP (PNRCP)</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Archivo PDF</label>
              <input ref={fileRef} className="form-input" style={{ paddingTop: 8 }} type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
            </div>
            <button className="btn btn-primary btn-full" disabled={uploading}>
              {uploading ? 'Subiendo…' : 'Subir documento'}
            </button>
          </form>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Documentos subidos</div>
            <div className="card-subtitle">{docs.length} documentos</div>
          </div>
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Tipo</th>
                  <th>Tamaño</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id}>
                    <td style={{ fontSize: 13 }}>{d.title}</td>
                    <td>
                      <span className="badge badge-primary">{KIND_LABEL[d.kind]}</span>
                    </td>
                    <td className="muted" style={{ fontSize: 12 }}>{humanSize(d.size_bytes)}</td>
                    <td>
                      {d.has_file && (
                        <button className="btn btn-outline btn-small" onClick={() => view(d.id)}>
                          Ver
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {docs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted">
                      Aún no has subido documentos
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
