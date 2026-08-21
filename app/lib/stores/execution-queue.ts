/**
 * Appends a task to a promise chain without letting a failure cancel what comes after it.
 *
 * The actions of a response run one after another through a single chain, which is what keeps a
 * file from being written after the command that reads it. The subtlety is that a plain
 * `chain.then(task)` also chains the *failure*: one rejected action leaves the chain rejected, and
 * every action appended afterwards is skipped without running, without logging, and without
 * anything on screen. A build that dies at its third file looks exactly like a model that stopped
 * writing — which is the most expensive kind of bug, because it points the investigation at the
 * model instead of at us.
 *
 * So a failure is reported and the chain is handed back healthy. Order is still guaranteed: the
 * next task starts only once this one has settled, one way or the other.
 */
export function queueTask(
  chain: Promise<void>,
  task: () => Promise<void>,
  onFailure: (error: unknown) => void,
): Promise<void> {
  return chain.then(task).catch(onFailure);
}
