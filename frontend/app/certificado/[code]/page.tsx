'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError, downloadFile } from '@/lib/api';
import { AppVersion } from '@/components/AppVersion';

interface Signer { nombre: string | null; cargo: string | null }
interface Cert {
  code: string;
  studentName: string;
  courseId: string;
  courseTitle: string;
  modality: string;
  hours: number | null;
  dateRange: string;
  cfc: string | null;
  acreditacion: string | null;
  certifica: string;
  firmante1: Signer;
  firmante2: Signer;
  issued: string;
}
interface Mod { title: string; activities: Array<{ type: string; title: string }> }

export default function CertificadoPage() {
  const code = useParams().code as string;
  const [cert, setCert] = useState<Cert | null>(null);
  const [program, setProgram] = useState<Mod[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ certificate: Cert; program: Mod[] }>(`/api/public/certificates/${code}`)
      .then((r) => { setCert(r.certificate); setProgram(r.program); })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Certificado no disponible'));
  }, [code]);

  async function download() {
    try { await downloadFile(`/api/public/certificates/${code}/pdf`, `certificado-${code}.pdf`); } catch { /* ignore */ }
  }

  return (
    <div style={{ minHeight: '100vh', padding: '32px 16px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <p style={{ marginBottom: 16 }}><Link href="/">← Inicio</Link></p>
        {error && <div className="alert alert-error">{error}</div>}
        {!cert ? (
          !error && <div className="muted">Cargando…</div>
        ) : (
          <>
            {/* Sello de verificación */}
            <div className="alert alert-success" style={{ textAlign: 'center' }}>
              ✅ Certificado verificado · código <strong>{cert.code}</strong>
            </div>

            {/* Versión digital del certificado */}
            <div className="card" style={{ border: '2px solid var(--primary-dark)', textAlign: 'center', padding: 28 }}>
              <div style={{ color: 'var(--primary-dark)', fontWeight: 700, letterSpacing: 1, fontSize: 14 }}>GRAN CANARIA RCP · CAMPUS</div>
              <h1 style={{ letterSpacing: 3, margin: '14px 0 6px', color: 'var(--primary-dark)' }}>CERTIFICADO</h1>
              <p style={{ margin: '10px 0 2px' }}>{cert.certifica} certifica que:</p>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#1a202c', margin: '6px 0' }}>{cert.studentName}</div>
              <p style={{ fontSize: 15, margin: '10px auto', maxWidth: 560 }}>
                APROBÓ el curso «<strong>{cert.courseTitle}</strong>», desarrollado {cert.modality}
                {cert.dateRange ? ` ${cert.dateRange}` : ''}, con un total de {cert.hours ?? '—'} horas.
              </p>
              {cert.cfc && <p style={{ color: '#276749', fontWeight: 700 }}>CFC: {cert.cfc}</p>}
              {cert.acreditacion && <p className="muted" style={{ fontStyle: 'italic', fontSize: 13 }}>{cert.acreditacion}</p>}

              <div style={{ display: 'flex', justifyContent: 'center', gap: 40, flexWrap: 'wrap', marginTop: 20 }}>
                {[cert.firmante1, cert.firmante2].filter((f) => f?.nombre).map((f, i) => (
                  <div key={i} style={{ borderTop: '1px solid #555', paddingTop: 4, minWidth: 160 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{f.nombre}</div>
                    {f.cargo && <div className="muted" style={{ fontSize: 12 }}>{f.cargo}</div>}
                  </div>
                ))}
              </div>
              <p className="muted" style={{ fontSize: 12, marginTop: 18 }}>Emitido: {cert.issued}</p>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={download}>📄 Descargar PDF</button>
                <Link className="btn btn-outline" href={`/curso/${cert.courseId}`}>Ver ficha del curso</Link>
              </div>
            </div>

            {/* Programa del curso */}
            {program.length > 0 && (
              <div className="card" style={{ marginTop: 20 }}>
                <div className="card-header"><div className="card-title">Programa del curso</div></div>
                {program.map((m, i) => (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <strong>{m.title}</strong>
                    {m.activities.length > 0 && (
                      <ul style={{ margin: '4px 0 0 18px', fontSize: 14 }}>
                        {m.activities.map((a, j) => <li key={j}>{a.title}</li>)}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        <p style={{ textAlign: 'center', marginTop: 24 }}><AppVersion /></p>
      </div>
    </div>
  );
}
