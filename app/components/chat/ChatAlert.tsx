import { AnimatePresence, motion } from 'framer-motion';
import type { ActionAlert } from '~/types/actions';
import { classNames } from '~/utils/classNames';

interface Props {
  alert: ActionAlert;
  clearAlert: () => void;
  postMessage: (message: string) => void;
}

/**
 * How the "Ask Bolt" button hands an error to the model.
 *
 * The fence used to be tagged `sh` for a terminal error, which told the model the text WAS a shell
 * script. Handed a PostCSS failure it did the obedient thing and ran it:
 * `export CI=true FORCE_COLOR=0 && Pre-transform error: ...`, and the shell answered
 * `border-ink/10: not found`. So the one button meant to fix a broken build spent its turn
 * re-running the error message. It is output, and saying so is what points the model at the code
 * that produced it.
 */
function describeErrorForModel(isPreview: boolean, content: string): string {
  const source = isPreview ? 'el navegador' : 'el servidor de desarrollo';

  return (
    `Esto lo devolvió ${source}. Es SALIDA, no un comando ni código para ejecutar: ` +
    `arreglá el archivo del proyecto que lo provoca.\n` +
    '```text\n' +
    content +
    '\n```\n'
  );
}

export default function ChatAlert({ alert, clearAlert, postMessage }: Props) {
  const { description, content, source } = alert;

  const isPreview = source === 'preview';
  const title = isPreview ? 'Preview Error' : 'Terminal Error';
  const message = isPreview
    ? 'We encountered an error while running the preview. Would you like Bolt to analyze and help resolve this issue?'
    : 'We encountered an error while running terminal commands. Would you like Bolt to analyze and help resolve this issue?';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className={`rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-4 mb-2`}
      >
        <div className="flex items-start">
          {/* Icon */}
          <motion.div
            className="flex-shrink-0"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className={`i-ph:warning-duotone text-xl text-bolt-elements-button-danger-text`}></div>
          </motion.div>
          {/* Content */}
          <div className="ml-3 flex-1">
            <motion.h3
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className={`text-sm font-medium text-bolt-elements-textPrimary`}
            >
              {title}
            </motion.h3>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className={`mt-2 text-sm text-bolt-elements-textSecondary`}
            >
              <p>{message}</p>
              {description && (
                <div className="text-xs text-bolt-elements-textSecondary p-2 bg-bolt-elements-background-depth-3 rounded mt-4 mb-4">
                  Error: {description}
                </div>
              )}
            </motion.div>

            {/* Actions */}
            <motion.div
              className="mt-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className={classNames(' flex gap-2')}>
                <button
                  onClick={() => postMessage(describeErrorForModel(isPreview, content))}
                  className={classNames(
                    `px-2 py-1.5 rounded-md text-sm font-medium`,
                    'bg-bolt-elements-button-primary-background',
                    'hover:bg-bolt-elements-button-primary-backgroundHover',
                    'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-bolt-elements-button-danger-background',
                    'text-bolt-elements-button-primary-text',
                    'flex items-center gap-1.5',
                  )}
                >
                  <div className="i-ph:chat-circle-duotone"></div>
                  Ask Bolt
                </button>
                <button
                  onClick={clearAlert}
                  className={classNames(
                    `px-2 py-1.5 rounded-md text-sm font-medium`,
                    'bg-bolt-elements-button-secondary-background',
                    'hover:bg-bolt-elements-button-secondary-backgroundHover',
                    'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-bolt-elements-button-secondary-background',
                    'text-bolt-elements-button-secondary-text',
                  )}
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
