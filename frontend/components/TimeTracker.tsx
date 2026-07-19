'use client';

import { useEffect, useRef } from 'react';
import { api } from '@/lib/api';

const BEAT_SECONDS = 60;      // cada cuánto se informa
const IDLE_LIMIT_MS = 120000; // 2 min sin interacción => inactivo

/**
 * Mide el tiempo de estudio. Cada 60 s informa de si el alumno está ACTIVO
 * (pestaña visible + interacción reciente) o solo tiene la pestaña abierta.
 * Así el "lo dejé abierto y me fui" no cuenta como estudio.
 */
export function TimeTracker({ courseId }: { courseId?: string }) {
  const lastInteraction = useRef<number>(Date.now());

  useEffect(() => {
    const touch = () => { lastInteraction.current = Date.now(); };
    const events = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));

    const timer = setInterval(() => {
      const visible = document.visibilityState === 'visible';
      const recent = Date.now() - lastInteraction.current < IDLE_LIMIT_MS;
      api('/api/profile/heartbeat', {
        method: 'POST', auth: true,
        body: JSON.stringify({ courseId, seconds: BEAT_SECONDS, active: visible && recent }),
      }).catch(() => { /* el registro de tiempo nunca debe molestar */ });
    }, BEAT_SECONDS * 1000);

    return () => {
      clearInterval(timer);
      events.forEach((e) => window.removeEventListener(e, touch));
    };
  }, [courseId]);

  return null;
}
