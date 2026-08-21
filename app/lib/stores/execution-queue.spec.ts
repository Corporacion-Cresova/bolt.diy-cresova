import { describe, expect, it } from 'vitest';
import { queueTask } from './execution-queue';

describe('the action execution queue', () => {
  it('runs tasks in the order they were queued', async () => {
    const order: string[] = [];
    let chain = Promise.resolve();

    for (const name of ['uno', 'dos', 'tres']) {
      chain = queueTask(
        chain,
        async () => {
          await new Promise((resolve) => setTimeout(resolve, name === 'uno' ? 20 : 0));
          order.push(name);
        },
        () => {
          throw new Error('not reached');
        },
      );
    }

    await chain;
    expect(order).toEqual(['uno', 'dos', 'tres']);
  });

  /*
   * The one that matters: this is what made a build stop at its third file with nothing on screen
   * and nothing in the log, looking for all the world like the model had given up.
   */
  it('keeps running after a task fails, and says which one failed', async () => {
    const ran: string[] = [];
    const failures: unknown[] = [];
    let chain = Promise.resolve();

    chain = queueTask(
      chain,
      async () => void ran.push('antes'),
      (error) => failures.push(error),
    );
    chain = queueTask(
      chain,
      async () => {
        throw new Error('el disco dijo que no');
      },
      (error) => failures.push(error),
    );
    chain = queueTask(
      chain,
      async () => void ran.push('después'),
      (error) => failures.push(error),
    );

    await chain;

    expect(ran).toEqual(['antes', 'después']);
    expect(failures).toHaveLength(1);
    expect((failures[0] as Error).message).toBe('el disco dijo que no');
  });

  it('settles even when every task fails, so nothing waits on it forever', async () => {
    let chain = Promise.resolve();

    for (let i = 0; i < 3; i++) {
      chain = queueTask(
        chain,
        async () => {
          throw new Error(`fallo ${i}`);
        },
        () => {
          // reported elsewhere; this test only cares that the chain survives
        },
      );
    }

    await expect(chain).resolves.toBeUndefined();
  });
});
