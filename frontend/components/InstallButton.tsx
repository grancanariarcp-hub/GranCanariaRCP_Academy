'use client';

import { useEffect, useState } from 'react';

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Botón flotante "Instalar app". Aparece solo cuando Chrome dispara
 * beforeinstallprompt (es decir, cuando la PWA es instalable). En iOS no existe
 * ese evento; ahí se instala con Compartir → Añadir a pantalla de inicio.
 */
export function InstallButton() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e as BIPEvent); };
    const onInstalled = () => setDeferred(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!deferred) return null;

  return (
    <button
      onClick={async () => { await deferred.prompt(); await deferred.userChoice; setDeferred(null); }}
      style={{
        position: 'fixed', right: 16, bottom: 16, zIndex: 1000,
        background: '#1a365d', color: '#fff', border: 'none', borderRadius: 999,
        padding: '12px 18px', fontSize: 15, fontWeight: 600, cursor: 'pointer',
        boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
      }}
    >
      📲 Instalar app
    </button>
  );
}
