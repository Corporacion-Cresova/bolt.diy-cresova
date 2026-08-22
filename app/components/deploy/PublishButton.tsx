import * as Dialog from '@radix-ui/react-dialog';
import { useState } from 'react';
import { useStore } from '@nanostores/react';
import { toast } from 'react-toastify';
import { classNames } from '~/utils/classNames';
import { executionBackendStore } from '~/lib/cresova/execution-backend';
import { workbenchStore } from '~/lib/stores/workbench';
import { webcontainer } from '~/lib/webcontainer';
import type { RemoteContainer } from '~/lib/cresova/remote-container';

/** The same shape the runner itself checks: `isValidPublishName`, minus the `cresova-` rule the user cannot hit by typing normally. */
function sanitizePublishName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

/**
 * Publishes the compiled project to a stable link on Cresova's own domain — `<name>.preview.
 * cresova.com` — rather than to Netlify or Vercel, which is what the existing Deploy button does.
 *
 * Only meaningful with a VPS project: there is no server to build and serve a static export from
 * in the browser tab, so this stays hidden until the runner backend is actually in use.
 */
export function PublishButton() {
  const backend = useStore(executionBackendStore);
  const files = useStore(workbenchStore.files);
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | undefined>(undefined);

  /*
   * Files, not a running preview, are what publishing needs: the build happens on the server, over
   * whatever is on disk. Gating this on the preview instead — as the header used to — meant that the
   * moment the dev server failed to come up, the button that could still have produced a working
   * site was the one thing taken away.
   */
  const hasProjectFiles = Object.values(files).some((dirent) => dirent?.type === 'file');

  if (backend !== 'runner' || !hasProjectFiles) {
    return null;
  }

  const sanitized = sanitizePublishName(name);
  const canPublish = sanitized.length >= 3 && !sanitized.startsWith('cresova-') && !isPublishing;

  const handlePublish = async () => {
    if (!canPublish) {
      return;
    }

    setIsPublishing(true);
    setPublishedUrl(undefined);

    try {
      const container = await webcontainer;
      const { url } = await (container as unknown as RemoteContainer).publish(sanitized);
      setPublishedUrl(url);
      toast.success('Sitio publicado');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo publicar el sitio');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);

        if (!open) {
          setPublishedUrl(undefined);
        }
      }}
    >
      <Dialog.Trigger asChild>
        <button
          className="rounded-md items-center justify-center px-3 py-1.5 text-xs bg-accent-500 text-white hover:text-bolt-elements-item-contentAccent hover:bg-bolt-elements-button-primary-backgroundHover outline-accent-500 flex gap-1.5"
          title="Publicar en el VPS de Cresova"
        >
          <span className="i-ph:globe-simple" />
          Publicar
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-[251]" />
        <Dialog.Content
          className={classNames(
            'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[252]',
            'w-full max-w-sm p-5 rounded-lg shadow-lg',
            'bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor',
          )}
        >
          <Dialog.Title className="text-sm font-medium text-bolt-elements-textPrimary mb-1">
            Publicar este sitio
          </Dialog.Title>
          <Dialog.Description className="text-xs text-bolt-elements-textSecondary mb-4">
            Se compila el proyecto y queda en un enlace estable. Publicar de nuevo con el mismo nombre reemplaza lo que
            había.
          </Dialog.Description>

          {publishedUrl ? (
            <div className="space-y-3">
              <a
                href={publishedUrl}
                target="_blank"
                rel="noreferrer"
                className="block text-sm text-accent-500 underline break-all"
              >
                {publishedUrl}
              </a>
              <button
                onClick={() => setIsOpen(false)}
                className="w-full px-3 py-1.5 text-xs rounded-md bg-bolt-elements-item-backgroundActive text-bolt-elements-textPrimary"
              >
                Cerrar
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center rounded-md border border-bolt-elements-borderColor overflow-hidden">
                <input
                  autoFocus
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      void handlePublish();
                    }
                  }}
                  placeholder="mi-sitio"
                  className="flex-1 min-w-0 px-3 py-1.5 text-sm bg-transparent text-bolt-elements-textPrimary outline-none"
                />
                <span className="px-2 text-xs text-bolt-elements-textTertiary whitespace-nowrap">
                  .preview.cresova.com
                </span>
              </div>
              <button
                onClick={() => void handlePublish()}
                disabled={!canPublish}
                className="w-full px-3 py-1.5 text-xs rounded-md bg-accent-500 text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPublishing ? 'Publicando…' : 'Publicar'}
              </button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
