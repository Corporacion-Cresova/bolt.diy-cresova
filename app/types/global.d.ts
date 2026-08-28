interface Window {
  showDirectoryPicker(): Promise<FileSystemDirectoryHandle>;
  webkitSpeechRecognition: typeof SpeechRecognition;
  SpeechRecognition: typeof SpeechRecognition;
}

interface Performance {
  memory?: {
    jsHeapSizeLimit: number;
    totalJSHeapSize: number;
    usedJSHeapSize: number;
  };
}

/*
 * The Env interface is declared in multiple places because Cloudflare Workers
 * expects the global Env, while our own runtime injects a serverEnv object via
 * the streamText options. Both share the same shape because the same env vars
 * (PEXELS_API_KEY, OPENROUTER_API_KEY, REPLICATE_API_TOKEN, CRESOVA_*_ENABLED)
 * drive the same behaviours regardless of where the runtime runs.
 */
interface Env {
  PEXELS_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_IMAGES_KEY?: string;
  REPLICATE_API_TOKEN?: string;
  CRESOVA_FLUX_ENABLED?: string;
  CRESOVA_IMAGES_ENABLED?: string;
  GROQ_API_KEY?: string;
  TOGETHER_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
  GOOGLE_GENERATIVE_AI_API_KEY?: string;
  MISTRAL_API_KEY?: string;
  PERPLEXITY_API_KEY?: string;
  XAI_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;
  OPENAI_LIKE_API_KEY?: string;
}

