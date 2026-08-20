import { atom } from 'nanostores';
import { createScopedLogger } from '~/utils/logger';
import { RemoteContainer, RunnerConnection } from './remote-container';

export type ExecutionBackend = 'starting' | 'webcontainer' | 'runner';

/**
 * Where the project is running, for the header to show.
 *
 * Worth surfacing: the same build behaves very differently depending on whether it fell back to
 * the browser, and without this the only way to tell is to read the console.
 */
export const executionBackendStore = atom<ExecutionBackend>('starting');

const logger = createScopedLogger('CresovaRunner');

const PROJECT_ID_KEY = 'cresova.projectId';
const CONNECT_TIMEOUT_MS = 15_000;

/*
 * The ticket answers in milliseconds when the server is healthy. It is bounded anyway because this
 * call sits in front of booting WebContainer: if it ever hung, the workbench would have nothing to
 * run on and the whole session would freeze rather than simply falling back.
 */
const TICKET_TIMEOUT_MS = 5_000;

/**
 * Identifies this browser's workspace on the runner.
 *
 * Kept in localStorage so a reload lands back in the same directory instead of starting from an
 * empty one. The shape has to match what the runner and the ticket endpoint accept.
 */
export function getProjectId(): string {
  const existing = localStorage.getItem(PROJECT_ID_KEY);

  if (existing && /^[a-z0-9][a-z0-9-]{2,62}$/.test(existing)) {
    return existing;
  }

  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const projectId = `cresova-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
  localStorage.setItem(PROJECT_ID_KEY, projectId);

  return projectId;
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
export async function connectToRunner(): Promise<RemoteContainer | undefined> {
  const projectId = getProjectId();

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
    return undefined;
  }

  const payload = (await response.json()) as { enabled: boolean; runnerUrl?: string; ticket?: string };

  if (!payload.enabled || !payload.runnerUrl || !payload.ticket) {
    return undefined;
  }

  const connection = new RunnerConnection(toWebSocketUrl(payload.runnerUrl), payload.ticket, projectId);

  try {
    await withTimeout(connection.connect(), CONNECT_TIMEOUT_MS, 'The runner did not answer in time');
  } catch (error) {
    connection.close();
    throw error;
  }

  logger.info(`Running project ${projectId} on the Cresova Runner`);

  return new RemoteContainer(connection);
}
