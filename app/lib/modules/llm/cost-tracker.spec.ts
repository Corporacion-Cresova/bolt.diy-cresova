import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import {
  __resetCostTracker,
  getMonthTotal,
  getTodayTotal,
  monthKey,
  todayKey,
  trackGeneration,
  trackImage,
} from './cost-tracker';
import { USD_TO_HNL } from './pricing';

describe('el día que cuenta el contador', () => {
  /*
   * Esto no es una sutileza de husos horarios. La versión anterior cortaba el día en UTC, así que
   * el acumulado se reseteaba a las 6:00 de la tarde en Tegucigalpa, en plena jornada. Un contador
   * cuyo día no coincide con el día de quien lo lee no se usa dos veces.
   *
   * Honduras es UTC-6 todo el año: el país no aplica horario de verano desde 2006, así que no hay
   * caso de borde de cambio de hora que probar.
   */
  it('sigue siendo el mismo día a las 8 de la noche en Honduras', () => {
    // 2026-09-09 02:00 UTC = 2026-09-08 20:00 en Tegucigalpa
    expect(todayKey(new Date('2026-09-09T02:00:00Z'))).toBe('2026-09-08');
  });

  it('cambia de día a la medianoche de Honduras, no a la de UTC', () => {
    // 05:59 UTC sigue siendo el día anterior allá; 06:00 UTC ya es el día nuevo
    expect(todayKey(new Date('2026-09-09T05:59:00Z'))).toBe('2026-09-08');
    expect(todayKey(new Date('2026-09-09T06:00:00Z'))).toBe('2026-09-09');
  });

  it('el mes también cierra en hora de Honduras', () => {
    // 2026-10-01 03:00 UTC todavía es 30 de septiembre en Tegucigalpa
    expect(monthKey(new Date('2026-10-01T03:00:00Z'))).toBe('2026-09');
    expect(monthKey(new Date('2026-10-01T06:00:00Z'))).toBe('2026-10');
  });
});

describe('el acumulado', () => {
  beforeEach(() => {
    __resetCostTracker();
  });

  it('suma tokens, generaciones y costo de cada llamada', () => {
    trackGeneration('deepseek/deepseek-v4-pro', 100_000, 50_000, { silent: true });
    trackGeneration('deepseek/deepseek-v4-pro', 100_000, 50_000, { silent: true });

    const today = getTodayTotal();

    expect(today.generations).toBe(2);
    expect(today.tokensInput).toBe(200_000);
    expect(today.tokensOutput).toBe(100_000);
    expect(today.usd).toBeCloseTo(2 * (0.1 * 0.87 + 0.05 * 1.74), 6);
    expect(today.hnl).toBeCloseTo(today.usd * USD_TO_HNL, 6);
  });

  it('cuenta las imágenes aparte del texto, con el costo que cobró el proveedor', () => {
    /*
     * Las seis fotos de un sitio son cerca de la quinta parte de lo que cuesta generarlo, y no
     * aparecían en ningún total: `trackImage` no existía y `usage.cost` se descartaba.
     */
    trackGeneration('deepseek/deepseek-v4-pro', 10_000, 5_000, { silent: true });
    trackImage('black-forest-labs/flux.2-pro', 0.03);
    trackImage('black-forest-labs/flux.2-pro', 0.045);

    const today = getTodayTotal();

    expect(today.images).toBe(2);
    expect(today.generations).toBe(1);
    expect(today.imagesUsd).toBeCloseTo(0.075, 6);
    expect(today.usd).toBeGreaterThan(0.075);
  });

  it('cuenta aparte las generaciones cuyo modelo no tiene precio', () => {
    /*
     * Para que el total pueda leerse con honestidad: si este número no es cero, lo mostrado es un
     * piso, no el gasto. Antes esas generaciones sumaban cero y el total se veía igual de sano.
     */
    trackGeneration('deepseek/deepseek-v4-pro', 10_000, 5_000, { silent: true });
    trackGeneration('un/modelo-nuevo-sin-precio', 900_000, 400_000, { silent: true });

    const today = getTodayTotal();

    expect(today.generations).toBe(2);
    expect(today.unpricedGenerations).toBe(1);
  });

  it('devuelve una copia, para que nadie corrompa el acumulado desde afuera', () => {
    trackGeneration('deepseek/deepseek-v4-pro', 10_000, 5_000, { silent: true });

    const snapshot = getTodayTotal();
    snapshot.usd = 999;

    expect(getTodayTotal().usd).not.toBe(999);
  });

  it('arranca en cero y no explota cuando todavía no pasó nada', () => {
    const today = getTodayTotal();

    expect(today.generations).toBe(0);
    expect(today.usd).toBe(0);
    expect(today.images).toBe(0);
    expect(today.unpricedGenerations).toBe(0);
  });
});

describe('el total del mes', () => {
  beforeEach(() => {
    __resetCostTracker();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('suma los días del mes en curso y deja fuera los de otro mes', () => {
    vi.useFakeTimers();

    vi.setSystemTime(new Date('2026-09-10T18:00:00Z'));
    trackGeneration('deepseek/deepseek-v4-pro', 100_000, 50_000, { silent: true });

    vi.setSystemTime(new Date('2026-09-20T18:00:00Z'));
    trackGeneration('deepseek/deepseek-v4-pro', 100_000, 50_000, { silent: true });

    vi.setSystemTime(new Date('2026-10-05T18:00:00Z'));
    trackGeneration('deepseek/deepseek-v4-pro', 100_000, 50_000, { silent: true });

    // parados en octubre, el mes son solo las generaciones de octubre
    const october = getMonthTotal();
    expect(october.date).toBe('2026-10');
    expect(october.generations).toBe(1);

    // y de vuelta en septiembre, las dos de septiembre
    vi.setSystemTime(new Date('2026-09-25T18:00:00Z'));

    const september = getMonthTotal();
    expect(september.date).toBe('2026-09');
    expect(september.generations).toBe(2);
  });
});
