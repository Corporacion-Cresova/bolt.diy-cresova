import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { streamText } from '~/lib/.server/llm/stream-text';
import { cresovaBriefPrompt } from '~/lib/common/prompts/cresova-brief';
import { textStreamResponse } from '~/lib/.server/llm/text-stream-response';
import { detectRubro } from '~/lib/cresova/sector-detector';
import type { ProviderInfo } from '~/types/model';
import { getApiKeysFromCookie, getProviderSettingsFromCookie } from '~/lib/api/cookies';
import { createScopedLogger } from '~/utils/logger';

export async function action(args: ActionFunctionArgs) {
  return enhancerAction(args);
}

const logger = createScopedLogger('api.enhancher');

async function enhancerAction({ context, request }: ActionFunctionArgs) {
  const { message, model, provider } = await request.json<{
    message: string;
    model: string;
    provider: ProviderInfo;
    apiKeys?: Record<string, string>;
  }>();

  const { name: providerName } = provider;

  // validate 'model' and 'provider' fields
  if (!model || typeof model !== 'string') {
    throw new Response('Invalid or missing model', {
      status: 400,
      statusText: 'Bad Request',
    });
  }

  if (!providerName || typeof providerName !== 'string') {
    throw new Response('Invalid or missing provider', {
      status: 400,
      statusText: 'Bad Request',
    });
  }

  const cookieHeader = request.headers.get('Cookie');
  const apiKeys = getApiKeysFromCookie(cookieHeader);
  const providerSettings = getProviderSettingsFromCookie(cookieHeader);

  try {
    const result = await streamText({
      messages: [
        {
          role: 'user',
          content:
            `[Model: ${model}]\n\n[Provider: ${providerName}]\n\n` + cresovaBriefPrompt(message, detectRubro(message)),
        },
      ],
      env: context.cloudflare?.env as any,
      apiKeys,
      providerSettings,
      options: {
        /*
         * The whole instruction lives in the user turn, and this only guards the shape of the
         * answer. The brief lands straight in the prompt box, so a preamble like «Claro, acá está
         * el brief:» becomes the first line of the next build request.
         */
        system:
          'Sos el director de arte de Cresova. Devolvés únicamente el brief pedido, sin saludo, ' +
          'sin explicación y sin envolverlo en etiquetas ni en un bloque de código.',

        /*
         * onError: (event) => {
         *   throw new Response(null, {
         *     status: 500,
         *     statusText: 'Internal Server Error',
         *   });
         * }
         */
      },
    });

    // Handle streaming errors in a non-blocking way
    (async () => {
      try {
        for await (const part of result.fullStream) {
          if (part.type === 'error') {
            const error: any = part.error;
            logger.error('Streaming error:', error);
            break;
          }
        }
      } catch (error) {
        logger.error('Error processing stream:', error);
      }
    })();

    /*
     * El cuerpo va codificado a bytes. `result.textStream` encola strings, y un cuerpo de
     * `Response` no los acepta: workerd contestaba 200 con cero bytes y recién después tiraba
     * el error adentro del worker, así que el brief se generaba, se facturaba y nunca llegaba
     * a la caja de texto. Ver `text-stream-response.ts`.
     */
    return textStreamResponse(result.textStream, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: unknown) {
    console.log(error);

    if (error instanceof Error && error.message?.includes('API key')) {
      throw new Response('Invalid or missing API key', {
        status: 401,
        statusText: 'Unauthorized',
      });
    }

    /*
     * Con cuerpo, no `null`. El cliente lee el cuerpo para saber qué decirle a quien apretó el
     * botón; un 500 vacío lo dejaba sin texto y sin explicación.
     */
    throw new Response('No se pudo armar el brief. Revisá el modelo seleccionado y volvé a intentar.', {
      status: 500,
      statusText: 'Internal Server Error',
    });
  }
}
