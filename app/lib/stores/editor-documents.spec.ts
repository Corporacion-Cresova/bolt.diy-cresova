import { describe, expect, it } from 'vitest';
import { EditorStore } from './editor';
import type { FileMap } from './files';

/**
 * setDocuments runs once per file write while a build streams. Rebuilding every document each time
 * is what locked the tab on a long generation, so what matters here is not just the resulting map
 * but that untouched files keep the object identity their subscribers already hold.
 */
function fileMap(entries: Record<string, string>): FileMap {
  return Object.fromEntries(
    Object.entries(entries).map(([path, content]) => [path, { type: 'file', content, isBinary: false }]),
  ) as FileMap;
}

const filesStoreStub = { files: { get: () => ({}) } } as never;

describe('EditorStore.setDocuments', () => {
  it('keeps the same object for a file that did not change', () => {
    const store = new EditorStore(filesStoreStub);
    store.setDocuments(fileMap({ 'a.tsx': 'uno', 'b.tsx': 'dos' }));

    const before = store.documents.get();

    store.setDocuments(fileMap({ 'a.tsx': 'uno', 'b.tsx': 'CAMBIADO' }));

    const after = store.documents.get();

    expect(after['a.tsx']).toBe(before['a.tsx']);
    expect(after['b.tsx']).not.toBe(before['b.tsx']);
    expect(after['b.tsx'].value).toBe('CAMBIADO');
  });

  it('does not touch the store when nothing changed', () => {
    const store = new EditorStore(filesStoreStub);
    store.setDocuments(fileMap({ 'a.tsx': 'uno' }));

    const before = store.documents.get();

    store.setDocuments(fileMap({ 'a.tsx': 'uno' }));

    expect(store.documents.get()).toBe(before);
  });

  it('drops a file that disappeared', () => {
    const store = new EditorStore(filesStoreStub);
    store.setDocuments(fileMap({ 'a.tsx': 'uno', 'b.tsx': 'dos' }));
    store.setDocuments(fileMap({ 'a.tsx': 'uno' }));

    expect(Object.keys(store.documents.get())).toEqual(['a.tsx']);
  });

  it('keeps the scroll position of a file it rewrites', () => {
    const store = new EditorStore(filesStoreStub);
    store.setDocuments(fileMap({ 'a.tsx': 'uno' }));
    store.updateScrollPosition('a.tsx', { top: 40, left: 0 });
    store.setDocuments(fileMap({ 'a.tsx': 'dos' }));

    expect(store.documents.get()['a.tsx'].scroll).toEqual({ top: 40, left: 0 });
  });
});
