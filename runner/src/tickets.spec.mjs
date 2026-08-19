import { describe, expect, it } from 'vitest';
import { createTicket, signTicket, verifyTicket } from './tickets.mjs';

const SECRET = 'a-long-shared-secret';

describe('runner tickets', () => {
  it('accepts a ticket for the project it was issued for', () => {
    expect(verifyTicket(SECRET, 'demo', createTicket(SECRET, 'demo'))).toBe(true);
  });

  it('refuses a ticket issued for another project', () => {
    expect(verifyTicket(SECRET, 'otro', createTicket(SECRET, 'demo'))).toBe(false);
  });

  it('refuses a ticket signed with a different secret', () => {
    expect(verifyTicket(SECRET, 'demo', createTicket('otro-secreto', 'demo'))).toBe(false);
  });

  it('refuses an expired ticket', () => {
    const past = Date.now() - 1000;
    expect(verifyTicket(SECRET, 'demo', signTicket(SECRET, 'demo', past))).toBe(false);
  });

  it('refuses a ticket whose expiry was extended by hand', () => {
    const ticket = createTicket(SECRET, 'demo');
    const forged = `${Date.now() + 86_400_000}.${ticket.split('.')[1]}`;

    expect(verifyTicket(SECRET, 'demo', forged)).toBe(false);
  });

  it('refuses malformed input', () => {
    for (const value of ['', 'sin-punto', undefined, null, 12345]) {
      expect(verifyTicket(SECRET, 'demo', value)).toBe(false);
    }
  });
});
