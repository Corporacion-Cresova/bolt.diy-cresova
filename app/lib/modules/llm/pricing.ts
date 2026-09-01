/**
 * Pricing por modelo (USD por 1M tokens).
 *
 * Source: OpenRouter public pricing. Last verified 2026-09-01.
 * Update cuando cambien los precios. Si agregás un modelo nuevo, agregá su entrada acá.
 *
 * Por qué hardcoded y no dinámico: menos dependencias, sin flakiness de API, y
 * la tabla cambia 1-2 veces al año. PonyTail: stdlib > custom, datos que cambian
 * poco no merecen runtime fetch.
 */

export interface ModelPricing {
  inputPer1M: number; // USD por 1M tokens de input
  outputPer1M: number; // USD por 1M tokens de output
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Claude 4.5 Sonnet (diseño/taste) — caro pero vale para UI
  'anthropic/claude-4.5-sonnet': {
    inputPer1M: 3.0,
    outputPer1M: 15.0,
  },

  // DeepSeek V4 Pro (backend calidad) — default Cresova
  'deepseek/deepseek-v4-pro': {
    inputPer1M: 0.14,
    outputPer1M: 0.28,
  },

  // DeepSeek V4 Flash (backend rápido) — 10x más barato
  'deepseek/deepseek-v4-flash': {
    inputPer1M: 0.014,
    outputPer1M: 0.14,
  },
};

/**
 * Tasa de cambio USD -> HNL.
 * Actualizada manualmente. Para producción, considerar un fetch diario,
 * pero PonyTail: no agreguemos dependencias para algo que cambia semanalmente.
 */
export const USD_TO_HNL = 25.55;

/**
 * Calcula el costo en USD y HNL dado el modelo y los tokens consumidos.
 * Devuelve 0 si el modelo no está en la tabla (fail-safe).
 */
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): { usd: number; hnl: number } {
  const pricing = MODEL_PRICING[model];

  if (!pricing) {
    return { usd: 0, hnl: 0 };
  }

  const usd = (inputTokens / 1_000_000) * pricing.inputPer1M + (outputTokens / 1_000_000) * pricing.outputPer1M;

  return { usd, hnl: usd * USD_TO_HNL };
}
