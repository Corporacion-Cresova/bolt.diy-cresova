import { describe, expect, it } from 'vitest';
import { canDescribeBusiness, describeBusinessForBrief, emptyBusinessFields } from './business-brief-input';
import { SECTOR_NAMES } from './sector-detector';

const fields = (over: Partial<typeof emptyBusinessFields> = {}) => ({
  ...emptyBusinessFields,
  name: 'Clínica Dental Sonrisa',
  ...over,
});

describe('describeBusinessForBrief', () => {
  it('reads as a colleague describing the client, not as a form dump', () => {
    const description = describeBusinessForBrief(
      fields({
        sector: 'salud, legal, financiero, profesional',
        city: 'San Pedro Sula',
        offering: 'ortodoncia, limpiezas y blanqueamiento',
      }),
    );

    expect(description).toContain('Clínica Dental Sonrisa');
    expect(description).toContain('salud, legal, financiero, profesional');
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

describe('the sectors the form offers', () => {
  it('are the detector own sector names, with no duplicates', () => {
    /*
     * The brief prompt looks each sector up in its table by exact string. A hand-written list in
     * the form would be a second place to drift.
     */
    expect(SECTOR_NAMES.length).toBe(new Set(SECTOR_NAMES).size);
    expect(SECTOR_NAMES).toContain('salud, legal, financiero, profesional');
    expect(SECTOR_NAMES).toContain('gastronomía, café, catering');
    expect(SECTOR_NAMES).toContain('turismo, aventura, hotelería');
    expect(SECTOR_NAMES.length).toBeGreaterThanOrEqual(6);
  });
});
