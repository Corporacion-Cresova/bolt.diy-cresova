import type { Message } from 'ai';
import { useCallback, useState } from 'react';
import { EnhancedStreamingMessageParser } from '~/lib/runtime/enhanced-message-parser';
import type { ActionCallbackData } from '~/lib/runtime/message-parser';
import { workbenchStore } from '~/lib/stores/workbench';
import { isDevServerCommand } from '~/lib/cresova/dev-server';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('useMessageParser');
const builderLogger = createScopedLogger('CresovaBuilder');

/**
 * Models frequently emit the dev server as a plain `shell` action. Shell actions block the
 * action queue until the process exits, which a server never does, so the rest of the artifact
 * (and the preview) never happens. Bolt already has a non blocking action type for servers,
 * so we normalise the action before it reaches the runner.
 */
function normalizeAction(data: ActionCallbackData): ActionCallbackData {
  if (data.action.type !== 'shell' || !isDevServerCommand(data.action.content)) {
    return data;
  }

  builderLogger.info(`Promoting shell dev server command to a start action: ${data.action.content}`);

  return { ...data, action: { type: 'start', content: data.action.content } };
}

const messageParser = new EnhancedStreamingMessageParser({
  callbacks: {
    onArtifactOpen: (data) => {
      logger.trace('onArtifactOpen', data);

      workbenchStore.showWorkbench.set(true);
      workbenchStore.addArtifact(data);
    },
    onArtifactClose: (data) => {
      logger.trace('onArtifactClose');

      workbenchStore.updateArtifact(data, { closed: true });
    },
    onActionOpen: (rawData) => {
      const data = normalizeAction(rawData);
      logger.trace('onActionOpen', data.action);

      /*
       * File actions are streamed, so we add them immediately to show progress
       * Shell actions are complete when created by enhanced parser, so we wait for close
       */
      if (data.action.type === 'file') {
        workbenchStore.addAction(data);
      }
    },
    onActionClose: (rawData) => {
      const data = normalizeAction(rawData);
      logger.trace('onActionClose', data.action);

      /*
       * Add non-file actions (shell, build, start, etc.) when they close
       * Enhanced parser creates complete shell actions, so they're ready to execute
       */
      if (data.action.type !== 'file') {
        workbenchStore.addAction(data);
      }

      workbenchStore.runAction(data);
    },
    onActionStream: (data) => {
      logger.trace('onActionStream', data.action);
      workbenchStore.runAction(data, true);
    },
  },
});
const extractTextContent = (message: Message) =>
  Array.isArray(message.content)
    ? (message.content.find((item) => item.type === 'text')?.text as string) || ''
    : message.content;

/**
 * Lo que cada mensaje agregó desde la última pasada, indexado por su posición.
 *
 * Está separado del hook y es puro para poder probarlo sin navegador, pero sobre todo porque el
 * problema que arregla es de forma, no de React: la versión anterior llamaba `setParsedMessages`
 * **una vez por mensaje**, dentro del bucle, y cada llamada copiaba el mapa entero con
 * `{ ...prevParsed }`.
 *
 * `parseMessages` corre con un debounce de 50 ms, o sea veinte veces por segundo mientras el
 * modelo escribe. Con N mensajes en la conversación eso son 20·N copias por segundo de un mapa de
 * N claves — trabajo cuadrático que crece con la conversación. Es por qué una generación larga se
 * va poniendo más lenta cuanto más avanza, justo cuando más importa que responda.
 *
 * Devuelve solo lo que cambió. Un mensaje que no produjo nada nuevo no entra, y si ninguno produjo
 * nada el hook no toca el estado y no hay re-render.
 */
export function collectParsedUpdates(
  messages: Message[],
  parse: (id: string, content: string) => string,
  reset: boolean,
): Record<number, string> {
  const updates: Record<number, string> = {};

  for (const [index, message] of messages.entries()) {
    if (message.role !== 'assistant' && message.role !== 'user') {
      continue;
    }

    let parsed = '';

    /*
     * El parser corre sobre lo que produjo el modelo, y un artifact malformado tiraba acá, subía
     * por el render y reemplazaba la app entera con una pantalla de error. Un mensaje roto se
     * puede perder; la sesión no.
     */
    try {
      parsed = parse(message.id, extractTextContent(message));
    } catch (error) {
      builderLogger.error('Failed to parse a message, skipping it', error);
    }

    /*
     * En un reset el valor reemplaza en vez de sumarse, así que un mensaje que parsea a vacío
     * también tiene que entrar: su entrada anterior hay que borrarla.
     */
    if (parsed || reset) {
      updates[index] = parsed;
    }
  }

  return updates;
}

export function useMessageParser() {
  const [parsedMessages, setParsedMessages] = useState<{ [key: number]: string }>({});

  const parseMessages = useCallback((messages: Message[], isLoading: boolean) => {
    let reset = false;

    if (import.meta.env.DEV && !isLoading) {
      reset = true;
      messageParser.reset();
    }

    const updates = collectParsedUpdates(messages, (id, content) => messageParser.parse(id, content), reset);

    if (Object.keys(updates).length === 0) {
      return;
    }

    // una sola copia del mapa por pasada, en vez de una por mensaje
    setParsedMessages((previous) => {
      const next = { ...previous };

      for (const [index, parsed] of Object.entries(updates)) {
        const position = Number(index);
        next[position] = reset ? parsed : (previous[position] || '') + parsed;
      }

      return next;
    });
  }, []);

  return { parsedMessages, parseMessages };
}
