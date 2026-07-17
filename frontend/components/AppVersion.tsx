import { APP_VERSION, APP_COMMIT } from '@/lib/version';

/**
 * Small version badge. Shows the semantic version and, on hover, the
 * exact commit that is deployed — so it's easy to confirm what's live.
 */
export function AppVersion({ style }: { style?: React.CSSProperties }) {
  return (
    <span
      title={`commit ${APP_COMMIT}`}
      style={{ fontSize: 12, color: 'var(--text-secondary)', ...style }}
    >
      v{APP_VERSION}
      {APP_COMMIT !== 'local' && (
        <span style={{ opacity: 0.6 }}> · {APP_COMMIT}</span>
      )}
    </span>
  );
}
