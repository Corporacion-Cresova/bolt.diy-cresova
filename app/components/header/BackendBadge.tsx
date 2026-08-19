import { useStore } from '@nanostores/react';
import { executionBackendStore } from '~/lib/cresova/execution-backend';

/**
 * Says where the project is running.
 *
 * The same build behaves quite differently on the VPS than in the browser tab, and when the runner
 * is unreachable the app quietly falls back — so it has to be visible which one is in use, without
 * opening the console.
 */
export function BackendBadge() {
  const backend = useStore(executionBackendStore);

  if (backend === 'starting') {
    return null;
  }

  const onServer = backend === 'runner';

  return (
    <span
      title={
        onServer
          ? 'The project runs on the Cresova VPS. Closing the tab does not stop it.'
          : 'The project runs inside this browser tab. The runner was unreachable or is not configured.'
      }
      className="hidden md:flex items-center gap-1.5 rounded-full border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 px-2.5 py-1 text-xs text-bolt-elements-textSecondary select-none"
    >
      <span
        className={`text-sm ${onServer ? 'i-ph:hard-drives-duotone text-green-500' : 'i-ph:browser-duotone text-bolt-elements-textTertiary'}`}
      />
      <span className="font-medium text-bolt-elements-textPrimary">{onServer ? 'VPS' : 'Navegador'}</span>
    </span>
  );
}
