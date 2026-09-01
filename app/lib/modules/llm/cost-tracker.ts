/**
 * Cost tracker — Acumula el costo de generaciones en memoria del proceso.
 *
 * Scope: in-process Map. Se resetea en cada restart del servidor.
 * Para persistencia cross-restart, ver TODO al final.
 *
 * Por qué existe: Villalta quiere saber cuánto le cuesta cada generación
 * y cuánto va acumulado por día/mes, para tomar decisiones de pricing
 * y modelo. No lo mostramos al usuario final (es info interna).
 */

import { calculateCost } from './pricing';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('cost-tracker');

interface DailyTotal {
  date: string; // YYYY-MM-DD
  usd: number;
  hnl: number;
  generations: number;
  tokensInput: number;
  tokensOutput: number;
}

const dailyTotals = new Map<string, DailyTotal>();

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function getOrCreateToday(): DailyTotal {
  const today = getTodayKey();
  let entry = dailyTotals.get(today);

  if (!entry) {
    entry = {
      date: today,
      usd: 0,
      hnl: 0,
      generations: 0,
      tokensInput: 0,
      tokensOutput: 0,
    };
    dailyTotals.set(today, entry);
  }

  return entry;
}

/**
 * Registra una generación completada. Loguea el costo al servidor
 * para que Villalta lo vea en los logs de EasyPanel.
 */
export function trackGeneration(
  model: string,
  inputTokens: number,
  outputTokens: number,
  options?: { silent?: boolean },
): { usd: number; hnl: number } {
  const { usd, hnl } = calculateCost(model, inputTokens, outputTokens);
  const today = getOrCreateToday();

  today.usd += usd;
  today.hnl += hnl;
  today.generations += 1;
  today.tokensInput += inputTokens;
  today.tokensOutput += outputTokens;

  if (!options?.silent) {
    logger.info(
      `💰 [${new Date().toISOString()}] Generacion #${today.generations} del ${today.date}\n` +
        `   Modelo: ${model}\n` +
        `   Tokens: ${inputTokens.toLocaleString()} in / ${outputTokens.toLocaleString()} out\n` +
        `   Costo: $${usd.toFixed(4)} (L ${hnl.toFixed(2)})\n` +
        `   Acumulado hoy: $${today.usd.toFixed(4)} (L ${today.hnl.toFixed(2)})`,
    );
  }

  return { usd, hnl };
}

/**
 * Devuelve el total del día actual. Para mostrar en un dashboard futuro.
 */
export function getTodayTotal(): DailyTotal {
  return { ...getOrCreateToday() };
}

/**
 * Devuelve el total del mes actual (suma de todos los días desde el día 1).
 */
export function getMonthTotal(): DailyTotal {
  const now = new Date();
  const yearMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

  let total: DailyTotal = {
    date: yearMonth,
    usd: 0,
    hnl: 0,
    generations: 0,
    tokensInput: 0,
    tokensOutput: 0,
  };

  for (const entry of dailyTotals.values()) {
    if (entry.date.startsWith(yearMonth)) {
      total.usd += entry.usd;
      total.hnl += entry.hnl;
      total.generations += entry.generations;
      total.tokensInput += entry.tokensInput;
      total.tokensOutput += entry.tokensOutput;
    }
  }

  return total;
}

/**
 * Log del resumen del día. Útil para correr desde un cron diario.
 */
export function logDailySummary(): void {
  const today = getOrCreateToday();
  logger.info(
    `📊 RESUMEN ${today.date}\n` +
      `   Generaciones: ${today.generations}\n` +
      `   Tokens: ${today.tokensInput.toLocaleString()} in / ${today.tokensOutput.toLocaleString()} out\n` +
      `   Costo total: $${today.usd.toFixed(4)} (L ${today.hnl.toFixed(2)})`,
  );
}

// ponytail: in-memory only. Persistencia cross-restart = future work
// (Redis o DB), pero eso es infra nueva que no se justifica todavía.
