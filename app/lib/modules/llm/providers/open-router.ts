import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

const COMPLETION_TOKENS = 64000;

export default class OpenRouterProvider extends BaseProvider {
  name = 'OpenRouter';
  getApiKeyLink = 'https://openrouter.ai/settings/keys';

  config = {
    apiTokenKey: 'OPEN_ROUTER_API_KEY',
  };

  /*
   * ============================================================
   * CRESOVA - MODELOS SELECCIONADOS PARA PROGRAMACIÓN
   * ============================================================
   *
   * Hemos deshabilitado deliberadamente el catálogo dinámico
   * de OpenRouter para mostrar únicamente modelos seleccionados.
   *
   * Esto evita tener cientos de modelos innecesarios en Bolt
   * y nos permite controlar exactamente qué modelos utilizamos.
   */

  /*
   * Why every model here declares `maxCompletionTokens`.
   *
   * Without it the resolution in `stream-text.ts` falls through to
   * `PROVIDER_COMPLETION_LIMITS.OpenRouter`, a constant inherited from bolt.diy that reads **8192**
   * — written when OpenRouter mostly served models with that ceiling, and nothing to do with these
   * four. Checked against OpenRouter's own model API, their real output limits are 384.000
   * (both DeepSeek V4), 235.929 (Qwen3 Coder Next) and 65.536 (Qwen3.6 Plus).
   *
   * So the ceiling that produced every truncated file, every duplicated artifact and every
   * `App.tsx` importing a component that was never written was **ours**, not theirs. The continuity
   * doc called it «la causa raíz de casi todos los fallos de generación» and attributed it to the
   * models. It was a default nobody had looked at again.
   *
   * 64.000 and not each model's maximum: it fits under the lowest of the four (Qwen3.6 Plus), so one
   * number covers them all with no special cases, and it leaves a deliberate ceiling. Raising the
   * limit costs nothing by itself — only generated tokens are billed, and far fewer continuations
   * means far fewer full prompt re-sends — but a runaway generation is more expensive in one call
   * than it used to be. `maxTokenAllowed` below is the **context** window; this is the output.
   */
  staticModels: ModelInfo[] = [
    /*
     * ==========================================================
     * 1. QWEN 3.8 27B — DISEÑO FRONTEND
     * Modelo denso sin razonamiento forzado. Buena calidad de código.
     * Sin el overhead de "thinking" que vacía los tokens de output.
     * ==========================================================
     */
    {
      name: 'qwen/qwen3.8-27b',
      label: '🔥 Qwen 3.8 27B — Diseño Frontend',
      provider: 'OpenRouter',
      maxTokenAllowed: 131072,
      maxCompletionTokens: COMPLETION_TOKENS,
    },

    /*
     * ==========================================================
     * 2. CLAUDE 4.5 SONNET — DISEÑO & TASTE
     * Respaldo premium para diseño visual.
     * ==========================================================
     */
    {
      name: 'anthropic/claude-4.5-sonnet',
      label: '🎨 Claude 4.5 Sonnet — Diseño & Taste',
      provider: 'OpenRouter',
      maxTokenAllowed: 200000,
      maxCompletionTokens: 64000,
    },

    /*
     * ==========================================================
     * 3. TENCENT HY4 — CALIDAD/PRECIO
     * Ranking #6 Frontend, 1M contexto, diseñado para coding agents.
     * ==========================================================
     */
    {
      name: 'tencent/hy4-preview',
      label: '💎 Tencent Hy4 — Calidad/Precio',
      provider: 'OpenRouter',
      maxTokenAllowed: 1000000,
      maxCompletionTokens: COMPLETION_TOKENS,
    },

    /*
     * ==========================================================
     * 4. DEEPSEEK V4 PRO — BACKEND / CALIDAD
     * Default Cresova. 1M tokens de contexto.
     * ==========================================================
     */
    {
      name: 'deepseek/deepseek-v4-pro',
      label: '🚀 DeepSeek V4 Pro — Backend (calidad)',
      provider: 'OpenRouter',
      maxTokenAllowed: 1000000,
      maxCompletionTokens: COMPLETION_TOKENS,
    },

    /*
     * ==========================================================
     * 3. DEEPSEEK V4 FLASH — BACKEND / RÁPIDO
     * Iteraciones rápidas, fixes chicos, chat diario.
     * 10x más barato que Pro. 1M tokens de contexto.
     * ==========================================================
     */
    {
      name: 'deepseek/deepseek-v4-flash',
      label: '⚡ DeepSeek V4 Flash — Backend (rápido)',
      provider: 'OpenRouter',
      maxTokenAllowed: 1000000,
      maxCompletionTokens: COMPLETION_TOKENS,
    },
  ];

  getModelInstance(options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    const { model, serverEnv, apiKeys, providerSettings } = options;

    const { apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'OPEN_ROUTER_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const openRouter = createOpenRouter({
      apiKey,
    });

    return openRouter.chat(model) as LanguageModelV1;
  }
}
