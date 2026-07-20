import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  separarOpciones, separarEtiquetas, resolverCorrecta, opcionesDepuradas,
} from '../services/importacionPreguntas.js';

/**
 * Lectura de ficheros importados.
 *
 * Había tres analizadores, uno por cada puerta de importación, y el mismo
 * fichero se leía distinto según por dónde entrara. Estos casos fijan las
 * reglas comunes para que no vuelvan a separarse.
 */

describe('separarOpciones: la coma no parte una opción', () => {
  test('la coma pertenece a la opción, no la separa', () => {
    // «Adrenalina, 1 mg» es UNA opción. Con la coma como separador se convertía
    // en dos y la pregunta entraba mal sin dar ningún error.
    assert.deepEqual(separarOpciones('Adrenalina, 1 mg|Amiodarona, 300 mg'),
      ['Adrenalina, 1 mg', 'Amiodarona, 300 mg']);
  });

  test('separa por barra y por punto y coma', () => {
    assert.deepEqual(separarOpciones('Uno|Dos'), ['Uno', 'Dos']);
    assert.deepEqual(separarOpciones('Uno;Dos'), ['Uno', 'Dos']);
  });

  test('conserva los huecos y su posición', () => {
    // Imprescindible: la letra del autor está referida a esta lista.
    assert.deepEqual(separarOpciones('Uno||Tres'), ['Uno', '', 'Tres']);
  });

  test('acepta que ya venga como lista', () => {
    assert.deepEqual(separarOpciones([' Uno ', 'Dos']), ['Uno', 'Dos']);
  });
});

describe('separarEtiquetas: aquí la coma SÍ separa', () => {
  test('una lista de públicos se parte por comas', () => {
    assert.deepEqual(separarEtiquetas('sanitarios, docentes'), ['sanitarios', 'docentes']);
  });

  test('y descarta los huecos, que no son etiquetas', () => {
    assert.deepEqual(separarEtiquetas('uno,,dos'), ['uno', 'dos']);
  });
});

describe('resolverCorrecta: letras y números empezando en 1', () => {
  test('por letra', () => {
    assert.equal(resolverCorrecta('A', 4), 0);
    assert.equal(resolverCorrecta('c', 4), 2);
  });

  test('por número, empezando en 1', () => {
    assert.equal(resolverCorrecta('1', 4), 0);
    assert.equal(resolverCorrecta('4', 4), 3);
  });

  test('fuera de rango se rechaza en vez de adivinarse', () => {
    assert.equal(resolverCorrecta('E', 4), null);
    assert.equal(resolverCorrecta('5', 4), null);
    assert.equal(resolverCorrecta('0', 4), null);
    assert.equal(resolverCorrecta('', 4), null);
  });
});

describe('el recorrido completo de una fila importada', () => {
  test('una casilla vacía en medio no mueve la respuesta correcta', () => {
    const brutas = separarOpciones('Adrenalina||Amiodarona|Atropina');
    const marcada = resolverCorrecta('C', brutas.length); // la 3.ª: «Amiodarona»
    const r = opcionesDepuradas(brutas, marcada!);
    assert.equal(r.options[r.correctIndex], 'Amiodarona');
    assert.deepEqual(r.options, ['Adrenalina', 'Amiodarona', 'Atropina']);
  });

  test('marcar una casilla vacía se rechaza', () => {
    const brutas = separarOpciones('Uno||Tres');
    const marcada = resolverCorrecta('B', brutas.length);
    assert.throws(() => opcionesDepuradas(brutas, marcada!), /correcta/i);
  });
});
