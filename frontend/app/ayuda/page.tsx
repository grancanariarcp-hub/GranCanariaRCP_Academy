'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageNav } from '@/components/PageNav';
import { Cuerpo } from '@/components/ayuda/Formato';
import { buscar, seccionesPara, type Articulo } from '@/lib/ayuda';
import { getUser, type Role } from '@/lib/auth';

/**
 * Manual completo.
 *
 * Es el mismo contenido que sale en los paneles de ayuda de cada pantalla, aquí
 * reunido y buscable. Solo muestra lo que corresponde a quien lo lee: a un
 * alumno no le sirve —y le distrae— el capítulo de dirigir cursos.
 *
 * Se puede imprimir: el estilo de impresión oculta el índice y el buscador y
 * despliega todos los artículos, de modo que sale un manual en papel de verdad.
 */

export default function AyudaPage() {
  return (
    <Suspense fallback={null}>
      <Manual />
    </Suspense>
  );
}

function Manual() {
  const params = useSearchParams();
  const [rol, setRol] = useState<Role | null>(null);
  const [listo, setListo] = useState(false);
  const [consulta, setConsulta] = useState('');
  const [abierto, setAbierto] = useState<string | null>(params.get('tema'));
  const contenedor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRol(getUser()?.role ?? null);
    setListo(true);
  }, []);

  const secciones = useMemo(() => (listo ? seccionesPara(rol) : []), [rol, listo]);
  const resultados = useMemo(
    () => (consulta.trim().length > 1 ? buscar(consulta, rol) : null),
    [consulta, rol],
  );

  // Si se llega con ?tema=..., se abre ese artículo y se lleva la vista hasta él.
  useEffect(() => {
    if (!listo || !abierto) return;
    const el = document.getElementById(`art-${abierto}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Solo al montar: después, abrir un artículo no debe mover la página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo]);

  const total = secciones.reduce((n, s) => n + s.articulos.length, 0);

  return (
    <div className="container" style={{ paddingTop: 20, paddingBottom: 60 }} ref={contenedor}>
      <div className="no-print">
        <PageNav />
      </div>

      <header style={{ margin: '10px 0 22px' }}>
        <h1 style={{ marginBottom: 6 }}>Manual de uso</h1>
        <p className="muted" style={{ maxWidth: 640, margin: 0, lineHeight: 1.6 }}>
          Todo lo que hace la plataforma, explicado paso a paso.{' '}
          {rol === null
            ? 'Entra con tu cuenta para ver además el manual de tu papel en la plataforma.'
            : `Se muestran los ${total} apartados que corresponden a tu perfil.`}
        </p>
      </header>

      <div className="no-print" style={{ marginBottom: 24 }}>
        <input
          type="search"
          className="form-input"
          placeholder="Buscar en el manual: certificado, asistencia, precio…"
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          style={{ maxWidth: 460 }}
          aria-label="Buscar en el manual"
        />
      </div>

      {resultados !== null ? (
        <section>
          <h2 style={{ fontSize: 17, marginBottom: 12 }}>
            {resultados.length === 0
              ? 'Sin resultados'
              : `${resultados.length} ${resultados.length === 1 ? 'apartado' : 'apartados'}`}
          </h2>
          {resultados.length === 0 ? (
            <p className="muted" style={{ fontSize: 14 }}>
              No hay nada con esas palabras. Prueba con una sola palabra —«acta», «pago», «QR»— o
              borra el buscador para ver el manual entero.
            </p>
          ) : (
            resultados.map((a) => (
              <Desplegable key={a.id} art={a} abierto={abierto === a.id} onAlternar={setAbierto} />
            ))
          )}
        </section>
      ) : (
        secciones.map(({ seccion, articulos }) => (
          <section key={seccion} style={{ marginBottom: 30 }}>
            <h2
              style={{
                fontSize: 17,
                marginBottom: 12,
                paddingBottom: 6,
                borderBottom: '2px solid var(--gray-300)',
              }}
            >
              {seccion}
            </h2>
            {articulos.map((a) => (
              <Desplegable key={a.id} art={a} abierto={abierto === a.id} onAlternar={setAbierto} />
            ))}
          </section>
        ))
      )}

      {listo && total === 0 && (
        <p className="muted">El manual no tiene todavía apartados para este perfil.</p>
      )}
    </div>
  );
}

/** Un artículo del manual, plegado hasta que se pulsa. */
function Desplegable({
  art,
  abierto,
  onAlternar,
}: {
  art: Articulo;
  abierto: boolean;
  onAlternar: (id: string | null) => void;
}) {
  return (
    <article
      id={`art-${art.id}`}
      className="card ayuda-art"
      style={{ padding: 0, marginBottom: 10, overflow: 'hidden' }}
    >
      <button
        type="button"
        onClick={() => onAlternar(abierto ? null : art.id)}
        aria-expanded={abierto}
        style={{
          display: 'block',
          width: '100%',
          padding: '14px 16px',
          textAlign: 'left',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <span
          style={{
            display: 'block',
            fontSize: 15.5,
            fontWeight: 700,
            color: 'var(--primary-dark)',
          }}
        >
          {art.titulo}
        </span>
        <span
          style={{
            display: 'block',
            marginTop: 3,
            fontSize: 13,
            lineHeight: 1.45,
            color: 'var(--text-secondary)',
          }}
        >
          {art.resumen}
        </span>
      </button>
      {/* Se pinta siempre aunque esté plegado: así el buscador del navegador lo
          encuentra y al imprimir sale el manual completo, no solo lo abierto. */}
      <div className={`ayuda-art-cuerpo ${abierto ? 'abierto' : ''}`} style={{ padding: '0 16px 16px' }}>
        <Cuerpo bloques={art.cuerpo} />
      </div>
    </article>
  );
}
