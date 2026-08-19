import { describe, expect, it } from 'vitest';
import { signTicket, verifyTicket } from './tickets.mjs';

/**
 * The app signs tickets with WebCrypto under workerd and the runner verifies them with Node
 * crypto. If the two disagree by a single byte nothing connects, so the app's exact signing
 * routine is reproduced here and checked against the verifier.
 */
async function signLikeTheApp(secret, projectId, expiresAt) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${projectId}.${expiresAt}`));
  const base64 = btoa(String.fromCharCode(...new Uint8Array(signature)));

  return `${expiresAt}.${base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
}

const SECRET = 'a-shared-secret-of-at-least-32-characters';

describe('tickets across runtimes', () => {
  it('produces the same signature under WebCrypto and Node crypto', async () => {
    const expiresAt = 1_800_000_000_000;

    expect(await signLikeTheApp(SECRET, 'demo', expiresAt)).toBe(signTicket(SECRET, 'demo', expiresAt));
  });

  it('verifies a ticket the app issued', async () => {
    const ticket = await signLikeTheApp(SECRET, 'demo', Date.now() + 60_000);

    expect(verifyTicket(SECRET, 'demo', ticket)).toBe(true);
  });

  it('still rejects an app issued ticket used for another project', async () => {
    const ticket = await signLikeTheApp(SECRET, 'demo', Date.now() + 60_000);

    expect(verifyTicket(SECRET, 'otro', ticket)).toBe(false);
  });
});
