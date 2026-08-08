import { APP_VERSION, APP_COMMIT } from '@/lib/version';

/**
 * Etiqueta de versión: se muestra solo «vX.Y.Z». El commit exacto queda en el
 * tooltip (hover) por si hace falta para depurar, pero no se publica a la vista.
 */
export function AppVersion({ style }: { style?: React.CSSProperties }) {
  return (
    <span
      title={`commit ${APP_COMMIT}`}
      style={{ fontSize: 12, color: 'var(--text-secondary)', ...style }}
    >
      v{APP_VERSION}
    </span>
  );
}
