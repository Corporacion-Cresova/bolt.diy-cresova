/**
 * Lo que se gastó hoy y en el mes, acumulado en memoria del proceso.
 *
 * Existía desde hace tiempo y funcionaba, pero nada fuera de este archivo llamaba a
 * `getTodayTotal()` ni a `getMonthTotal()`: el único lugar donde el gasto aparecía era un log
 * dentro del contenedor. Por eso auditar cuánto costó una generación significaba abrir el panel de
 * OpenRouter, que es exactamente el trabajo que este módulo existe para evitar.
 *
 * Sigue siendo memoria del proceso, sin persistencia: un redeploy lo borra. Eso es aceptable
 * porque la pregunta que responde es «cuánto llevo hoy», no «cuánto gasté en marzo» — para lo
 * segundo está la facturación de OpenRouter, que es la fuente de verdad y no la vamos a duplicar.
 */

import { calculateCost, costFromUsd } from './pricing';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('cost-tracker');

export interface DailyTotal {
  /** YYYY-MM-DD en hora de Honduras. */
  date: string;
  usd: number;
  hnl: number;

  /** Llamadas al modelo de texto. Una generación de sitio son varias. */
  generations: number;
  tokensInput: number;
  tokensOutput: number;

  /** Imágenes generadas y lo que costaron, contadas aparte del texto. */
  images: number;
  imagesUsd: number;

  /**
   * Generaciones cuyo modelo no está en la tabla de precios.
   *
   * Se cuentan aparte para que el total pueda leerse con honestidad: si este número no es cero, el
   * costo mostrado es un piso, no el total.
   */
  unpricedGenerations: number;
}

const dailyTotals = new Map<string, DailyTotal>();

/**
 * Honduras está en UTC-6 todo el año: el país no aplica horario de verano desde 2006.
 *
 * Esto importaba de verdad. La versión anterior cortaba el día en UTC, así que el acumulado se
 * reseteaba a las 6:00 de la tarde en Tegucigalpa — en plena jornada. Un contador cuyo día no
 * coincide con el día de quien lo lee no se usa dos veces.
 */
const HONDURAS_UTC_OFFSET_HOURS = -6;

function hondurasDate(now: Date = new Date()): Date {
  return new Date(now.getTime() + HONDURAS_UTC_OFFSET_HOURS * 60 * 60 * 1000);
}

export function todayKey(now: Date = new Date()): string {
  return hondurasDate(now).toISOString().slice(0, 10);
}

export function monthKey(now: Date = new Date()): string {
  return hondurasDate(now).toISOString().slice(0, 7);
}

function getOrCreateToday(now?: Date): DailyTotal {
  const today = todayKey(now);
  let entry = dailyTotals.get(today);

  if (!entry) {
    entry = {
      date: today,
      usd: 0,
      hnl: 0,
      generations: 0,
      tokensInput: 0,
      tokensOutput: 0,
      images: 0,
      imagesUsd: 0,
      unpricedGenerations: 0,
    };
    dailyTotals.set(today, entry);
  }

  return entry;
}

/** Registra una llamada al modelo de texto y devuelve lo que costó. */
export function trackGeneration(
  model: string,
  inputTokens: number,
  outputTokens: number,
  options?: { silent?: boolean },
): { usd: number; hnl: number } {
  const { usd, hnl, unpriced } = calculateCost(model, inputTokens, outputTokens);
  const today = getOrCreateToday();

  today.usd += usd;
  today.hnl += hnl;
  today.generations += 1;
  today.tokensInput += inputTokens;
  today.tokensOutput += outputTokens;

  if (unpriced) {
    today.unpricedGenerations += 1;

    /*
     * Un warn y no un info: significa que el total del día quedó corto, y quien lea ese total
     * merece saber por qué antes de tomar una decisión de precios con él.
     */
    logger.warn(`Modelo sin precio en la tabla: "${model}". Su costo no está en el total del día.`);
  }

  if (!options?.silent) {
    logger.info(
      `💰 Generación #${today.generations} del ${today.date} — ${model}\n` +
        `   Tokens: ${inputTokens.toLocaleString()} in / ${outputTokens.toLocaleString()} out\n` +
        `   Costo: $${usd.toFixed(4)} (L ${hnl.toFixed(2)})\n` +
        `   Acumulado hoy: $${today.usd.toFixed(4)} (L ${today.hnl.toFixed(2)})`,
    );
  }

  return { usd, hnl };
}

/**
 * Registra una imagen generada, con el costo que el proveedor ya calculó.
 *
 * Se pasa el costo en vez de derivarlo de tokens porque la API de imágenes lo devuelve en
 * `usage.cost`, y ese número es el que va a la factura. Derivarlo de una tabla propia sería
 * inventar una segunda verdad al lado de la real.
 *
 * Sin esto, las seis fotos de cada sitio —unos L6, la quinta parte del costo— no aparecían en
 * ningún total.
 */
export function trackImage(model: string, usd: number): { usd: number; hnl: number } {
  const cost = costFromUsd(usd);
  const today = getOrCreateToday();

  today.usd += cost.usd;
  today.hnl += cost.hnl;
  today.images += 1;
  today.imagesUsd += cost.usd;

  logger.info(`🖼️  Imagen con ${model}: $${cost.usd.toFixed(4)} (L ${cost.hnl.toFixed(2)})`);

  return cost;
}

export function getTodayTotal(): DailyTotal {
  return { ...getOrCreateToday() };
}

/** Suma de todos los días del mes en curso que este proceso alcanzó a ver. */
export function getMonthTotal(): DailyTotal {
  const month = monthKey();

  const total: DailyTotal = {
    date: month,
    usd: 0,
    hnl: 0,
    generations: 0,
    tokensInput: 0,
    tokensOutput: 0,
    images: 0,
    imagesUsd: 0,
    unpricedGenerations: 0,
  };

  for (const entry of dailyTotals.values()) {
    if (!entry.date.startsWith(month)) {
      continue;
    }

    total.usd += entry.usd;
    total.hnl += entry.hnl;
    total.generations += entry.generations;
    total.tokensInput += entry.tokensInput;
    total.tokensOutput += entry.tokensOutput;
    total.images += entry.images;
    total.imagesUsd += entry.imagesUsd;
    total.unpricedGenerations += entry.unpricedGenerations;
  }

  return total;
}

/** Resumen del día en el log. Pensado para correrse desde un cron diario. */
export function logDailySummary(): void {
  const today = getOrCreateToday();
  logger.info(
    `📊 RESUMEN ${today.date}\n` +
      `   Generaciones: ${today.generations} · Imágenes: ${today.images}\n` +
      `   Tokens: ${today.tokensInput.toLocaleString()} in / ${today.tokensOutput.toLocaleString()} out\n` +
      `   Costo total: $${today.usd.toFixed(4)} (L ${today.hnl.toFixed(2)})`,
  );
}

/** Seam de tests. El runtime no lo llama. */
export function __resetCostTracker() {
  dailyTotals.clear();
}
