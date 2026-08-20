import { WebContainer } from '@webcontainer/api';
import { WORK_DIR_NAME } from '~/utils/constants';
import { cleanStackTrace } from '~/utils/stacktrace';
import { connectToRunner, executionBackendStore, runnerFailureStore } from '~/lib/cresova/execution-backend';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('CresovaRunner');

interface WebContainerContext {
  loaded: boolean;

  /** Where the project actually runs. Everything downstream is written against the same shape. */
  backend: 'webcontainer' | 'runner';
}

export const webcontainerContext: WebContainerContext = import.meta.hot?.data.webcontainerContext ?? {
  loaded: false,
  backend: 'webcontainer',
};

if (import.meta.hot) {
  import.meta.hot.data.webcontainerContext = webcontainerContext;
}

export let webcontainer: Promise<WebContainer> = new Promise(() => {
  // noop for ssr
});

/**
 * Boots WebContainer: the project runs inside this browser tab.
 *
 * This is the fallback, and stays exactly as it was — nothing about the server side path is
 * allowed to change how it behaves.
 */
async function bootWebContainer(): Promise<WebContainer> {
  const instance = await WebContainer.boot({
    coep: 'credentialless',
    workdirName: WORK_DIR_NAME,
    forwardPreviewErrors: true, // Enable error forwarding from iframes
  });

  const { workbenchStore } = await import('~/lib/stores/workbench');

  const response = await fetch('/inspector-script.js');
  const inspectorScript = await response.text();
  await instance.setPreviewScript(inspectorScript);

  // Listen for preview errors
  instance.on('preview-message', (message) => {
    console.log('WebContainer preview message:', message);

    // Handle both uncaught exceptions and unhandled promise rejections
    if (message.type === 'PREVIEW_UNCAUGHT_EXCEPTION' || message.type === 'PREVIEW_UNHANDLED_REJECTION') {
      const isPromise = message.type === 'PREVIEW_UNHANDLED_REJECTION';
      const title = isPromise ? 'Unhandled Promise Rejection' : 'Uncaught Exception';
      workbenchStore.actionAlert.set({
        type: 'preview',
        title,
        description: 'message' in message ? message.message : 'Unknown error',
        content: `Error occurred at ${message.pathname}${message.search}${message.hash}\nPort: ${message.port}\n\nStack trace:\n${cleanStackTrace(message.stack || '')}`,
        source: 'preview',
      });
    }
  });

  return instance;
}

/**
 * Picks where the project runs.
 *
 * The runner is used when the server has one configured and it answers; otherwise the tab boots
 * WebContainer as before. The choice is made once, here, so every consumer keeps importing the
 * same promise and none of them needs to know which one it got.
 *
 * Once the runner is chosen it is kept for the session: a socket that drops later cannot be
 * swapped for a WebContainer that has none of the project's files.
 */
async function selectExecutionBackend(): Promise<WebContainer> {
  try {
    const remote = await connectToRunner();

    if (remote) {
      webcontainerContext.backend = 'runner';
      webcontainerContext.loaded = true;
      executionBackendStore.set('runner');

      return remote as unknown as WebContainer;
    }
  } catch (error) {
    const reason = (error as Error).message;
    logger.warn(`Could not reach the runner, falling back to WebContainer: ${reason}`);

    /*
     * Recorded rather than only logged: the fallback is silent by design, and silence is exactly
     * what makes someone believe the VPS is in use when it is not.
     */
    runnerFailureStore.set(reason);
  }

  const instance = await bootWebContainer();
  webcontainerContext.backend = 'webcontainer';
  webcontainerContext.loaded = true;
  executionBackendStore.set('webcontainer');

  return instance;
}

if (!import.meta.env.SSR) {
  webcontainer = import.meta.hot?.data.webcontainer ?? Promise.resolve().then(selectExecutionBackend);

  if (import.meta.hot) {
    import.meta.hot.data.webcontainer = webcontainer;
  }
}
