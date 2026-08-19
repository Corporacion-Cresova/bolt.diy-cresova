import { json, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('CresovaRunner');

const TICKET_TTL_MS = 5 * 60 * 1000;

/**
 * Issues a short lived, project scoped ticket for the Cresova Runner.
 *
 * The browser needs something to open its WebSocket with, and whatever it holds is readable by
 * anyone who opens the app. Handing out the shared secret would therefore hand out the right to
 * run commands on the host, so the secret stays here and only signed tickets travel.
 *
 * Must produce byte identical signatures to runner/src/tickets.mjs, which verifies them with Node
 * crypto while this runs on WebCrypto.
 */
async function signTicket(secret: string, projectId: string, expiresAt: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${projectId}.${expiresAt}`));

  const base64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  const base64url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return `${expiresAt}.${base64url}`;
}

export async function loader({ context, request }: LoaderFunctionArgs) {
  const projectId = new URL(request.url).searchParams.get('projectId');

  if (!projectId || !/^[a-z0-9][a-z0-9-]{2,62}$/.test(projectId)) {
    return json({ error: 'A valid projectId is required' }, { status: 400 });
  }

  const env = context?.cloudflare?.env;
  const secret = env?.RUNNER_TOKEN || process.env.RUNNER_TOKEN;
  const runnerUrl = env?.RUNNER_URL || process.env.RUNNER_URL;

  if (!secret || !runnerUrl) {
    // server side execution simply stays off until both are configured
    return json({ enabled: false }, { status: 200 });
  }

  logger.info(`Issuing a runner ticket for ${projectId}`);

  return json({
    enabled: true,
    runnerUrl,
    ticket: await signTicket(secret, projectId, Date.now() + TICKET_TTL_MS),
  });
}
