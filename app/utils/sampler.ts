/**
 * Creates a function that samples calls at regular intervals and captures trailing calls.
 * - Drops calls that occur between sampling intervals
 * - Takes one call per sampling interval if available
 * - Captures the last call if no call was made during the interval
 * - Runs any pending trailing call at once when the tab goes to the background
 *
 * @param fn The function to sample
 * @param sampleInterval How often to sample calls (in ms)
 * @returns The sampled function
 */
export function createSampler<T extends (...args: any[]) => any>(fn: T, sampleInterval: number): T {
  let lastArgs: Parameters<T> | null = null;
  let lastThis: any = null;
  let lastTime = 0;
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }

    lastTime = Date.now();

    if (lastArgs) {
      const args = lastArgs;
      lastArgs = null;
      fn.apply(lastThis, args);
    }
  };

  /*
   * The trailing call is a `setTimeout`, and a hidden tab is where `setTimeout` stops being a
   * promise about time: browsers clamp it to a second, then to once a minute after five minutes in
   * the background. This sampler sits under the message parser and the action stream, so a build
   * whose last burst of work is waiting on that timer stops for as long as nobody is looking — one
   * of the reasons a build appeared to need someone watching the tab.
   *
   * Handing the tab off is the last moment anything is guaranteed to run promptly, so the pending
   * call is made there rather than left to a timer that may not come back for a minute.
   */
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        flush();
      }
    });
  }

  // Create a function with the same type as the input function
  const sampled = function (this: any, ...args: Parameters<T>) {
    const now = Date.now();
    lastArgs = args;
    lastThis = this;

    // If we're within the sample interval, just store the args
    if (now - lastTime < sampleInterval) {
      // Set up trailing call if not already set
      if (!timeout) {
        timeout = setTimeout(flush, sampleInterval - (now - lastTime));
      }

      return;
    }

    // If we're outside the interval, execute immediately
    lastTime = now;
    lastArgs = null;
    fn.apply(this, args);
  } as T;

  return sampled;
}
