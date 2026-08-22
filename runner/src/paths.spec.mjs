import { describe, expect, it } from 'vitest';
import { isValidProjectId, isValidPublishName, resolveInsideProject } from './paths.mjs';

const ROOT = '/data/projects/demo';

describe('resolveInsideProject', () => {
  it('resolves ordinary paths inside the project', () => {
    expect(resolveInsideProject(ROOT, 'src/App.tsx')).toBe('/data/projects/demo/src/App.tsx');
    expect(resolveInsideProject(ROOT, './package.json')).toBe('/data/projects/demo/package.json');
  });

  it('treats an absolute path as project relative rather than host absolute', () => {
    expect(resolveInsideProject(ROOT, '/etc/passwd')).toBe('/data/projects/demo/etc/passwd');
  });

  it('refuses to escape the project directory', () => {
    expect(() => resolveInsideProject(ROOT, '../../etc/passwd')).toThrow(/escapes/);
    expect(() => resolveInsideProject(ROOT, 'src/../../../secrets')).toThrow(/escapes/);
  });

  it('does not treat a sibling with a shared prefix as inside', () => {
    expect(() => resolveInsideProject(ROOT, '../demo-evil/file')).toThrow(/escapes/);
  });
});

describe('isValidProjectId', () => {
  it('accepts ids usable as a directory and a hostname label', () => {
    expect(isValidProjectId('abc123')).toBe(true);
    expect(isValidProjectId('proj-2026-08')).toBe(true);
  });

  it('rejects anything that could break out of either', () => {
    expect(isValidProjectId('../evil')).toBe(false);
    expect(isValidProjectId('Proj')).toBe(false);
    expect(isValidProjectId('ab')).toBe(false);
    expect(isValidProjectId('')).toBe(false);
  });
});

describe('isValidPublishName', () => {
  it('accepts an ordinary site name', () => {
    expect(isValidPublishName('soltecsa')).toBe(true);
    expect(isValidPublishName('tela-divers-2026')).toBe(true);
  });

  it('rejects the cresova- prefix, reserved for project ids', () => {
    expect(isValidPublishName('cresova-65852feb893920c2')).toBe(false);
    expect(isValidPublishName('cresova-anything')).toBe(false);
  });

  it('rejects the same shapes isValidProjectId does', () => {
    expect(isValidPublishName('../evil')).toBe(false);
    expect(isValidPublishName('Soltecsa')).toBe(false);
    expect(isValidPublishName('')).toBe(false);
  });
});
