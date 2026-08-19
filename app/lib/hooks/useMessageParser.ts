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

export function useMessageParser() {
  const [parsedMessages, setParsedMessages] = useState<{ [key: number]: string }>({});

  const parseMessages = useCallback((messages: Message[], isLoading: boolean) => {
    let reset = false;

    if (import.meta.env.DEV && !isLoading) {
      reset = true;
      messageParser.reset();
    }

    for (const [index, message] of messages.entries()) {
      if (message.role === 'assistant' || message.role === 'user') {
        let newParsedContent = '';

        /*
         * The parser runs on whatever the model produced, and a malformed artifact used to throw
         * here, bubble up through the render and replace the entire app with an error screen.
         * A broken message is worth losing; the session is not.
         */
        try {
          newParsedContent = messageParser.parse(message.id, extractTextContent(message));
        } catch (error) {
          builderLogger.error('Failed to parse a message, skipping it', error);
        }

        setParsedMessages((prevParsed) => ({
          ...prevParsed,
          [index]: !reset ? (prevParsed[index] || '') + newParsedContent : newParsedContent,
        }));
      }
    }
  }, []);

  return { parsedMessages, parseMessages };
}
