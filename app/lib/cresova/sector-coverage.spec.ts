import { describe, expect, it } from 'vitest';
import { detectSectorMatch } from './sector-detector';
import { SECTORS_WITH_EXEMPLARS } from '~/lib/common/prompts/cresova-sectorial-exemplars';

/**
 * La cobertura del detector contra los rubros que una agencia hondureña de verdad atiende.
 *
 * Existe porque la medición dolió: de 54 rubros reales, 29 caían en «comercio, tienda, retail» sin
 * ser comercio — farmacias, ópticas, talleres, imprentas, colegios, funerarias, aseguradoras. El
 * default era indistinguible de un acierto, así que esos sitios salían con la tipografía, la
 * paleta y el ejemplo de un rubro ajeno y nadie tenía forma de enterarse.
 *
 * ESTA LISTA ES EL LUGAR DONDE CRECE. Cuando Cresova tome un cliente de un rubro nuevo, se agrega
 * acá: si el detector lo reconoce, el test pasa; si no, falla nombrándolo y se decide si merece
 * palabras clave o si es de los que el modelo elige solo.
 */

const SALUD = 'salud, legal, financiero, profesional';
const OFICIOS = 'oficios, construcción, limpieza, transporte';
const BELLEZA = 'belleza, bienestar, suplementos';
const GASTRO = 'gastronomía, café, catering';
const TURISMO = 'turismo, aventura, hotelería';
const COMERCIO = 'comercio, tienda, retail';

/** Rubros que deben caer en una fila concreta de la tabla. */
const ESPERADOS: Array<[string, string]> = [
  ['clínica dental en Tegucigalpa', SALUD],
  ['consultorio médico', SALUD],
  ['bufete de abogados', SALUD],
  ['clínica veterinaria', SALUD],
  ['farmacia de barrio', SALUD],
  ['laboratorio clínico', SALUD],
  ['óptica y optometría', SALUD],
  ['inmobiliaria', SALUD],
  ['aseguradora', SALUD],
  ['cooperativa de ahorro y crédito', SALUD],

  ['restaurante de mariscos', GASTRO],
  ['cafetería de especialidad', GASTRO],
  ['repostería y panadería', GASTRO],
  ['food truck de baleadas', GASTRO],

  ['hotel boutique en Roatán', TURISMO],
  ['tour operador de buceo', TURISMO],
  ['hostal', TURISMO],
  ['agencia de viajes', TURISMO],

  ['barbería', BELLEZA],
  ['salón de belleza', BELLEZA],
  ['spa', BELLEZA],
  ['gimnasio', BELLEZA],
  ['estudio de tatuajes', BELLEZA],

  ['taller mecánico', OFICIOS],
  ['constructora', OFICIOS],
  ['empresa de limpieza', OFICIOS],
  ['mensajería y paquetería', OFICIOS],
  ['electricista', OFICIOS],
  ['herrería', OFICIOS],
  ['imprenta', OFICIOS],
  ['lavandería', OFICIOS],

  ['ferretería', COMERCIO],
  ['tienda de ropa', COMERCIO],
  ['librería', COMERCIO],
  ['joyería', COMERCIO],
  ['floristería', COMERCIO],
];

/**
 * Rubros que hoy no tienen fila en la tabla, y está bien que no la tengan.
 *
 * Lo que NO está bien es fingir que sí. Estos tienen que salir con `matched: false` para que el
 * prompt le pida al modelo elegir la fila en vez de entregarle una equivocada. Si alguno de estos
 * se vuelve habitual para Cresova, la decisión es de Diego: agregarle una fila propia a la tabla
 * (con su tipografía y su paleta) o dejarlo acá.
 */
const SIN_FILA = [
  'colegio bilingüe',
  'academia de inglés',
  'guardería infantil',
  'escuela de música',
  'funeraria',
  'iglesia',
  'organización sin fines de lucro',
  'estudio fotográfico',
  'agencia de publicidad',
];

const pedido = (rubro: string) => `Crea una página web para un negocio de ${rubro} en Honduras`;

describe('la cobertura del detector de rubros', () => {
  it.each(ESPERADOS)('«%s» cae en la fila correcta', (rubro, esperado) => {
    const resultado = detectSectorMatch(pedido(rubro));

    expect(resultado.matched, `«${rubro}» no lo reconoce ninguna palabra clave`).toBe(true);
    expect(resultado.sector).toBe(esperado);
  });

  it.each(SIN_FILA)('«%s» se declara desconocido en vez de fingir un rubro', (rubro) => {
    /*
     * El caso general: la lista de rubros que una agencia atiende no se termina nunca. Lo que
     * escala no es una lista más larga de palabras clave, es que cuando no sabemos, se diga.
     */
    expect(detectSectorMatch(pedido(rubro)).matched).toBe(false);
  });

  it('la mayoría de los rubros reales se reconocen, no caen al default', () => {
    const todos = [...ESPERADOS.map(([rubro]) => rubro), ...SIN_FILA];
    const reconocidos = todos.filter((rubro) => detectSectorMatch(pedido(rubro)).matched);

    // antes de esto: 25 de 54. El resto se hacía pasar por comercio.
    expect(reconocidos.length / todos.length).toBeGreaterThan(0.75);
  });

  it('todo sector reconocido o tiene ejemplo propio o es uno de los dos que viven en otro lado', () => {
    /*
     * Turismo vive en los section exemplars (la tienda de buceo) y belleza todavía no tiene. Este
     * test es el que avisa si aparece una fila nueva sin ejemplo y sin que nadie lo note.
     */
    const conEjemplo = new Set([...SECTORS_WITH_EXEMPLARS, TURISMO, BELLEZA]);
    const detectados = new Set(ESPERADOS.map(([rubro]) => detectSectorMatch(pedido(rubro)).sector));

    for (const sector of detectados) {
      expect(conEjemplo.has(sector), `${sector} no tiene ejemplo ni excepción declarada`).toBe(true);
    }
  });
});
