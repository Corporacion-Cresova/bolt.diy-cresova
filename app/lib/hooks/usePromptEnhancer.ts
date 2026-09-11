import { useState } from 'react';
import { toast } from 'react-toastify';
import type { ProviderInfo } from '~/types/model';
import { BriefStreamError, readBriefStream } from '~/lib/cresova/brief-stream';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('usePromptEnhancement');

/**
 * Corre el redactor de briefs y deja el resultado en la caja de texto.
 *
 * Las dos entradas —la varita, que reescribe lo que ya escribiste, y el botón del negocio, que
 * parte de los datos del cliente— pasan por acá y por la misma ruta. Lo único que cambia es de
 * dónde sale el texto de entrada.
 *
 * La lectura del stream vive en `readBriefStream` porque ahí estaban los modos de falla, y ahí
 * están ahora las pruebas. Lo que queda acá es la regla de la caja: o termina con el brief, o
 * termina como estaba. Nunca vacía.
 */
export function usePromptEnhancer() {
  const [enhancingPrompt, setEnhancingPrompt] = useState(false);
  const [promptEnhanced, setPromptEnhanced] = useState(false);

  const resetEnhancer = () => {
    setEnhancingPrompt(false);
    setPromptEnhanced(false);
  };

  const enhancePrompt = async (
    input: string,
    setInput: (value: string) => void,
    model: string,
    provider: ProviderInfo,
    apiKeys?: Record<string, string>,
  ) => {
    setEnhancingPrompt(true);
    setPromptEnhanced(false);

    const originalInput = input;

    try {
      const response = await fetch('/api/enhancer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input, model, provider, ...(apiKeys ? { apiKeys } : {}) }),
      });

      await readBriefStream(response, setInput);

      setPromptEnhanced(true);
      toast.success('Brief listo — revisalo y ajustá lo que haga falta');
    } catch (error) {
      logger.error('No se pudo armar el brief', error);

      /*
       * Lo escrito vuelve. Antes la caja se vaciaba antes de pedir nada, así que una falla se
       * llevaba puesto el prompt del usuario además de no dejar brief.
       */
      setInput(originalInput);

      toast.error(
        error instanceof BriefStreamError
          ? `No se pudo armar el brief: ${error.message}`
          : 'No se pudo armar el brief.',
      );
    } finally {
      /*
       * Siempre. La versión anterior salía por un `if (reader)` cuando el cuerpo venía nulo —que es
       * lo que la ruta devolvía en su rama de error— y dejaba el spinner girando y los dos botones
       * deshabilitados hasta recargar la página.
       */
      setEnhancingPrompt(false);
    }
  };

  return { enhancingPrompt, promptEnhanced, enhancePrompt, resetEnhancer };
}
