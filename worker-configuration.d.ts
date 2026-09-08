interface Env {
  RUNNING_IN_DOCKER: Settings;
  DEFAULT_NUM_CTX: Settings;
  ANTHROPIC_API_KEY: string;
  OPENAI_API_KEY: string;
  GROQ_API_KEY: string;
  HuggingFace_API_KEY: string;
  OPEN_ROUTER_API_KEY: string;
  OLLAMA_API_BASE_URL: string;
  OPENAI_LIKE_API_KEY: string;
  OPENAI_LIKE_API_BASE_URL: string;
  OPENAI_LIKE_API_MODELS: string;
  TOGETHER_API_KEY: string;
  TOGETHER_API_BASE_URL: string;
  DEEPSEEK_API_KEY: string;
  LMSTUDIO_API_BASE_URL: string;
  GOOGLE_GENERATIVE_AI_API_KEY: string;
  MISTRAL_API_KEY: string;
  XAI_API_KEY: string;
  PERPLEXITY_API_KEY: string;
  AWS_BEDROCK_CONFIG: string;

  /** Optional. Enables the verified stock photo catalog for generated sites. */
  PEXELS_API_KEY: string;

  /**
   * Optional. Raises the output token ceiling for models that accept more than the provider
   * default. The default of 8192 is what forces long pages to be written in continuations.
   */
  MAX_COMPLETION_TOKENS: string;

  /** Optional. Secret shared with the Cresova Runner; signs the tickets the browser presents. */
  /*
   * Las dos de generación de imágenes.
   *
   * Estar declaradas en app/types/global.d.ts no alcanza: bindings.sh arma los --binding que
   * recibe wrangler leyendo los nombres de ESTE archivo, así que una variable que falte acá se
   * pone en EasyPanel, llega al contenedor, y aun así nunca aparece en context.cloudflare.env.
   * El fallback a process.env tampoco la rescata, porque en el runtime de workerd process.env no
   * se puebla desde el entorno del host. Falla en silencio: la función simplemente no corre.
   */
  CRESOVA_IMAGES_ENABLED: string;
  OPENROUTER_IMAGES_KEY: string;

  /**
   * Optional. Overrides the image model, e.g. google/gemini-3.1-flash-image.
   *
   * Unset means google/gemini-2.5-flash-image, about $0.039 an image. This exists because
   * choosing an image model is a judgement made by looking at what comes out, and it should not
   * need a deploy of new code.
   */
  OPENROUTER_IMAGES_MODEL: string;
  RUNNER_TOKEN: string;

  /** Optional. WebSocket address of the Cresova Runner, for example wss://runner.cresova.com */
  RUNNER_URL: string;
}
