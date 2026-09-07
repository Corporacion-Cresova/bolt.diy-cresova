import { atom, computed, map, type MapStore, type WritableAtom } from 'nanostores';
import type { EditorDocument, ScrollPosition } from '~/components/editor/codemirror/CodeMirrorEditor';
import type { FileMap, FilesStore } from './files';
import { createScopedLogger } from '~/utils/logger';

export type EditorDocuments = Record<string, EditorDocument>;

type SelectedFile = WritableAtom<string | undefined>;

const logger = createScopedLogger('EditorStore');

export class EditorStore {
  #filesStore: FilesStore;

  selectedFile: SelectedFile = import.meta.hot?.data.selectedFile ?? atom<string | undefined>();
  documents: MapStore<EditorDocuments> = import.meta.hot?.data.documents ?? map({});

  currentDocument = computed([this.documents, this.selectedFile], (documents, selectedFile) => {
    if (!selectedFile) {
      return undefined;
    }

    return documents[selectedFile];
  });

  constructor(filesStore: FilesStore) {
    this.#filesStore = filesStore;

    if (import.meta.hot) {
      import.meta.hot.data.documents = this.documents;
      import.meta.hot.data.selectedFile = this.selectedFile;
    }
  }

  /**
   * Mirrors the project's files into editor documents.
   *
   * This runs once per file write while a build streams, so it rebuilt a whole new document object
   * for every file in the project — the starter template included — ten times a second, and handed
   * every subscriber a map in which nothing was reference-equal to what it had before. That is what
   * made a long generation lock the tab. Now an unchanged file keeps the exact object it already
   * had, and a pass in which nothing changed does not touch the store at all.
   */
  setDocuments(files: FileMap) {
    const previousDocuments = this.documents.value;
    const nextDocuments: EditorDocuments = {};
    let changed = false;

    for (const [filePath, dirent] of Object.entries(files)) {
      if (dirent === undefined || dirent.type !== 'file') {
        continue;
      }

      const previousDocument = previousDocuments?.[filePath];

      if (
        previousDocument &&
        previousDocument.value === dirent.content &&
        previousDocument.isBinary === dirent.isBinary
      ) {
        nextDocuments[filePath] = previousDocument;
        continue;
      }

      changed = true;
      nextDocuments[filePath] = {
        value: dirent.content,
        filePath,
        isBinary: dirent.isBinary,
        scroll: previousDocument?.scroll,
      };
    }

    // a file that disappeared also has to reach the store
    if (!changed && Object.keys(nextDocuments).length === Object.keys(previousDocuments ?? {}).length) {
      return;
    }

    this.documents.set(nextDocuments);
  }

  setSelectedFile(filePath: string | undefined) {
    this.selectedFile.set(filePath);
  }

  updateScrollPosition(filePath: string, position: ScrollPosition) {
    const documents = this.documents.get();
    const documentState = documents[filePath];

    if (!documentState) {
      return;
    }

    this.documents.setKey(filePath, {
      ...documentState,
      scroll: position,
    });
  }

  updateFile(filePath: string, newContent: string) {
    const documents = this.documents.get();
    const documentState = documents[filePath];

    if (!documentState) {
      return;
    }

    // Check if the file is locked by getting the file from the filesStore
    const file = this.#filesStore.getFile(filePath);

    if (file?.isLocked) {
      logger.warn(`Attempted to update locked file: ${filePath}`);
      return;
    }

    /*
     * For scoped locks, we would need to implement diff checking here
     * to determine if the edit is modifying existing code or just adding new code
     * This is a more complex feature that would be implemented in a future update
     */

    const currentContent = documentState.value;
    const contentChanged = currentContent !== newContent;

    if (contentChanged) {
      this.documents.setKey(filePath, {
        ...documentState,
        value: newContent,
      });
    }
  }
}
