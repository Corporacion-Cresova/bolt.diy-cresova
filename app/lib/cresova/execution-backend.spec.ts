// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { claimProjectForChat, getProjectId } from './execution-backend';

/**
 * The bug this guards against: two unrelated chats in the same browser used to share one global
 * localStorage key, so opening a second site wrote its package.json and components straight into
 * the first one's VPS project directory. Reproduced here against a real runner in
 * `remote-container.spec.ts`; this file only pins down the id bookkeeping, which needs no runner.
 */

function goTo(path: string) {
  window.history.pushState({}, '', path);
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  goTo('/');
});

describe('getProjectId', () => {
  it('gives two different chats two different projects', () => {
    goTo('/chat/soltecsa-corporate-website');

    const soltecsa = getProjectId();

    goTo('/chat/tela-divers-ocean-experience');

    const telaDivers = getProjectId();

    expect(soltecsa).not.toBe(telaDivers);
  });

  it('gives the same chat the same project on a later visit', () => {
    goTo('/chat/soltecsa-corporate-website');

    const first = getProjectId();

    goTo('/'); // a different tab, or this one browsing away
    goTo('/chat/soltecsa-corporate-website'); // back to it later

    expect(getProjectId()).toBe(first);
  });

  it('gives a brand new, unsaved chat a project of its own', () => {
    goTo('/');
    expect(getProjectId()).toMatch(/^cresova-[0-9a-f]+$/);
  });

  it('keeps a draft chat off the shared project of another draft in a different tab', () => {
    /*
     * sessionStorage is per tab; localStorage is not. This is the one thing this test cannot
     * reproduce directly, so it only pins down that the draft slot is sessionStorage, not
     * localStorage, which is what actually gives each tab its own copy.
     */
    goTo('/');
    getProjectId();

    expect(localStorage.getItem('cresova.projectId.draft')).toBeNull();
    expect(sessionStorage.getItem('cresova.projectId.draft')).not.toBeNull();
  });
});

describe('claimProjectForChat', () => {
  it('moves the draft project into a permanent slot once the chat has an id', () => {
    goTo('/');

    const draftProject = getProjectId();

    goTo('/chat/soltecsa-corporate-website');
    claimProjectForChat();

    // a reload later, landing straight on the chat's URL with no draft left to fall back on
    sessionStorage.clear();
    expect(getProjectId()).toBe(draftProject);
  });

  it('does nothing when the URL still has no chat id to claim under', () => {
    goTo('/');

    const draftProject = getProjectId();

    claimProjectForChat();

    expect(sessionStorage.getItem('cresova.projectId.draft')).toBe(draftProject);
  });

  it('never overwrites a chat that already has a claimed project', () => {
    goTo('/chat/soltecsa-corporate-website');

    const established = getProjectId();

    /*
     * a second, unrelated draft appears later in the same tab (a stray call, a race) and must not
     * steal an already-published chat's project out from under it
     */
    goTo('/');
    getProjectId();
    goTo('/chat/soltecsa-corporate-website');
    claimProjectForChat();

    expect(getProjectId()).toBe(established);
  });
});
