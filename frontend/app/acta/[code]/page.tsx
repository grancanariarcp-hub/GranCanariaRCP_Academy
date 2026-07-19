'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { PageNav } from '@/components/PageNav';

/**
 * Verificación pública de un acta.
 *
 * Es el destino del QR impreso en el documento. Muestra los datos de la
 * actividad y las cifras agregadas, nunca la relación nominal de alumnos: quien
 * verifica un acta necesita comprobar que existe y que no ha sido alterada, no
 * conocer quién la cursó.
 */

interface Acta {
  numero: string;
  version: number;
  cerradaEl: string;
  curso: string;
  periodo: string;
  modalidad: string;
  horas: number | string | null;
  acreditacion: string | null;
  cfc: string | null;
  director: string | null;
  matriculados: number;
  aptos: number;
  hash: string;
}

export default function VerificarActaPage() {
  const params = useParams();
  const code = params.code as string;
  const [datos, setDatos] = useState<{ valida: boolean; acta: Acta } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ valida: boolean; acta: Acta }>(`/api/public/actas/${code}`)
      .then(setDatos)
      .catch(() => setError('No existe ningún acta con este código.'));
  }, [code]);

  return (
    <div style={{ minHeight: '100vh', padding: '32px 16px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <PageNav />

        {error && <div className="alert alert-error">{error}</div>}
        {!datos && !error && <p className="muted">Comprobando…</p>}

        {datos && (
          <div className="card animate-pop" style={{ borderTop: `5px solid ${datos.valida ? 'var(--success)' : 'var(--danger)'}` }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 40, lineHeight: 1 }}>{datos.valida ? '✓' : '⚠'}</div>
              <h1 style={{ fontSize: 22, marginTop: 8 }}>
                {datos.valida ? 'Acta auténtica' : 'Acta alterada'}
              </h1>
              <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>
                {datos.valida
                  ? 'Los datos coinciden con los registrados al cerrarse el acta.'
                  : 'El contenido no coincide con la huella registrada. No debe considerarse válida.'}
              </p>
            </div>

            <Fila k="Nº de acta" v={`${datos.acta.numero}${datos.acta.version > 1 ? ` · versión ${datos.acta.version}` : ''}`} />
            <Fila k="Actividad formativa" v={datos.acta.curso} />
            <Fila k="Periodo" v={datos.acta.periodo} />
            <Fila k="Modalidad" v={datos.acta.modalidad} />
            {datos.acta.horas && <Fila k="Duración" v={`${Number(datos.acta.horas)} horas`} />}
            {datos.acta.acreditacion && <Fila k="Acreditación" v={datos.acta.acreditacion} />}
            {datos.acta.cfc && <Fila k="Créditos CFC" v={datos.acta.cfc} />}
            {datos.acta.director && <Fila k="Director/a" v={datos.acta.director} />}
            <Fila k="Alumnos matriculados" v={String(datos.acta.matriculados)} />
            <Fila k="Alumnos aptos" v={String(datos.acta.aptos)} />
            <Fila k="Fecha de cierre" v={new Date(datos.acta.cerradaEl).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })} />

            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--gray-200)' }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Huella SHA-256</div>
              <code style={{ fontSize: 11, wordBreak: 'break-all', color: 'var(--gray-700)' }}>{datos.acta.hash}</code>
            </div>

            <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>
              Por protección de datos, esta página no muestra la relación nominal de alumnos. Para obtener el
              acta completa, dirígete a la entidad organizadora.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Fila({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--gray-100)' }}>
      <div className="muted" style={{ fontSize: 13, width: 170, flexShrink: 0 }}>{k}</div>
      <div style={{ fontSize: 14, fontWeight: 500 }}>{v}</div>
    </div>
  );
}
