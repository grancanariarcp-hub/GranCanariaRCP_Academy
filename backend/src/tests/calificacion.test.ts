import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { opcionesDepuradas } from '../services/importacionPreguntas.js';

/**
 * Primeros tests del proyecto.
 *
 * No pretenden cubrirlo todo: cubren la función donde un fallo silencioso hace
 * más daño. `opcionesDepuradas` decide qué opción de un examen es la correcta,
 * y su error no se ve en ninguna pantalla —la pregunta parece bien guardada—:
 * se manifiesta semanas después como un suspenso injusto en formación
 * acreditada. Es exactamente el fallo que llegó a producción y que estos casos
 * impiden que vuelva.
 *
 *   npm test
 */

describe('opcionesDepuradas: la correcta no se mueve de sitio', () => {
  test('sin huecos, el índice se conserva', () => {
    const r = opcionesDepuradas(['Adrenalina', 'Amiodarona', 'Atropina'], 1);
    assert.equal(r.options[r.correctIndex], 'Amiodarona');
    assert.equal(r.correctIndex, 1);
  });

  test('un hueco delante de la correcta la desplaza: debe reajustarse', () => {
    // El caso real: el autor marca la 3.ª de ["Adrenalina","","Amiodarona","Atropina"].
    // Al quitar el hueco, el índice 2 pasaría a señalar «Atropina».
    const r = opcionesDepuradas(['Adrenalina', '', 'Amiodarona', 'Atropina'], 2);
    assert.equal(r.options[r.correctIndex], 'Amiodarona');
    assert.deepEqual(r.options, ['Adrenalina', 'Amiodarona', 'Atropina']);
    assert.equal(r.correctIndex, 1);
  });

  test('varios huecos, incluida la última posición', () => {
    const r = opcionesDepuradas(['', 'Uno', '', 'Dos', ''], 3);
    assert.equal(r.options[r.correctIndex], 'Dos');
  });

  test('los espacios sobrantes no cuentan como opción', () => {
    const r = opcionesDepuradas(['Uno', '   ', 'Dos'], 2);
    assert.equal(r.options[r.correctIndex], 'Dos');
    assert.equal(r.options.length, 2);
  });

  test('marcar una opción vacía se rechaza en vez de desplazarse', () => {
    assert.throws(() => opcionesDepuradas(['Uno', '', 'Dos'], 1), /correcta/i);
  });

  test('no marcar ninguna se rechaza', () => {
    assert.throws(() => opcionesDepuradas(['Uno', 'Dos'], undefined), /correcta/i);
  });

  test('menos de dos opciones reales se rechaza', () => {
    assert.throws(() => opcionesDepuradas(['Uno', '', ''], 0), /opciones/i);
  });

  test('el texto se limpia pero no se reordena', () => {
    const r = opcionesDepuradas([' Beta ', 'Alfa'], 0);
    assert.deepEqual(r.options, ['Beta', 'Alfa']);
    assert.equal(r.options[r.correctIndex], 'Beta');
  });
});
