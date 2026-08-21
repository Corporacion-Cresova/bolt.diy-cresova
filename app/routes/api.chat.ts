import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { createDataStream, generateId } from 'ai';
import { MAX_RESPONSE_SEGMENTS, type FileMap } from '~/lib/.server/llm/constants';
import { CONTINUE_PROMPT } from '~/lib/common/prompts/prompts';
import { streamText, type Messages, type StreamingOptions } from '~/lib/.server/llm/stream-text';
import type { IProviderSetting } from '~/types/model';
import { createScopedLogger } from '~/utils/logger';
import { getFilePaths, selectContext } from '~/lib/.server/llm/select-context';
import type { ContextAnnotation, ProgressAnnotation } from '~/types/context';
import { WORK_DIR } from '~/utils/constants';
import { createSummary } from '~/lib/.server/llm/create-summary';
import { extractPropertiesFromMessage } from '~/lib/.server/llm/utils';
import type { DesignScheme } from '~/types/design-scheme';
import { MCPService } from '~/lib/services/mcpService';
import { StreamRecoveryManager } from '~/lib/.server/llm/stream-recovery';

export async function action(args: ActionFunctionArgs) {
  return chatAction(args);
}

const logger = createScopedLogger('api.chat');

/** Absolute ceiling for one response, continuations included. */
const RESPONSE_HARD_LIMIT_MS = 600_000;

function noop() {
  // replaced as soon as the deferred below is constructed
}

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};

  const items = cookieHeader.split(';').map((cookie) => cookie.trim());

  items.forEach((item) => {
    const [name, ...rest] = item.split('=');

    if (name && rest) {
      const decodedName = decodeURIComponent(name.trim());
      const decodedValue = decodeURIComponent(rest.join('=').trim());
      cookies[decodedName] = decodedValue;
    }
  });

  return cookies;
}

async function chatAction({ context, request }: ActionFunctionArgs) {
  /*
   * Cresova Builder: a dead upstream used to hang the UI forever. The old handler only logged
   * "attempting recovery" without recovering anything, so the request never ended and the chat
   * stayed in "generating" until the user reloaded. Aborting turns that into a visible error.
   *
   * The budget applies per phase, not to the whole request: the clock is reset after each step
   * completes, because the summary and context calls are full LLM round trips of their own and
   * their combined time was aborting perfectly healthy requests.
   */
  const streamAbort = new AbortController();
  const streamRecovery = new StreamRecoveryManager({
    timeout: 180000,
    maxRetries: 1,
    onTimeout: () => {
      logger.warn('No activity for 180s, aborting the request');
      streamAbort.abort(new Error('The model stopped responding. No output was received for 3 minutes.'));
    },
  });

  const { messages, files, promptId, contextOptimization, supabase, chatMode, designScheme, maxLLMSteps } =
    await request.json<{
      messages: Messages;
      files: any;
      promptId?: string;
      contextOptimization: boolean;
      chatMode: 'discuss' | 'build';
      designScheme?: DesignScheme;
      supabase?: {
        isConnected: boolean;
        hasSelectedProject: boolean;
        credentials?: {
          anonKey?: string;
          supabaseUrl?: string;
        };
      };
      maxLLMSteps: number;
    }>();

  const cookieHeader = request.headers.get('Cookie');
  const apiKeys = JSON.parse(parseCookies(cookieHeader || '').apiKeys || '{}');
  const providerSettings: Record<string, IProviderSetting> = JSON.parse(
    parseCookies(cookieHeader || '').providers || '{}',
  );

  const cumulativeUsage = {
    completionTokens: 0,
    promptTokens: 0,
    totalTokens: 0,
  };
  const encoder: TextEncoder = new TextEncoder();
  let progressCounter: number = 1;

  try {
    const mcpService = MCPService.getInstance();
    const totalMessageContent = messages.reduce((acc, message) => acc + message.content, '');
    logger.debug(`Total message length: ${totalMessageContent.split(' ').length}, words`);

    let lastChunk: string | undefined = undefined;

    /*
     * Why a variable instead of a throw at the point of failure: every one of these failures
     * happens inside a detached loop reading `fullStream`, where a throw is an unhandled rejection
     * that reaches nobody. They used to be logged and then the response was closed as if the model
     * had finished, so a build that died mid-sentence looked to the user exactly like a build that
     * had chosen to stop — no error, no toast, nothing to act on. The failure is carried out to
     * where the response is assembled and thrown there, so it reaches onError and the browser.
     */
    let streamFailure: Error | undefined;

    const asError = (value: unknown): Error =>
      value instanceof Error ? value : new Error(typeof value === 'string' ? value : JSON.stringify(value));

    const dataStream = createDataStream({
      async execute(dataStream) {
        streamRecovery.startMonitoring();

        const filePaths = getFilePaths(files || {});
        let filteredFiles: FileMap | undefined = undefined;
        let summary: string | undefined = undefined;
        let messageSliceId = 0;

        const processedMessages = await mcpService.processToolInvocations(messages, dataStream);
        streamRecovery.updateActivity();

        if (processedMessages.length > 3) {
          messageSliceId = processedMessages.length - 3;
        }

        if (filePaths.length > 0 && contextOptimization) {
          logger.debug('Generating Chat Summary');
          dataStream.writeData({
            type: 'progress',
            label: 'summary',
            status: 'in-progress',
            order: progressCounter++,
            message: 'Analysing Request',
          } satisfies ProgressAnnotation);

          // Create a summary of the chat
          console.log(`Messages count: ${processedMessages.length}`);

          summary = await createSummary({
            messages: [...processedMessages],
            env: context.cloudflare?.env,
            apiKeys,
            providerSettings,
            promptId,
            contextOptimization,
            onFinish(resp) {
              if (resp.usage) {
                logger.debug('createSummary token usage', JSON.stringify(resp.usage));
                cumulativeUsage.completionTokens += resp.usage.completionTokens || 0;
                cumulativeUsage.promptTokens += resp.usage.promptTokens || 0;
                cumulativeUsage.totalTokens += resp.usage.totalTokens || 0;
              }
            },
          });
          dataStream.writeData({
            type: 'progress',
            label: 'summary',
            status: 'complete',
            order: progressCounter++,
            message: 'Analysis Complete',
          } satisfies ProgressAnnotation);

          dataStream.writeMessageAnnotation({
            type: 'chatSummary',
            summary,
            chatId: processedMessages.slice(-1)?.[0]?.id,
          } as ContextAnnotation);

          // the summary was a full LLM round trip of its own, the watchdog restarts from here
          streamRecovery.updateActivity();

          // Update context buffer
          logger.debug('Updating Context Buffer');
          dataStream.writeData({
            type: 'progress',
            label: 'context',
            status: 'in-progress',
            order: progressCounter++,
            message: 'Determining Files to Read',
          } satisfies ProgressAnnotation);

          // Select context files
          console.log(`Messages count: ${processedMessages.length}`);
          filteredFiles = await selectContext({
            messages: [...processedMessages],
            env: context.cloudflare?.env,
            apiKeys,
            files,
            providerSettings,
            promptId,
            contextOptimization,
            summary,
            onFinish(resp) {
              if (resp.usage) {
                logger.debug('selectContext token usage', JSON.stringify(resp.usage));
                cumulativeUsage.completionTokens += resp.usage.completionTokens || 0;
                cumulativeUsage.promptTokens += resp.usage.promptTokens || 0;
                cumulativeUsage.totalTokens += resp.usage.totalTokens || 0;
              }
            },
          });

          if (filteredFiles) {
            logger.debug(`files in context : ${JSON.stringify(Object.keys(filteredFiles))}`);
          }

          dataStream.writeMessageAnnotation({
            type: 'codeContext',
            files: Object.keys(filteredFiles).map((key) => {
              let path = key;

              if (path.startsWith(WORK_DIR)) {
                path = path.replace(WORK_DIR, '');
              }

              return path;
            }),
          } as ContextAnnotation);

          dataStream.writeData({
            type: 'progress',
            label: 'context',
            status: 'complete',
            order: progressCounter++,
            message: 'Code Files Selected',
          } satisfies ProgressAnnotation);

          // same for the context selection call
          streamRecovery.updateActivity();

          // logger.debug('Code Files Selected');
        }

        /*
         * A continued response is started from inside onFinish, which runs after execute() has
         * already returned. createDataStream closes the stream once execute resolves, so those
         * continuations were generated and paid for on the server but never reached the browser:
         * the answer simply stopped mid-file. execute now waits for the whole chain.
         */
        let segmentsUsed = 0;
        let markAllSegmentsDone: () => void = noop;
        const allSegmentsDone = new Promise<void>((resolve) => {
          markAllSegmentsDone = resolve;
        });

        const options: StreamingOptions = {
          supabaseConnection: supabase,
          abortSignal: streamAbort.signal,
          toolChoice: 'auto',
          tools: mcpService.toolsWithoutExecute,
          maxSteps: maxLLMSteps,
          onStepFinish: ({ toolCalls }) => {
            // add tool call annotations for frontend processing
            toolCalls.forEach((toolCall) => {
              mcpService.processToolCall(toolCall, dataStream);
            });
          },
          onFinish: async ({ text: content, finishReason, usage }) => {
            logger.debug('usage', JSON.stringify(usage));

            if (usage) {
              cumulativeUsage.completionTokens += usage.completionTokens || 0;
              cumulativeUsage.promptTokens += usage.promptTokens || 0;
              cumulativeUsage.totalTokens += usage.totalTokens || 0;
            }

            if (finishReason !== 'length') {
              dataStream.writeMessageAnnotation({
                type: 'usage',
                value: {
                  completionTokens: cumulativeUsage.completionTokens,
                  promptTokens: cumulativeUsage.promptTokens,
                  totalTokens: cumulativeUsage.totalTokens,
                },
              });
              dataStream.writeData({
                type: 'progress',
                label: 'response',
                status: 'complete',
                order: progressCounter++,
                message: 'Response Generated',
              } satisfies ProgressAnnotation);
              await new Promise((resolve) => setTimeout(resolve, 0));

              markAllSegmentsDone();

              return;
            }

            /*
             * This used to read stream.switches, which nothing ever increments, so the ceiling was
             * never enforced and every log line reported the same number of segments left.
             */
            segmentsUsed++;

            if (segmentsUsed >= MAX_RESPONSE_SEGMENTS) {
              logger.warn(`Stopping after ${segmentsUsed} segments: the response is still incomplete`);
              dataStream.writeData({
                type: 'progress',
                label: 'response',
                status: 'complete',
                order: progressCounter++,
                message: 'Response too long, stopped early',
              } satisfies ProgressAnnotation);
              markAllSegmentsDone();

              return;
            }

            logger.info(
              `Hit the completion limit: continuing (segment ${segmentsUsed + 1} of ${MAX_RESPONSE_SEGMENTS})`,
            );

            const lastUserMessage = processedMessages.filter((x) => x.role == 'user').slice(-1)[0];
            const { model, provider } = extractPropertiesFromMessage(lastUserMessage);
            processedMessages.push({ id: generateId(), role: 'assistant', content });
            processedMessages.push({
              id: generateId(),
              role: 'user',
              content: `[Model: ${model}]\n\n[Provider: ${provider}]\n\n${CONTINUE_PROMPT}`,
            });

            let result;

            try {
              result = await streamText({
                messages: [...processedMessages],
                env: context.cloudflare?.env,
                options,
                apiKeys,
                files,
                providerSettings,
                promptId,
                contextOptimization,
                contextFiles: filteredFiles,
                chatMode,
                designScheme,
                summary,
                messageSliceId,
              });
            } catch (error) {
              // never leave execute waiting on a chain that will not continue
              logger.error('Continuation failed', error);
              streamFailure = asError(error);
              markAllSegmentsDone();

              return;
            }

            result.mergeIntoDataStream(dataStream);

            (async () => {
              try {
                for await (const part of result.fullStream) {
                  if (part.type === 'error') {
                    logger.error(`${(part.error as Error) ?? 'stream error'}`);
                    streamFailure = asError(part.error ?? 'The model stopped mid-response');

                    return;
                  }
                }
              } finally {
                /*
                 * Whatever happens to this segment, execute() must stop waiting. An upstream error
                 * mid-stream skips onFinish, and without this the response never closed and the
                 * browser reported a network error with the build left paused.
                 */
                markAllSegmentsDone();
              }
            })();

            return;
          },
        };

        dataStream.writeData({
          type: 'progress',
          label: 'response',
          status: 'in-progress',
          order: progressCounter++,
          message: 'Generating Response',
        } satisfies ProgressAnnotation);

        const result = await streamText({
          messages: [...processedMessages],
          env: context.cloudflare?.env,
          options,
          apiKeys,
          files,
          providerSettings,
          promptId,
          contextOptimization,
          contextFiles: filteredFiles,
          chatMode,
          designScheme,
          summary,
          messageSliceId,
        });

        // the model is connected, the budget from here on covers time to first token
        streamRecovery.updateActivity();

        (async () => {
          for await (const part of result.fullStream) {
            streamRecovery.updateActivity();

            if (part.type === 'error') {
              const error: any = part.error;
              logger.error('Streaming error:', error);
              streamFailure = asError(error ?? 'The model stopped mid-response');
              streamRecovery.stop();

              // Enhanced error handling for common streaming issues
              if (error.message?.includes('Invalid JSON response')) {
                logger.error('Invalid JSON response detected - likely malformed API response');
              } else if (error.message?.includes('token')) {
                logger.error('Token-related error detected - possible token limit exceeded');
              }

              markAllSegmentsDone();

              return;
            }
          }
          streamRecovery.stop();

          /*
           * A stream that ends without onFinish, which happens when the upstream drops, must not
           * leave execute() waiting forever. Resolving twice is a no-op.
           */
          markAllSegmentsDone();
        })();
        result.mergeIntoDataStream(dataStream);

        streamAbort.signal.addEventListener('abort', () => markAllSegmentsDone());

        /*
         * Keep the data stream open until the last continuation has been merged into it, but never
         * indefinitely: a response that cannot close leaves the user looking at a paused build,
         * and a late segment is worth less than a request that always terminates.
         */
        let releaseTimer: ReturnType<typeof setTimeout> | undefined;

        await Promise.race([
          allSegmentsDone,
          new Promise<void>((resolve) => {
            releaseTimer = setTimeout(() => {
              logger.warn('Closing the response after 10 minutes without a clean finish');
              resolve();
            }, RESPONSE_HARD_LIMIT_MS);
          }),
        ]);

        clearTimeout(releaseTimer);

        /*
         * Thrown after the partial answer has been merged, so whatever the model did manage to say
         * stays on screen and the error arrives alongside it rather than replacing it.
         */
        if (streamFailure) {
          throw streamFailure;
        }
      },
      onError: (error: any) => {
        // Provide more specific error messages for common issues
        const errorMessage = error.message || 'Unknown error';

        if (errorMessage.includes('model') && errorMessage.includes('not found')) {
          return 'Custom error: Invalid model selected. Please check that the model name is correct and available.';
        }

        if (errorMessage.includes('Invalid JSON response')) {
          return 'Custom error: The AI service returned an invalid response. This may be due to an invalid model name, API rate limiting, or server issues. Try selecting a different model or check your API key.';
        }

        if (
          errorMessage.includes('API key') ||
          errorMessage.includes('unauthorized') ||
          errorMessage.includes('authentication')
        ) {
          return 'Custom error: Invalid or missing API key. Please check your API key configuration.';
        }

        if (errorMessage.includes('token') && errorMessage.includes('limit')) {
          return 'Custom error: Token limit exceeded. The conversation is too long for the selected model. Try using a model with larger context window or start a new conversation.';
        }

        if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
          return 'Custom error: API rate limit exceeded. Please wait a moment before trying again.';
        }

        if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
          return 'Custom error: Network error. Please check your internet connection and try again.';
        }

        return `Custom error: ${errorMessage}`;
      },
    }).pipeThrough(
      new TransformStream({
        transform: (chunk, controller) => {
          if (!lastChunk) {
            lastChunk = ' ';
          }

          if (typeof chunk === 'string') {
            if (chunk.startsWith('g') && !lastChunk.startsWith('g')) {
              controller.enqueue(encoder.encode(`0: "<div class=\\"__boltThought__\\">"\n`));
            }

            if (lastChunk.startsWith('g') && !chunk.startsWith('g')) {
              controller.enqueue(encoder.encode(`0: "</div>\\n"\n`));
            }
          }

          lastChunk = chunk;

          let transformedChunk = chunk;

          if (typeof chunk === 'string' && chunk.startsWith('g')) {
            let content = chunk.split(':').slice(1).join(':');

            if (content.endsWith('\n')) {
              content = content.slice(0, content.length - 1);
            }

            transformedChunk = `0:${content}\n`;
          }

          // Convert the string stream to a byte stream
          const str = typeof transformedChunk === 'string' ? transformedChunk : JSON.stringify(transformedChunk);
          controller.enqueue(encoder.encode(str));
        },
      }),
    );

    return new Response(dataStream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        Connection: 'keep-alive',
        'Cache-Control': 'no-cache',
        'Text-Encoding': 'chunked',
      },
    });
  } catch (error: any) {
    logger.error(error);

    const errorResponse = {
      error: true,
      message: error.message || 'An unexpected error occurred',
      statusCode: error.statusCode || 500,
      isRetryable: error.isRetryable !== false, // Default to retryable unless explicitly false
      provider: error.provider || 'unknown',
    };

    if (error.message?.includes('API key')) {
      return new Response(
        JSON.stringify({
          ...errorResponse,
          message: 'Invalid or missing API key',
          statusCode: 401,
          isRetryable: false,
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
          statusText: 'Unauthorized',
        },
      );
    }

    return new Response(JSON.stringify(errorResponse), {
      status: errorResponse.statusCode,
      headers: { 'Content-Type': 'application/json' },
      statusText: 'Error',
    });
  }
}
