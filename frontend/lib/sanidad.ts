/**
 * Listas oficiales para las convocatorias de oposición.
 *
 * Se centralizan aquí para que convocatorias y bancos usen exactamente los
 * mismos rótulos: si una comunidad se escribe de dos formas distintas, los
 * filtros dejan de agrupar y el opositor ve dos veces lo mismo.
 */

/** Las 17 autonomías, las dos ciudades autónomas y el ámbito estatal. */
export const COMUNIDADES = [
  'Andalucía',
  'Aragón',
  'Asturias',
  'Baleares',
  'Canarias',
  'Cantabria',
  'Castilla-La Mancha',
  'Castilla y León',
  'Cataluña',
  'Ceuta',
  'Comunidad Valenciana',
  'Extremadura',
  'Galicia',
  'La Rioja',
  'Madrid',
  'Melilla',
  'Murcia',
  'Navarra',
  'País Vasco',
  'Estatal / Ministerio',
];

/**
 * Categorías que se convocan habitualmente en sanidad, agrupadas para que el
 * desplegable sea manejable. Incluye las pruebas de formación sanitaria
 * especializada (MIR, EIR, FIR y las demás), que no son categorías de plantilla
 * pero se preparan igual y comparten banco de preguntas.
 */
export const CATEGORIAS: Array<{ grupo: string; opciones: string[] }> = [
  {
    grupo: 'Formación sanitaria especializada',
    opciones: [
      'MIR — Medicina',
      'EIR — Enfermería',
      'FIR — Farmacia',
      'PIR — Psicología',
      'BIR — Biología',
      'QIR — Química',
      'RFIR — Radiofísica hospitalaria',
    ],
  },
  {
    grupo: 'Personal facultativo',
    opciones: [
      'Medicina de Familia',
      'Pediatría',
      'Medicina Interna',
      'Anestesiología y Reanimación',
      'Medicina Intensiva',
      'Urgencias y Emergencias',
      'Cirugía General',
      'Traumatología',
      'Ginecología y Obstetricia',
      'Psiquiatría',
      'Radiodiagnóstico',
      'Odontología / Estomatología',
      'Farmacia Hospitalaria',
      'Facultativo especialista (otras)',
    ],
  },
  {
    grupo: 'Personal sanitario no facultativo',
    opciones: [
      'Enfermería',
      'Enfermería especialista',
      'Matrona',
      'Fisioterapia',
      'Terapia Ocupacional',
      'Logopedia',
      'Nutrición y Dietética',
      'Psicología Clínica',
      'Trabajo Social sanitario',
      'Óptica y Optometría',
      'Podología',
    ],
  },
  {
    grupo: 'Técnicos',
    opciones: [
      'Técnico en Cuidados Auxiliares de Enfermería (TCAE)',
      'Técnico en Emergencias Sanitarias (TES)',
      'Técnico Superior en Radiodiagnóstico',
      'Técnico Superior en Radioterapia',
      'Técnico Superior en Laboratorio Clínico',
      'Técnico Superior en Anatomía Patológica',
      'Técnico Superior en Documentación Sanitaria',
      'Técnico Superior en Higiene Bucodental',
      'Técnico en Farmacia',
    ],
  },
  {
    grupo: 'Gestión y servicios',
    opciones: [
      'Auxiliar Administrativo',
      'Administrativo',
      'Grupo Técnico de la Función Administrativa',
      'Celador',
      'Personal de oficio',
    ],
  },
];

/** Todas las categorías en una sola lista, para validar o buscar. */
export const CATEGORIAS_PLANAS = CATEGORIAS.flatMap((g) => g.opciones);
