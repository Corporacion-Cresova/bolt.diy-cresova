import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Access to the runner is granted with a short lived ticket rather than a shared token.
 *
 * The browser has to present something to open its WebSocket, and whatever it holds is readable by
 * anyone who opens the app. A raw token would therefore hand out the right to run commands on the
 * host. Instead the app server, which does hold the secret, signs a ticket scoped to one project
 * and valid for a few minutes.
 */
const TICKET_TTL_MS = 5 * 60 * 1000;

export function signTicket(secret, projectId, expiresAt) {
  const payload = `${projectId}.${expiresAt}`;
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');

  return `${expiresAt}.${signature}`;
}

export function createTicket(secret, projectId, now = Date.now()) {
  return signTicket(secret, projectId, now + TICKET_TTL_MS);
}

export function verifyTicket(secret, projectId, ticket, now = Date.now()) {
  if (typeof ticket !== 'string' || !ticket.includes('.')) {
    return false;
  }

  const separator = ticket.indexOf('.');
  const expiresAt = Number(ticket.slice(0, separator));

  if (!Number.isFinite(expiresAt) || expiresAt < now) {
    return false;
  }

  const expected = Buffer.from(signTicket(secret, projectId, expiresAt));
  const given = Buffer.from(ticket);

  return expected.length === given.length && timingSafeEqual(expected, given);
}
