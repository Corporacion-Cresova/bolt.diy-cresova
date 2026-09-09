/**
 * Precio por modelo, en USD por millón de tokens.
 *
 * Cada entrada viene del catálogo público de OpenRouter (`/api/v1/models`), verificada el
 * 2026-09-09. La tabla anterior estaba escrita a ojo y se equivocaba en todo lo que tocaba:
 * DeepSeek V4 Pro figuraba a $0.14/$0.28 cuando cuesta $0.87/$1.74 — seis veces menos — y dos de
 * los cinco modelos del registro ni siquiera aparecían, así que sus generaciones se contabilizaban
 * en cero. Un contador que subestima seis veces es peor que no tener contador: con uno sabés que
 * no sabés.
 *
 * Sigue siendo una tabla y no un fetch en runtime: los precios se mueven una o dos veces al año y
 * una llamada de red por generación es un modo de fallo nuevo a cambio de nada. Lo que sí cambió es
 * que ahora hay un test que compara esta tabla contra el catálogo de OpenRouter, así que la deriva
 * se ve en CI en vez de descubrirse meses después en una decisión de precios.
 */

export interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  /*
   * El slug que usa nuestro registro es `anthropic/claude-4.5-sonnet`; el canónico de OpenRouter
   * es `anthropic/claude-sonnet-4.5`. El nuestro funciona —los logs muestran generaciones reales
   * con él— así que no lo tocamos, pero el precio se busca por el slug que realmente viaja en la
   * petición, que es el nuestro. Ambos apuntan al mismo modelo y al mismo precio.
   */
  'anthropic/claude-4.5-sonnet': { inputPer1M: 3.0, outputPer1M: 15.0 },
  'anthropic/claude-sonnet-4.5': { inputPer1M: 3.0, outputPer1M: 15.0 },

  'qwen/qwen3.8-flash': { inputPer1M: 0.15, outputPer1M: 0.47 },
  'tencent/hy4-preview': { inputPer1M: 0.834, outputPer1M: 2.501 },
  'deepseek/deepseek-v4-pro': { inputPer1M: 0.87, outputPer1M: 1.74 },
  'deepseek/deepseek-v4-flash': { inputPer1M: 0.0871, outputPer1M: 0.1742 },
};

/**
 * Tasa USD → HNL, actualizada a mano.
 *
 * No merece un fetch diario: se mueve poco, y una tasa vieja por un punto porcentual no cambia
 * ninguna decisión que Diego tome con estos números.
 */
export const USD_TO_HNL = 25.55;

export interface CostBreakdown {
  usd: number;
  hnl: number;

  /**
   * Verdadero cuando el modelo no está en la tabla y el costo devuelto es cero por ignorancia,
   * no porque la generación haya sido gratis.
   *
   * Existe porque el cero silencioso era el peligro real: dos modelos del registro no estaban en
   * la tabla, sus generaciones sumaban cero, y el total del día se veía igual de sano que si
   * estuvieran contadas. Quien lea el total tiene que poder distinguir «no gastaste» de «no sé».
   */
  unpriced: boolean;
}

/** Calcula el costo de una generación. Un modelo desconocido devuelve cero, pero lo declara. */
export function calculateCost(model: string, inputTokens: number, outputTokens: number): CostBreakdown {
  const pricing = MODEL_PRICING[model];

  if (!pricing) {
    return { usd: 0, hnl: 0, unpriced: true };
  }

  const usd = (inputTokens / 1_000_000) * pricing.inputPer1M + (outputTokens / 1_000_000) * pricing.outputPer1M;

  return { usd, hnl: usd * USD_TO_HNL, unpriced: false };
}

/** Convierte un costo que el proveedor ya calculó, como el que devuelve la API de imágenes. */
export function costFromUsd(usd: number): CostBreakdown {
  return { usd, hnl: usd * USD_TO_HNL, unpriced: false };
}
