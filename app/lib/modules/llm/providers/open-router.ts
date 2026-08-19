import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

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

  staticModels: ModelInfo[] = [
    /*
     * ==========================================================
     * 1. DEEPSEEK V4 FLASH
     * Principal recomendado para uso diario.
     * Muy económico, rápido y fuerte en coding/agentes.
     * 1M tokens de contexto.
     * ==========================================================
     */
    {
      name: 'deepseek/deepseek-v4-flash',
      label: '⚡ DeepSeek V4 Flash — Recomendado / Económico',
      provider: 'OpenRouter',
      maxTokenAllowed: 1000000,
    },

    /*
     * ==========================================================
     * 2. QWEN3 CODER NEXT
     * Especializado específicamente en programación,
     * tool use y agentes de código.
     * 262K tokens de contexto.
     * ==========================================================
     */
    {
      name: 'qwen/qwen3-coder-next',
      label: '💻 Qwen3 Coder Next — Coding',
      provider: 'OpenRouter',
      maxTokenAllowed: 262144,
    },

    /*
     * ==========================================================
     * 3. QWEN 3.6 PLUS
     * Para proyectos complejos, frontend, razonamiento
     * y trabajo sobre repositorios grandes.
     * 1M tokens de contexto.
     * ==========================================================
     */
    {
      name: 'qwen/qwen3.6-plus',
      label: '🧠 Qwen3.6 Plus — Coding Premium',
      provider: 'OpenRouter',
      maxTokenAllowed: 1000000,
    },

    /*
     * ==========================================================
     * 4. DEEPSEEK V4 PRO
     * Modelo de máxima capacidad de DeepSeek.
     * Para tareas realmente difíciles y refactors grandes.
     * 1M tokens de contexto.
     * ==========================================================
     */
    {
      name: 'deepseek/deepseek-v4-pro',
      label: '🔥 DeepSeek V4 Pro — Máxima Calidad',
      provider: 'OpenRouter',
      maxTokenAllowed: 1000000,
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
