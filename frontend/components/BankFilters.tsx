'use client';

import { useMemo } from 'react';

/**
 * Filtros del listado de bancos.
 *
 * Las dos dimensiones libres del banco significan cosas distintas según el
 * tipo: en RCP son institución y población objetivo; en OPE, comunidad y
 * categoría profesional. Se guardan en las mismas columnas, así que aquí solo
 * cambia la ETIQUETA según el tipo que se esté filtrando. Si no hay tipo
 * elegido, se usan rótulos neutros para no mentir.
 */

export interface Faceta { valor: string; n: number }
export interface Facetas { kind: Faceta[]; dim1: Faceta[]; dim2: Faceta[]; anio: Faceta[] }

export interface FiltrosBanco {
  kind: string;
  dim1: string;
  dim2: string;
  anio: string;
  visibility: string;
  mine: boolean;
  conPreguntas: boolean;
  q: string;
}

export const FILTROS_VACIOS: FiltrosBanco = {
  kind: '', dim1: '', dim2: '', anio: '', visibility: '', mine: false, conPreguntas: false, q: '',
};

const NOMBRE_TIPO: Record<string, string> = {
  rcp: 'RCP', formativo: 'Formativo', ope: 'OPE', mir: 'MIR', otro: 'Otro',
};

function rotulos(kind: string): { d1: string; d2: string } {
  if (kind === 'rcp') return { d1: 'Institución', d2: 'Población objetivo' };
  if (kind === 'formativo') return { d1: 'Especialidad', d2: 'Tema' };
  if (kind === 'ope' || kind === 'mir') return { d1: 'Comunidad', d2: 'Categoría' };
  return { d1: 'Institución / comunidad', d2: 'Población / categoría' };
}

export function BankFilters({
  filtros, setFiltros, facetas, total,
}: {
  filtros: FiltrosBanco;
  setFiltros: (f: FiltrosBanco) => void;
  facetas: Facetas | null;
  total: number;
}) {
  const r = useMemo(() => rotulos(filtros.kind), [filtros.kind]);
  const activos = filtros.kind || filtros.dim1 || filtros.dim2 || filtros.anio
    || filtros.visibility || filtros.mine || filtros.conPreguntas || filtros.q;

  const set = (parcial: Partial<FiltrosBanco>) => setFiltros({ ...filtros, ...parcial });

  return (
    <div className="filter-bar" style={{ maxWidth: 'none' }}>
      <div className="filter-grid">
        <div>
          <label className="form-label" htmlFor="fb-q">Buscar</label>
          <input id="fb-q" className="form-input" placeholder="Nombre o descripción"
            value={filtros.q} onChange={(e) => set({ q: e.target.value })} />
        </div>

        <div>
          <label className="form-label" htmlFor="fb-kind">Tipo</label>
          <select id="fb-kind" className="form-select" value={filtros.kind}
            /* Al cambiar de tipo se limpian las dimensiones: significan otra cosa. */
            onChange={(e) => set({ kind: e.target.value, dim1: '', dim2: '' })}>
            <option value="">Todos</option>
            {(facetas?.kind ?? []).map((f) => (
              <option key={f.valor} value={f.valor}>{NOMBRE_TIPO[f.valor] ?? f.valor} ({f.n})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="form-label" htmlFor="fb-d1">{r.d1}</label>
          <select id="fb-d1" className="form-select" value={filtros.dim1}
            onChange={(e) => set({ dim1: e.target.value })} disabled={(facetas?.dim1 ?? []).length === 0}>
            <option value="">Cualquiera</option>
            {(facetas?.dim1 ?? []).map((f) => <option key={f.valor} value={f.valor}>{f.valor} ({f.n})</option>)}
          </select>
        </div>

        <div>
          <label className="form-label" htmlFor="fb-d2">{r.d2}</label>
          <select id="fb-d2" className="form-select" value={filtros.dim2}
            onChange={(e) => set({ dim2: e.target.value })} disabled={(facetas?.dim2 ?? []).length === 0}>
            <option value="">Cualquiera</option>
            {(facetas?.dim2 ?? []).map((f) => <option key={f.valor} value={f.valor}>{f.valor} ({f.n})</option>)}
          </select>
        </div>

        <div>
          <label className="form-label" htmlFor="fb-anio">Año</label>
          <select id="fb-anio" className="form-select" value={filtros.anio}
            onChange={(e) => set({ anio: e.target.value })} disabled={(facetas?.anio ?? []).length === 0}>
            <option value="">Cualquiera</option>
            {(facetas?.anio ?? []).map((f) => <option key={f.valor} value={f.valor}>{f.valor} ({f.n})</option>)}
          </select>
        </div>

        <div>
          <label className="form-label" htmlFor="fb-vis">Visibilidad</label>
          <select id="fb-vis" className="form-select" value={filtros.visibility}
            onChange={(e) => set({ visibility: e.target.value })}>
            <option value="">Todas</option>
            <option value="publico">Públicos</option>
            <option value="privado">Privados</option>
          </select>
        </div>

        <div>
          <span className="form-label">Solo míos</span>
          <button type="button" className={`filter-toggle press${filtros.mine ? ' is-on' : ''}`}
            aria-pressed={filtros.mine} onClick={() => set({ mine: !filtros.mine })}>
            Los que he creado
          </button>
        </div>

        <div>
          <span className="form-label">Contenido</span>
          <button type="button" className={`filter-toggle press${filtros.conPreguntas ? ' is-on' : ''}`}
            aria-pressed={filtros.conPreguntas} onClick={() => set({ conPreguntas: !filtros.conPreguntas })}>
            Solo con preguntas
          </button>
        </div>
      </div>

      <div className="filter-foot">
        <span className="muted">{total} banco{total === 1 ? '' : 's'}</span>
        {activos && (
          <button type="button" className="link-action" onClick={() => setFiltros({ ...FILTROS_VACIOS })}>
            Limpiar filtros
          </button>
        )}
      </div>
    </div>
  );
}
