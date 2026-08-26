import { useStore } from '@nanostores/react';
import { classNames } from '~/utils/classNames';
import { memo, useEffect, useState } from 'react';
import { describeBuildProgress } from '~/lib/cresova/build-progress';
import { devServerErrorStore, serverTimeoutStore } from '~/lib/cresova/execution-backend';
import type { ActionState } from '~/lib/runtime/action-runner';
import { streamingState } from '~/lib/stores/streaming';
import { workbenchStore } from '~/lib/stores/workbench';

/**
 * What fills the preview panel before there is anything to frame.
 *
 * The panel used to say «No preview available» on a flat background for the whole of a build, which
 * is the one moment the user most wants to be told something is happening. A page taking shape says
 * it without claiming anything untrue: the bars are a placeholder, not a render of the real site.
 *
 * Deliberately CSS-only. This lives inside a view that stays mounted behind the other two
 * (`Workbench.client.tsx` slides them, it does not unmount them), so an animation here runs whether
 * or not anyone is looking at it. `requestAnimationFrame` would not even fire in a background tab,
 * and a `framer-motion` loop would keep the main thread busy for nothing; a CSS animation is paused
 * below when the panel is not on screen and costs nothing when it is.
 */

const BARS = [
  { width: '38%', delay: '0s' },
  { width: '72%', delay: '0.12s' },
  { width: '55%', delay: '0.24s' },
];

function useVisible(): boolean {
  const currentView = useStore(workbenchStore.currentView);
  const [documentVisible, setDocumentVisible] = useState(
    () => typeof document === 'undefined' || !document.hidden,
  );

  useEffect(() => {
    const onChange = () => setDocumentVisible(!document.hidden);

    document.addEventListener('visibilitychange', onChange);

    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  return currentView === 'preview' && documentVisible;
}

/*
 * Every action of every artifact, and re-rendered when any of them changes status.
 *
 * `useStore(workbenchStore.artifacts)` alone is not enough: each artifact keeps its actions in a
 * store of its own, so the outer map never changes when a file goes from running to complete —
 * exactly the transitions this panel exists to show. Hence the explicit subscription per artifact.
 * The updates are already sampled at 100 ms upstream (`actionStreamSampler`), so this does not
 * re-render per token.
 */
function useTurnActions(): ActionState[] {
  const artifacts = useStore(workbenchStore.artifacts);
  const [, bump] = useState(0);

  useEffect(() => {
    const unsubscribes = Object.values(artifacts).map((artifact) =>
      artifact.runner.actions.listen(() => bump((count) => count + 1)),
    );

    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [artifacts]);

  return Object.values(artifacts).flatMap((artifact) => Object.values(artifact.runner.actions.get()));
}

export const PreviewBuilding = memo(() => {
  const actions = useTurnActions();
  const streaming = useStore(streamingState);
  const previews = useStore(workbenchStore.previews);
  const serverTimeout = useStore(serverTimeoutStore);
  const devServerError = useStore(devServerErrorStore);
  const animate = useVisible();

  const progress = describeBuildProgress({
    actions,
    // this panel covers the whole project rather than one card, so the stream is the only turn there is
    turnOpen: streaming,
    hasPreview: previews.some((preview) => preview.ready),
    serverTimeout,
  });

  /*
   * Nothing has been asked for yet. Inventing a build in progress here would be the same lie the
   * old empty state told in reverse.
   */
  if (progress.stage === 'idle') {
    return (
      <div className="flex w-full h-full justify-center items-center bg-bolt-elements-background-depth-1 text-bolt-elements-textSecondary text-sm">
        Aquí aparecerá tu sitio en cuanto empieces a construirlo.
      </div>
    );
  }

  const trouble = ['failed', 'stalled', 'truncated'].includes(progress.stage);

  // nothing is moving once the turn is over, so neither should the skeleton
  const shimmer = animate && progress.busy ? 'cresova-shimmer' : '';

  return (
    <div className="flex w-full h-full flex-col items-center justify-center gap-8 bg-bolt-elements-background-depth-1 p-8">
      <div
        className="w-full max-w-[560px] rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-6 flex flex-col gap-5"
        aria-hidden="true"
      >
        {/* a header bar and a nav, the shape every one of these sites starts from */}
        <div className="flex items-center gap-3">
          <div className={classNames('h-6 w-6 rounded-md bg-bolt-elements-background-depth-3', shimmer)} />
          <div className={classNames('h-3 w-24 rounded bg-bolt-elements-background-depth-3', shimmer)} />
          <div className="flex-1" />
          <div className={classNames('h-3 w-10 rounded bg-bolt-elements-background-depth-3', shimmer)} />
          <div className={classNames('h-3 w-10 rounded bg-bolt-elements-background-depth-3', shimmer)} />
        </div>

        {/* the hero */}
        <div className="flex flex-col gap-2.5">
          {BARS.map((bar) => (
            <div
              key={bar.width}
              className={classNames('h-3.5 rounded bg-bolt-elements-background-depth-3', shimmer)}
              style={{ width: bar.width, animationDelay: bar.delay }}
            />
          ))}
        </div>

        {/* three cards */}
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className={classNames('h-20 rounded-lg bg-bolt-elements-background-depth-3', shimmer)}
              style={{ animationDelay: `${0.15 * index}s` }}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex items-center gap-2 text-bolt-elements-textPrimary text-sm font-medium">
          {progress.busy && (
            <div className="i-svg-spinners:90-ring-with-bg text-bolt-elements-loader-progress text-base" />
          )}
          {trouble && <div className="i-ph:warning-circle-duotone text-bolt-elements-icon-error text-base" />}
          <span>{progress.message}</span>
        </div>

        {progress.stage === 'failed' && (
          <span className="text-bolt-elements-textSecondary text-xs max-w-[420px]">
            {progress.failedPaths.join(', ')}
          </span>
        )}

        {progress.stage === 'stalled' && serverTimeout && (
          <span className="text-bolt-elements-textSecondary text-xs max-w-[420px]">{serverTimeout}</span>
        )}

        {devServerError && progress.stage !== 'failed' && (
          <span className="text-bolt-elements-textSecondary text-xs max-w-[420px]">{devServerError}</span>
        )}

        {/*
         * Publishing compiles the files on disk and serves the output; it never touches the dev
         * server or its port. A build that ended without a preview is therefore still a site that
         * can go online, and this is the moment that is worth knowing.
         */}
        {['written', 'stalled', 'truncated'].includes(progress.stage) && (
          <span className="text-bolt-elements-textSecondary text-xs max-w-[420px]">
            Los archivos están en el servidor: el sitio se puede publicar aunque la vista previa no
            haya arrancado.
          </span>
        )}
      </div>
    </div>
  );
});
