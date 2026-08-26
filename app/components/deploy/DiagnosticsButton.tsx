import { useState } from 'react';
import { useStore } from '@nanostores/react';
import { toast } from 'react-toastify';
import { executionBackendStore, runnerFailureStore } from '~/lib/cresova/execution-backend';
import { workbenchStore } from '~/lib/stores/workbench';
import { webcontainer } from '~/lib/webcontainer';
import type { RemoteContainer, RunnerDiagnostics } from '~/lib/cresova/remote-container';
import { describeTabSuspension, watchTabSuspension } from '~/lib/cresova/tab-suspension';
import { describeBrowserErrors, watchBrowserErrors } from '~/lib/cresova/browser-errors';
import { checkPreviewEmbedding, describePreviewEmbedding, type PreviewEmbedding } from '~/lib/cresova/preview-embedding';
import { describeAutoTurns } from '~/lib/cresova/auto-turn-budget';
import versionInfo from '~/version.json';

/*
 * Started from here because this is the button that reads them, and because the header is on screen
 * from the moment a chat opens — the listeners have to be in place before the thing they are meant
 * to catch happens, which is the only moment there is anything to record.
 */
watchTabSuspension();
watchBrowserErrors();

/** Enough terminal history to see what a failed command said, without pasting a whole install. */
const TERMINAL_LINES = 40;

/**
 * The tail of the terminal, from the browser's own record.
 *
 * The runner reports the last output of the **last** command; this covers whatever ran before it,
 * which is where an install that failed says so. It is the one part of the inherited debug log that
 * actually fills up in an ordinary session, so it is worth reading here rather than leaving it
 * behind a second button that reports mostly empty arrays.
 */
async function terminalTail(): Promise<string[]> {
  try {
    const { getDebugLogger } = await import('~/utils/debugLogger');
    const entries = getDebugLogger().recentTerminalLogs(TERMINAL_LINES);

    if (entries.length === 0) {
      return [];
    }

    return ['', `TERMINAL (últimas ${entries.length} líneas)`, ...entries.map((entry) => `  ${entry.content}`)];
  } catch {
    // the report is worth more without this section than not at all
    return [];
  }
}

const NOT_REPORTED = 'sin dato';

function sí(value: boolean | undefined): string {
  return value ? 'sí' : 'no';
}

/**
 * A report meant to be pasted into a conversation.
 *
 * Written as prose rather than dumped as JSON on purpose: the point is that whoever reads it can
 * tell in one pass which of the two failures happened, and those two are told apart by readings
 * that only mean something next to each other — a live process with no open port is a command that
 * never got going, an open port that never answered is one that started and wedged.
 */
function describe(
  diagnostics: RunnerDiagnostics | undefined,
  runnerError: string | undefined,
  terminal: string[],
  embedding: PreviewEmbedding | undefined,
): string {
  const backend = executionBackendStore.get();
  const previews = workbenchStore.previews.get();
  const files = Object.values(workbenchStore.files.get()).filter((dirent) => dirent?.type === 'file').length;

  const lines = [
    'Cresova Builder — diagnóstico',
    `versión ${versionInfo.version} build ${versionInfo.build}`,
    `momento: ${new Date().toISOString()}`,
    `dirección: ${typeof window === 'undefined' ? NOT_REPORTED : window.location.pathname}`,
    '',
    'NAVEGADOR',
    `  ejecución: ${backend}`,
    `  archivos en el proyecto: ${files}`,
    `  vistas previas: ${previews.length}`,
    ...previews.map((preview) => `    ${preview.baseUrl} (lista: ${sí(preview.ready)})`),
  ];

  if (runnerError) {
    lines.push(`  el VPS falló: ${runnerError}`);
  }

  if (embedding) {
    lines.push('', ...describePreviewEmbedding(embedding));
  }

  /*
   * Who asked for each turn the builder gave itself. The loop that made this necessary ran twenty
   * identical laps, every one of them billed, and there was no way to tell which mechanism was
   * asking — the same «measure it instead of deducing it» that closed the preview bug.
   */
  lines.push('', ...describeAutoTurns());

  lines.push('', ...describeBrowserErrors());
  lines.push('', ...describeTabSuspension());

  lines.push('', 'RUNNER');

  if (!diagnostics) {
    lines.push('  no respondió; el proyecto no corre en el VPS o la conexión está caída');

    return [...lines, ...terminal].join('\n');
  }

  lines.push(
    `  proyecto: ${diagnostics.projectId}`,
    `  procesos vivos: ${diagnostics.liveProcesses}`,
    `  puertos escuchando: ${diagnostics.listeningPorts.join(', ') || 'ninguno'}`,
    `  direcciones escuchando: ${diagnostics.listeningSockets?.join(', ') || 'ninguna'}`,
    `  puerto asignado: ${diagnostics.assignedPort}`,
    `  sirviendo en: ${
      diagnostics.servingPort ? `${diagnostics.servingHost ?? '127.0.0.1'}:${diagnostics.servingPort}` : 'nada todavía'
    }`,
    `  servidor anunciado: ${sí(diagnostics.ready)}`,
    `  sigue buscándolo: ${sí(diagnostics.stillWatching)}`,
    `  último sondeo: ${diagnostics.lastProbe ?? NOT_REPORTED}`,
    `  último comando: ${diagnostics.lastCommand ?? 'ninguno'}`,
    `  inactivo desde hace: ${Math.round(diagnostics.idleForMs / 1000)} s`,
    `  sitios publicados: ${diagnostics.publishedNames.join(', ') || 'ninguno'}`,
  );

  /*
   * Last, and only when there is any: it is the longest thing here and the only part that is not a
   * single reading. A server that binds its port and then never answers says what it is stuck on in
   * its own output, and nothing else in this report can say it.
   */
  if (diagnostics.lastOutput?.trim()) {
    lines.push(
      '',
      '  últimas líneas del comando:',
      ...diagnostics.lastOutput
        .trimEnd()
        .split('\n')
        .map((line) => `    ${line}`),
    );
  }

  return [...lines, ...terminal].join('\n');
}

/**
 * Collects, in one click, the readings that were otherwise gathered by hand over hours: what the
 * browser believes and what the runner sees, side by side and taken at the same moment.
 *
 * Deliberately not hidden behind a working preview the way the buttons beside it are — the moment
 * it is worth pressing is precisely the moment there is no preview.
 */
export function DiagnosticsButton() {
  const backend = useStore(executionBackendStore);
  const runnerError = useStore(runnerFailureStore);
  const [isCollecting, setIsCollecting] = useState(false);

  const collect = async () => {
    setIsCollecting(true);

    let diagnostics: RunnerDiagnostics | undefined;

    try {
      if (backend === 'runner') {
        const container = await webcontainer;
        diagnostics = await (container as unknown as RemoteContainer).diagnostics();
      }
    } catch {
      // a runner that cannot answer is itself part of the report, not a reason to have none
    }

    /*
     * The preview the workbench believes in, asked directly. A reading of what the browser gets
     * beats any amount of reasoning about what the runner sends — the two are separated by a
     * gateway that could be changing either.
     */
    const preview = workbenchStore.previews.get().find((candidate) => candidate.ready) ?? workbenchStore.previews.get()[0];
    const embedding = preview ? await checkPreviewEmbedding(preview.baseUrl) : undefined;

    const report = describe(diagnostics, runnerError, await terminalTail(), embedding);

    try {
      await navigator.clipboard.writeText(report);
      toast.success('Diagnóstico copiado: pégalo en el chat con Claude');
    } catch {
      // clipboard refused (no permission, insecure context): a file still gets the report out
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([report], { type: 'text/plain' }));
      link.download = `cresova-diagnostico-${Date.now()}.txt`;
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success('Diagnóstico descargado');
    }

    setIsCollecting(false);
  };

  return (
    <button
      onClick={() => void collect()}
      disabled={isCollecting}
      className="rounded-md items-center justify-center px-3 py-1.5 text-xs bg-bolt-elements-item-backgroundActive text-bolt-elements-textPrimary hover:bg-bolt-elements-button-primary-backgroundHover disabled:opacity-60 flex gap-1.5"
      title="Copia lo que ve el navegador y lo que ve el runner, para pegarlo en el chat"
    >
      <span className="i-ph:stethoscope" />
      {isCollecting ? 'Recogiendo…' : 'Diagnóstico'}
    </button>
  );
}
