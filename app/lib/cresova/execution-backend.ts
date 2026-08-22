import { atom } from 'nanostores';
import { createScopedLogger } from '~/utils/logger';
import { RemoteContainer, RunnerConnection } from './remote-container';

export type ExecutionBackend = 'starting' | 'webcontainer' | 'runner' | 'runner-lost';

/**
 * Where the project is running, for the header to show.
 *
 * Worth surfacing: the same build behaves very differently depending on whether it fell back to
 * the browser, and without this the only way to tell is to read the console.
 */
export const executionBackendStore = atom<ExecutionBackend>('starting');

/**
 * Why the runner was not used, when it was configured but did not work.
 *
 * Falling back silently is the right behaviour — a runner that is down should degrade the product,
 * not break it — but silence is what makes someone believe server side execution is on when it is
 * not. The badge shows this so the difference is visible without opening a console.
 */
export const runnerFailureStore = atom<string | undefined>(undefined);

const logger = createScopedLogger('CresovaRunner');

const PROJECT_ID_KEY = 'cresova.projectId';

/*
 * A chat with no id yet (nothing sent, or not saved) has no permanent slot to be stored under.
 * sessionStorage, not localStorage: it must not leak into a second tab that is drafting its own new
 * chat at the same time, and it must not survive to be mistaken for a real chat's project later.
 */
const DRAFT_PROJECT_KEY = 'cresova.projectId.draft';

const CONNECT_TIMEOUT_MS = 15_000;

/*
 * The ticket answers in milliseconds when the server is healthy. It is bounded anyway because this
 * call sits in front of booting WebContainer: if it ever hung, the workbench would have nothing to
 * run on and the whole session would freeze rather than simply falling back.
 */
const TICKET_TIMEOUT_MS = 5_000;

/** `/chat/<id>` → `<id>`. A brand new, unsaved chat has no id yet and this is undefined. */
function chatIdFromUrl(): string | undefined {
  return typeof window === 'undefined' ? undefined : window.location.pathname.match(/^\/chat\/([^/]+)/)?.[1];
}

function projectIdSlot(chatId: string | undefined): { store: Storage; key: string } {
  return chatId
    ? { store: localStorage, key: `${PROJECT_ID_KEY}:${chatId}` }
    : { store: sessionStorage, key: DRAFT_PROJECT_KEY };
}

/**
 * Identifies this browser's workspace on the runner.
 *
 * Scoped to the chat shown in the URL, one VPS project per chat: two unrelated chats in the same
 * browser used to share the single global key this used to be, so opening one would write its
 * package.json and components straight into the other's project directory. Kept in storage so a
 * reload lands back in the same directory instead of starting from an empty one. The shape has to
 * match what the runner and the ticket endpoint accept.
 */
export function getProjectId(): string {
  const { store, key } = projectIdSlot(chatIdFromUrl());
  const existing = store.getItem(key);

  if (existing && /^[a-z0-9][a-z0-9-]{2,62}$/.test(existing)) {
    return existing;
  }

  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const projectId = `cresova-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
  store.setItem(key, projectId);

  return projectId;
}

/**
 * Called once a brand-new chat's URL has settled on its permanent id, so the VPS project this tab
 * already connected to — picked before the chat had any id, and living in the draft slot — is
 * remembered under that id. Skipped without it: reopening this same chat later would find nothing
 * under its id, and silently start a second, empty project next to the one it actually built.
 *
 * Reads the id straight from the URL, the same way `getProjectId` does, rather than taking one as
 * an argument: this chat's id gets rewritten into the URL by more than one code path, and the only
 * value guaranteed to match what a future reload will see is whatever is live in the address bar
 * once this is called, not whichever of those paths ran most recently.
 */
export function claimProjectForChat(): void {
  const chatId = chatIdFromUrl();

  if (!chatId) {
    return;
  }

  const permanentKey = `${PROJECT_ID_KEY}:${chatId}`;

  if (localStorage.getItem(permanentKey)) {
    return;
  }

  const draft = sessionStorage.getItem(DRAFT_PROJECT_KEY);

  if (draft) {
    localStorage.setItem(permanentKey, draft);
    sessionStorage.removeItem(DRAFT_PROJECT_KEY);
  }
}

/** `https://runner.example.com` is configured for people; the browser needs the socket scheme. */
function toWebSocketUrl(runnerUrl: string): string {
  return runnerUrl.replace(/^http/, 'ws').replace(/\/+$/, '');
}

function withTimeout<T>(work: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([work, new Promise<T>((_resolve, reject) => setTimeout(() => reject(new Error(message)), ms))]);
}

/**
 * Connects to the Cresova Runner, or returns undefined so the caller keeps using WebContainer.
 *
 * Server side execution is off until RUNNER_URL and RUNNER_TOKEN are configured, and any failure
 * here — no runner, an expired ticket, a network that will not reach it — is answered the same
 * way: fall back rather than leave the workbench with nothing to run on.
 */
/** Asks the server for a ticket. Returns undefined when server side execution is not configured. */
async function requestTicket(projectId: string) {
  const giveUp = new AbortController();
  const ticketDeadline = setTimeout(() => giveUp.abort(), TICKET_TIMEOUT_MS);

  let response: Response;

  try {
    response = await fetch(`/api/runner-ticket?projectId=${encodeURIComponent(projectId)}`, {
      signal: giveUp.signal,
    });
  } finally {
    clearTimeout(ticketDeadline);
  }

  if (!response.ok) {
    logger.warn(`The ticket endpoint answered ${response.status}, staying on WebContainer`);
    runnerFailureStore.set(`El servidor no pudo emitir un ticket (HTTP ${response.status}).`);

    return undefined;
  }

  const payload = (await response.json()) as { enabled: boolean; runnerUrl?: string; ticket?: string };

  if (!payload.enabled || !payload.runnerUrl || !payload.ticket) {
    return undefined;
  }

  return { runnerUrl: payload.runnerUrl, ticket: payload.ticket };
}

/**
 * Connects to the Cresova Runner, or returns undefined so the caller keeps using WebContainer.
 *
 * Server side execution is off until RUNNER_URL and RUNNER_TOKEN are configured, and any failure
 * here — no runner, an expired ticket, a network that will not reach it — is answered the same
 * way: fall back rather than leave the workbench with nothing to run on.
 */
export async function connectToRunner(): Promise<RemoteContainer | undefined> {
  const projectId = getProjectId();
  const issued = await requestTicket(projectId);

  if (!issued) {
    return undefined;
  }

  /*
   * A function, not the ticket itself: tickets last five minutes, so reconnecting after the runner
   * restarts needs a fresh one rather than a replay of this one.
   */
  const connection = new RunnerConnection(
    toWebSocketUrl(issued.runnerUrl),
    async () => {
      const renewed = await requestTicket(projectId);

      if (!renewed) {
        throw new Error('The server no longer issues runner tickets');
      }

      return renewed.ticket;
    },
    projectId,
  );

  connection.onStateChange = (state) => {
    executionBackendStore.set(state === 'open' ? 'runner' : 'runner-lost');
  };

  /*
   * The runner gives up looking for a project's dev server eventually, and when it does this is the
   * only word of it that reaches the browser. Worth a line of its own: without it the workbench
   * simply waits out its own budget, and a server that never came up looks exactly like one that is
   * merely slow.
   */
  connection.on('server-timeout', (event) => {
    if (event.type === 'server-timeout') {
      logger.warn(`The runner stopped waiting for the dev server: ${event.reason}`);
    }
  });

  try {
    await withTimeout(connection.connect(), CONNECT_TIMEOUT_MS, 'The runner did not answer in time');
  } catch (error) {
    connection.close();
    throw error;
  }

  logger.info(`Running project ${projectId} on the Cresova Runner`);

  return new RemoteContainer(connection);
}
