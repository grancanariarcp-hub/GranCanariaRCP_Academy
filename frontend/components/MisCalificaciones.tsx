'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

/**
 * Calificaciones del alumno: las actividades evaluables de sus cursos con el
 * resultado según su método (examen automático, finalización o nota manual).
 */

interface Item {
  course_id: string;
  course_title: string;
  modulo: string;
  actividad: string;
  metodo_eval: 'examen' | 'finalizacion' | 'manual' | null;
  examen_score: number | null;
  examen_apto: boolean | null;
  completada: boolean;
  manual_nota: number | string | null;
  manual_apto: boolean | null;
}

function Resultado({ it }: { it: Item }) {
  if (it.metodo_eval === 'examen') {
    if (it.examen_score == null) return <span className="muted">Sin intentos</span>;
    return <span><strong>{it.examen_score}%</strong> <span className={`badge ${it.examen_apto ? 'badge-success' : 'badge-danger'}`}>{it.examen_apto ? 'apto' : 'no apto'}</span></span>;
  }
  if (it.metodo_eval === 'finalizacion') {
    return it.completada ? <span className="badge badge-success">Hecho ✓</span> : <span className="badge badge-warning">Pendiente</span>;
  }
  if (it.metodo_eval === 'manual') {
    if (it.manual_nota == null && it.manual_apto == null) return <span className="muted">Sin calificar</span>;
    return <span>{it.manual_nota != null && <strong>{it.manual_nota}</strong>}{it.manual_apto != null && <span className={`badge ${it.manual_apto ? 'badge-success' : 'badge-danger'}`} style={{ marginLeft: 6 }}>{it.manual_apto ? 'apto' : 'no apto'}</span>}</span>;
  }
  return <span className="muted">—</span>;
}

export function MisCalificaciones() {
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    api<{ items: Item[] }>('/api/student/calificaciones', { auth: true })
      .then((r) => setItems(r.items)).catch(() => setItems([]));
  }, []);

  if (!items) return <div className="card"><div className="muted">Cargando…</div></div>;
  if (items.length === 0) {
    return (
      <div className="card">
        <div className="card-header"><div className="card-title">Calificaciones</div></div>
        <p className="muted" style={{ fontSize: 14 }}>Aún no tienes actividades evaluadas. Aquí verás tus notas a medida que tus profesores las publiquen.</p>
      </div>
    );
  }

  // Agrupar por curso, conservando el orden que llega del servidor.
  const cursos: Array<{ id: string; title: string; items: Item[] }> = [];
  for (const it of items) {
    let g = cursos.find((c) => c.id === it.course_id);
    if (!g) { g = { id: it.course_id, title: it.course_title, items: [] }; cursos.push(g); }
    g.items.push(it);
  }

  return (
    <>
      {cursos.map((c) => (
        <div className="card" key={c.id} style={{ marginBottom: 16 }}>
          <div className="card-header"><div className="card-title">{c.title}</div></div>
          <div className="table-responsive">
            <table>
              <thead><tr><th>Actividad</th><th>Módulo</th><th>Resultado</th></tr></thead>
              <tbody>
                {c.items.map((it, i) => (
                  <tr key={i}>
                    <td>{it.actividad}</td>
                    <td className="muted" style={{ fontSize: 12 }}>{it.modulo}</td>
                    <td><Resultado it={it} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </>
  );
}
