import { describe, expect, it } from 'vitest';
import { canDescribeBusiness, describeBusinessForBrief, emptyBusinessFields } from './business-brief-input';
import { RUBROS, RUBROS_POR_FAMILIA, detectSectorMatch } from './sector-detector';

const fields = (over: Partial<typeof emptyBusinessFields> = {}) => ({
  ...emptyBusinessFields,
  name: 'Clínica Dental Sonrisa',
  ...over,
});

describe('describeBusinessForBrief', () => {
  it('reads as a colleague describing the client, not as a form dump', () => {
    const description = describeBusinessForBrief(
      fields({
        rubro: 'clínica dental',
        city: 'San Pedro Sula',
        offering: 'ortodoncia, limpiezas y blanqueamiento',
      }),
    );

    expect(description).toContain('Clínica Dental Sonrisa');
    expect(description).toContain('clínica dental');
    expect(description).toContain('San Pedro Sula');
    expect(description).toContain('ortodoncia, limpiezas y blanqueamiento');
  });

  it('omits a field that was left blank instead of writing it empty', () => {
    /*
     * A form dump teaches the next model that "Ciudad: —" is a fact about the business. Leaving
     * the line out says the only true thing: nobody said.
     */
    const description = describeBusinessForBrief(fields({ city: '', offering: '', whatsapp: '' }));

    expect(description).not.toMatch(/:\s*$/m);
    expect(description).not.toContain('undefined');
    expect(description).toBe('Necesito el sitio de Clínica Dental Sonrisa.');
  });

  it('marks the contact details as confirmed, because a person typed them', () => {
    /*
     * Everything else the brief invents comes back under DATOS POR CONFIRMAR. A number Diego read
     * off the client's card is not a guess, and having to re-confirm it is friction he already
     * paid for.
     */
    const description = describeBusinessForBrief(fields({ whatsapp: '+504 9876-5432', social: '@sonrisahn' }));

    expect(description).toContain('+504 9876-5432');
    expect(description).toContain('@sonrisahn');
    expect(description).toMatch(/no los pongas por confirmar/i);
  });

  it('trims what was typed, so a stray space is not part of the name', () => {
    const description = describeBusinessForBrief(fields({ name: '  Café Welchez  ', city: ' Copán ' }));

    expect(description).toContain('de Café Welchez, en Copán.');
  });

  it('survives every field being blank but the name', () => {
    expect(describeBusinessForBrief(fields())).toBe('Necesito el sitio de Clínica Dental Sonrisa.');
  });
});

describe('canDescribeBusiness', () => {
  it('needs a name and nothing else', () => {
    expect(canDescribeBusiness(emptyBusinessFields)).toBe(false);
    expect(canDescribeBusiness({ ...emptyBusinessFields, name: '   ' })).toBe(false);
    expect(canDescribeBusiness({ ...emptyBusinessFields, name: 'Barbería El Cortijo' })).toBe(true);
  });
});

describe('los rubros que ofrece el formulario', () => {
  it('son rubros, no las filas de la tabla', () => {
    /*
     * El desperfecto que este archivo no veía: el desplegable ofrecía «salud, legal, financiero,
     * profesional» como si fuera un rubro, y esa cadena viajaba tal cual al redactor del brief.
     * Para una clínica dental eso es decirle que el negocio es cuatro rubros a la vez.
     */
    expect(RUBROS).toContain('clínica dental');
    expect(RUBROS).toContain('ferretería');
    expect(RUBROS).toContain('taller mecánico');
    expect(RUBROS).not.toContain('salud, legal, financiero, profesional');
  });

  it('no repite ninguno y todos caen bajo una familia', () => {
    expect(RUBROS.length).toBe(new Set(RUBROS).size);
    expect(RUBROS_POR_FAMILIA.every((grupo) => grupo.rubros.length > 0)).toBe(true);
    expect(RUBROS_POR_FAMILIA.flatMap((grupo) => grupo.rubros)).toEqual(RUBROS);
  });

  it('cada rubro del desplegable lo reconoce el detector', () => {
    /*
     * Los dos lados tienen que coincidir en la cadena exacta: el formulario la manda en la
     * descripción y el detector la vuelve a leer para elegir la familia. Si uno se mueve sin el
     * otro, el brief nombra un rubro que el build ya no reconoce.
     */
    for (const rubro of RUBROS) {
      const detectado = detectSectorMatch(`Necesito el sitio de Ejemplo, un negocio de ${rubro}, en Tegucigalpa.`);
      expect(detectado.matched, `«${rubro}» no lo reconoce ninguna palabra clave`).toBe(true);
    }
  });
});
