import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Recursos de marca que se incrustan en los PDF.
 *
 * El logotipo viaja con el propio servicio (src/assets, copiado a dist por el
 * postbuild) en lugar de descargarse: un documento oficial no debe depender de
 * que una URL externa responda en el momento de emitirlo.
 *
 * Se cachea en memoria porque se usa en cada diploma emitido.
 */

const aquí = dirname(fileURLToPath(import.meta.url));
const cache = new Map<string, Buffer | null>();

/** src/services -> src/assets | dist/services -> dist/assets */
function leer(nombre: string): Buffer | undefined {
  if (!cache.has(nombre)) {
    try {
      cache.set(nombre, readFileSync(join(aquí, '..', 'assets', nombre)));
    } catch {
      // Sin la imagen el documento sigue emitiéndose, solo que sin marca.
      cache.set(nombre, null);
    }
  }
  return cache.get(nombre) ?? undefined;
}

/** Logotipo completo con el rótulo, para la cabecera. */
export function logoHorizontal(): Buffer | undefined {
  return leer('logo-horizontal.png');
}

/** Emblema sin rótulo, para marcas de agua. */
export function logoEmblema(): Buffer | undefined {
  return leer('logo-emblem.png');
}
