'use client';

import { VideoEmbed } from '@/components/VideoEmbed';

/**
 * Vista previa del curso «como alumno», a partir de los datos ya cargados en el
 * editor (no pide nada al servidor). Muestra módulos y actividades en un formato
 * de lectura para ver el aspecto y el orden antes de publicar. Es de solo
 * lectura: no marca «hecho» ni ejecuta exámenes.
 */

const ICONO: Record<string, string> = {
  documento: '📄', video: '🎬', enlace: '🔗', texto: '📝', imagen: '🖼️',
  test: '🧪', examen: '🎓', videoconferencia: '📹',
};

interface PActivity {
  id: string; type: string; title: string; url: string | null; body: string | null;
  image_url?: string; document_title: string | null;
}
interface PModule { id: string; title: string; activities: PActivity[] }

export function CoursePreview({
  titulo, horas, modules, onClose,
}: {
  titulo: string;
  horas: number | null;
  modules: PModule[];
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div className="card-title">Vista previa · como alumno</div>
          <button className="btn btn-outline btn-small" onClick={onClose}>Cerrar</button>
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
          Así se ve el contenido del curso. Es solo lectura: no marca «hecho» ni abre los exámenes.
        </p>

        <h2 style={{ fontSize: 22, margin: '10px 0 2px' }}>{titulo}</h2>
        {horas != null && <div className="muted" style={{ marginBottom: 14 }}>⏱️ Duración: {horas} h</div>}

        {modules.map((m) => (
          <div key={m.id} style={{ marginBottom: 18 }}>
            <h3 style={{ fontSize: 16, color: 'var(--primary-dark)', borderBottom: '1px solid var(--gray-200)', paddingBottom: 6, marginBottom: 10 }}>{m.title}</h3>
            {m.activities.length === 0 && <p className="muted" style={{ fontSize: 13 }}>Sin actividades.</p>}
            {m.activities.map((a) => (
              <div key={a.id} style={{ marginBottom: 14 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{ICONO[a.type] ?? '•'} {a.title}</div>
                {a.type === 'texto' && a.body && (
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>{a.body}</div>
                )}
                {a.type === 'video' && a.url && <VideoEmbed url={a.url} />}
                {a.type === 'enlace' && a.url && (
                  <a href={a.url} target="_blank" rel="noreferrer" className="link-action" style={{ fontSize: 14 }}>Abrir enlace ↗</a>
                )}
                {a.type === 'imagen' && a.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.image_url} alt="" style={{ maxWidth: '100%', borderRadius: 10 }} />
                )}
                {a.type === 'documento' && (
                  <div className="muted" style={{ fontSize: 13 }}>📄 {a.document_title ?? 'Documento PDF'}</div>
                )}
                {(a.type === 'test' || a.type === 'examen') && (
                  <div className="info-box" style={{ fontSize: 13 }}>Prueba de evaluación ({a.type === 'examen' ? 'examen' : 'test'}).</div>
                )}
                {a.type === 'videoconferencia' && (
                  <div className="info-box" style={{ fontSize: 13 }}>Clase en directo.</div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
