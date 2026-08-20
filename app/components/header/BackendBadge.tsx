import { useStore } from '@nanostores/react';
import { executionBackendStore, runnerFailureStore } from '~/lib/cresova/execution-backend';

/**
 * Says where the project is running.
 *
 * The same build behaves quite differently on the VPS than in the browser tab, and when the runner
 * is unreachable the app quietly falls back — so it has to be visible which one is in use, without
 * opening the console.
 */
export function BackendBadge() {
  const backend = useStore(executionBackendStore);
  const runnerFailure = useStore(runnerFailureStore);

  if (backend === 'starting') {
    return null;
  }

  const onServer = backend === 'runner';
  const lost = backend === 'runner-lost';

  if (lost) {
    return (
      <span
        title="Se perdió la conexión con el VPS y se está reintentando. Los comandos esperan a que vuelva."
        className="hidden md:flex items-center gap-1.5 rounded-full border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 px-2.5 py-1 text-xs text-bolt-elements-textSecondary select-none"
      >
        <span className="i-ph:warning-circle-duotone text-sm text-amber-500" />
        <span className="font-medium text-bolt-elements-textPrimary">Reconectando</span>
      </span>
    );
  }

  return (
    <span
      title={
        onServer
          ? 'El proyecto se ejecuta en el VPS de Cresova. Cerrar la pestaña no lo detiene.'
          : runnerFailure
            ? `El proyecto se ejecuta en esta pestaña porque no se pudo usar el VPS: ${runnerFailure}`
            : 'El proyecto se ejecuta en esta pestaña. El VPS no está configurado.'
      }
      className="hidden md:flex items-center gap-1.5 rounded-full border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 px-2.5 py-1 text-xs text-bolt-elements-textSecondary select-none"
    >
      <span
        className={`text-sm ${onServer ? 'i-ph:hard-drives-duotone text-green-500' : 'i-ph:browser-duotone text-bolt-elements-textTertiary'}`}
      />
      <span className="font-medium text-bolt-elements-textPrimary">
        {onServer ? 'VPS' : runnerFailure ? 'Navegador · VPS falló' : 'Navegador'}
      </span>
    </span>
  );
}
