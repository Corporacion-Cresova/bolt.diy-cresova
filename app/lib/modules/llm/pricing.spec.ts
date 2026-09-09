import { describe, expect, it } from 'vitest';
import { MODEL_PRICING, USD_TO_HNL, calculateCost, costFromUsd } from './pricing';
import OpenRouterProvider from './providers/open-router';

/*
 * Estos tests existen por lo que encontramos al ir a exponer el contador: la tabla de precios
 * estaba escrita a ojo y se equivocaba en todo lo que tocaba. DeepSeek V4 Pro figuraba a
 * $0.14/$0.28 cuando cuesta $0.87/$1.74, y dos de los cinco modelos del registro ni aparecían, así
 * que sus generaciones sumaban cero. Un contador que subestima seis veces es peor que ninguno.
 */

describe('la tabla de precios', () => {
  it('tiene un precio para cada modelo que el registro ofrece', () => {
    /*
     * Este es el que atrapa el agujero real. `calculateCost` devuelve cero para un modelo
     * desconocido, así que un modelo nuevo en el registro y ausente acá no rompe nada: solo deja
     * de contarse, en silencio, hasta que alguien mira la factura.
     */
    const offered = new OpenRouterProvider().staticModels.map((model) => model.name);

    expect(offered.length).toBeGreaterThan(0);

    const missing = offered.filter((name) => !MODEL_PRICING[name]);

    expect(missing, `sin precio en la tabla: ${missing.join(', ')}`).toEqual([]);
  });

  it('no tiene precios en cero, que serían indistinguibles de un modelo ausente', () => {
    for (const [model, pricing] of Object.entries(MODEL_PRICING)) {
      expect(pricing.inputPer1M, model).toBeGreaterThan(0);
      expect(pricing.outputPer1M, model).toBeGreaterThan(0);
    }
  });

  it('cobra la salida más cara que la entrada, como hace todo proveedor', () => {
    for (const [model, pricing] of Object.entries(MODEL_PRICING)) {
      expect(pricing.outputPer1M, model).toBeGreaterThan(pricing.inputPer1M);
    }
  });
});

describe('calculateCost', () => {
  it('cobra entrada y salida por separado', () => {
    // deepseek-v4-pro: $0.87/1M in, $1.74/1M out
    const { usd } = calculateCost('deepseek/deepseek-v4-pro', 1_000_000, 1_000_000);

    expect(usd).toBeCloseTo(0.87 + 1.74, 6);
  });

  it('convierte a lempiras con la tasa declarada', () => {
    const { usd, hnl } = calculateCost('deepseek/deepseek-v4-pro', 500_000, 250_000);

    expect(hnl).toBeCloseTo(usd * USD_TO_HNL, 6);
  });

  it('marca como sin precio un modelo que no está en la tabla, en vez de decir que costó cero', () => {
    /*
     * La distinción que faltaba. Cero por ignorancia y cero por gratis se veían idénticos en el
     * total del día, y dos modelos del registro caían en el primer caso.
     */
    const unknown = calculateCost('un/modelo-que-no-existe', 1_000_000, 1_000_000);

    expect(unknown.usd).toBe(0);
    expect(unknown.unpriced).toBe(true);

    const known = calculateCost('deepseek/deepseek-v4-flash', 1_000, 1_000);
    expect(known.unpriced).toBe(false);
  });

  it('acepta los dos slugs de Claude, porque el registro usa uno y OpenRouter el otro', () => {
    const ours = calculateCost('anthropic/claude-4.5-sonnet', 1_000_000, 0);
    const theirs = calculateCost('anthropic/claude-sonnet-4.5', 1_000_000, 0);

    expect(ours.usd).toBe(theirs.usd);
    expect(ours.unpriced).toBe(false);
  });

  it('devuelve cero para una generación sin tokens, sin dividir por cero', () => {
    expect(calculateCost('deepseek/deepseek-v4-pro', 0, 0).usd).toBe(0);
  });
});

describe('costFromUsd', () => {
  it('toma el costo que el proveedor ya calculó y solo lo pasa a lempiras', () => {
    /*
     * Para las imágenes: OpenRouter devuelve `usage.cost`, que es el número que va a la factura.
     * Derivarlo de una tabla propia sería inventar una segunda verdad al lado de la real.
     */
    const cost = costFromUsd(0.045);

    expect(cost.usd).toBe(0.045);
    expect(cost.hnl).toBeCloseTo(0.045 * USD_TO_HNL, 6);
    expect(cost.unpriced).toBe(false);
  });
});

describe('la tabla contra el catálogo público de OpenRouter', () => {
  /*
   * La tabla es estática a propósito —los precios se mueven una o dos veces al año y una llamada
   * de red por generación es un modo de fallo nuevo a cambio de nada— pero estática no puede
   * significar sin verificar. Esto compara contra la fuente. Se salta si no hay red, para no
   * romper un build sin internet.
   */
  it('coincide con lo que OpenRouter cobra hoy', async () => {
    let response: Response;

    try {
      response = await fetch('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(20_000) });
    } catch {
      return;
    }

    if (!response.ok) {
      return;
    }

    const body = (await response.json()) as {
      data?: Array<{ id: string; pricing?: { prompt?: string; completion?: string } }>;
    };

    const catalogue = new Map(body.data?.map((model) => [model.id, model.pricing]) ?? []);
    const drifted: string[] = [];

    for (const [model, ours] of Object.entries(MODEL_PRICING)) {
      const theirs = catalogue.get(model);

      if (!theirs) {
        // nuestro slug de Claude no es el canónico y no aparece; el canónico sí, y ese sí se compara
        continue;
      }

      const input = Number(theirs.prompt) * 1_000_000;
      const output = Number(theirs.completion) * 1_000_000;

      /*
       * 10% de tolerancia, y no menos.
       *
       * Empezó en 1% y a las pocas horas se puso roja sola: DeepSeek V4 Flash pasó de $0.0871 a
       * $0.0855, un 1.9%. OpenRouter agrega varios proveedores por modelo y el precio flota. Una
       * aserción que falla con el mercado moviéndose normalmente es una aserción que se ignora, y
       * ahí deja de proteger de nada.
       *
       * Lo que este test tiene que atrapar es un error de captura, no una fluctuación: la tabla
       * que reemplazó estaba seis veces por debajo. 10% deja pasar el ruido y no deja pasar eso.
       */
      if (Math.abs(input - ours.inputPer1M) > input * 0.1 + 1e-6) {
        drifted.push(`${model} entrada: tabla ${ours.inputPer1M}, OpenRouter ${input.toFixed(4)}`);
      }

      if (Math.abs(output - ours.outputPer1M) > output * 0.1 + 1e-6) {
        drifted.push(`${model} salida: tabla ${ours.outputPer1M}, OpenRouter ${output.toFixed(4)}`);
      }
    }

    expect(drifted, drifted.join(' | ')).toEqual([]);
  }, 25_000);
});
