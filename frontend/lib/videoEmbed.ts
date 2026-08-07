/**
 * Convierte un enlace de YouTube o Vimeo en su URL para incrustar (iframe),
 * de modo que el vídeo se reproduzca DENTRO del campus sin sacar al alumno a la
 * página del proveedor ni exponerle vídeos relacionados o publicidad.
 *
 * YouTube se sirve por youtube-nocookie.com (modo de privacidad mejorada) y sin
 * mostrar recomendaciones al terminar. Si el enlace no es de un proveedor
 * reconocido, devuelve null y quien llama muestra un enlace normal como respaldo.
 */
export function urlIncrustable(url: string | null | undefined): string | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, '').toLowerCase();

  // --- YouTube ---
  if (host === 'youtu.be') {
    const id = u.pathname.slice(1).split('/')[0];
    return youtube(id);
  }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'm.youtube.com') {
    if (u.pathname === '/watch') return youtube(u.searchParams.get('v'));
    const m = u.pathname.match(/^\/(embed|shorts|v)\/([^/?]+)/);
    if (m) return youtube(m[2]);
    return null;
  }

  // --- Vimeo ---
  if (host === 'vimeo.com') {
    // vimeo.com/12345678  o  vimeo.com/channels/algo/12345678
    const id = u.pathname.split('/').filter(Boolean).pop();
    return vimeo(id);
  }
  if (host === 'player.vimeo.com') {
    const m = u.pathname.match(/\/video\/(\d+)/);
    return m ? vimeo(m[1]) : null;
  }

  return null;
}

/** Un id de YouTube es alfanumérico con - y _; 11 caracteres. */
function youtube(id: string | null | undefined): string | null {
  if (!id || !/^[A-Za-z0-9_-]{6,20}$/.test(id)) return null;
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`;
}

/** Un id de Vimeo es numérico. */
function vimeo(id: string | null | undefined): string | null {
  if (!id || !/^\d{5,}$/.test(id)) return null;
  return `https://player.vimeo.com/video/${id}`;
}
