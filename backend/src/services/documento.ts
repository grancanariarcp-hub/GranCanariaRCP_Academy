/**
 * Documento de identidad: DNI, NIE o pasaporte.
 *
 * Es la llave con la que la academia y PÚLSAR casan al mismo alumno, así que su
 * validación importa: un documento mal escrito rompe el cruce en silencio. No se
 * valida la letra del DNI a propósito —hay pasaportes extranjeros y NIE de todo
 * tipo—, solo que sea un identificador con forma razonable y normalizado igual
 * en las dos plataformas: sin espacios ni guiones y en mayúsculas.
 */

export function normalizarDocumento(v: string): string {
  return v.trim().toUpperCase().replace(/[\s.-]/g, '');
}

/** Devuelve el documento normalizado o null si no tiene forma aceptable. */
export function documentoValido(v: string | null | undefined): string | null {
  if (!v) return null;
  const d = normalizarDocumento(v);
  // Entre 5 y 20 caracteres alfanuméricos: cubre DNI, NIE y pasaportes.
  return /^[A-Z0-9]{5,20}$/.test(d) ? d : null;
}
