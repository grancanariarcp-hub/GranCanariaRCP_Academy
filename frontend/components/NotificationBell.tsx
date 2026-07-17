'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface Notif { id: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string }

const fmt = (s: string) => new Date(s).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Campana de notificaciones in-app con contador de no leídas. */
export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const r = await api<{ notifications: Notif[]; unread: number }>('/api/notifications', { auth: true });
      setItems(r.notifications); setUnread(r.unread);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 60000); // refresco ligero cada 60 s
    return () => clearInterval(t);
  }, []);

  // Cerrar al hacer clic fuera.
  useEffect(() => {
    function onDoc(e: MouseEvent) { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      try { await api('/api/notifications/read-all', { method: 'POST', auth: true }); setUnread(0); } catch { /* ignore */ }
    }
  }

  function go(n: Notif) {
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  return (
    <div ref={box} style={{ position: 'relative' }}>
      <button onClick={toggle} aria-label="Notificaciones" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, position: 'relative', lineHeight: 1 }}>
        🔔
        {unread > 0 && (
          <span style={{ position: 'absolute', top: -6, right: -8, background: 'var(--danger)', color: '#fff', borderRadius: 999, fontSize: 10, fontWeight: 700, padding: '1px 5px', minWidth: 16, textAlign: 'center' }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position: 'absolute', right: 0, top: 32, width: 300, maxHeight: 400, overflowY: 'auto', background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 10, boxShadow: 'var(--shadow-md)', zIndex: 100 }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--gray-200)', fontWeight: 600, fontSize: 14 }}>Notificaciones</div>
          {items.length === 0 ? (
            <div className="muted" style={{ padding: 16, fontSize: 13 }}>No tienes notificaciones.</div>
          ) : (
            items.map((n) => (
              <div
                key={n.id}
                onClick={() => go(n)}
                style={{ padding: '10px 12px', borderBottom: '1px solid var(--gray-100, #f0f0f0)', cursor: n.link ? 'pointer' : 'default', background: n.read_at ? '#fff' : 'rgba(26,54,93,0.05)' }}
              >
                <div style={{ fontWeight: 600, fontSize: 13 }}>{n.title}</div>
                {n.body && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{n.body}</div>}
                <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{fmt(n.created_at)}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
