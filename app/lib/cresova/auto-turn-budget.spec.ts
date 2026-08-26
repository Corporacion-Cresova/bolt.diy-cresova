import { beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_AUTO_TURNS,
  autoTurnsSpent,
  budgetExhaustedAlert,
  claimAutoTurn,
  describeAutoTurns,
  resetAutoTurns,
} from './auto-turn-budget';

describe('auto turn budget', () => {
  beforeEach(() => {
    resetAutoTurns();
  });

  it('lets a well-behaved build through', () => {
    // one recovery plus six phases is what the existing limits allow, and it must not trip
    const granted = ['artifact-recovery', ...Array.from({ length: 6 }, (_, i) => `phase ${i + 2}/7`)].filter((reason) =>
      claimAutoTurn(reason),
    );

    expect(granted).toHaveLength(7);
  });

  it('stops a runaway at the ceiling, whatever is asking', () => {
    /*
     * The loop that prompted this asked for the same thing twenty times. The budget does not care
     * which mechanism it is — that is the whole point, since the looping path was never identified.
     */
    const granted = Array.from({ length: 20 }, () => claimAutoTurn('whatever-is-looping')).filter(Boolean);

    expect(granted).toHaveLength(MAX_AUTO_TURNS);
    expect(claimAutoTurn('one more')).toBe(false);
  });

  it('only counts the turns it actually granted', () => {
    Array.from({ length: 20 }, () => claimAutoTurn('looping'));

    expect(autoTurnsSpent()).toHaveLength(MAX_AUTO_TURNS);
  });

  it('gives a new human message a fresh budget', () => {
    Array.from({ length: MAX_AUTO_TURNS }, () => claimAutoTurn('looping'));
    expect(claimAutoTurn('blocked')).toBe(false);

    resetAutoTurns();

    expect(claimAutoTurn('after the user said something')).toBe(true);
  });

  it('records who asked, which is what was missing when the loop happened', () => {
    claimAutoTurn('artifact-recovery');
    claimAutoTurn('phase 2/4');

    const report = describeAutoTurns().join('\n');

    expect(report).toContain('artifact-recovery');
    expect(report).toContain('phase 2/4');
    expect(report).toContain(`2 de ${MAX_AUTO_TURNS}`);
  });

  it('says so plainly when the budget is gone', () => {
    Array.from({ length: MAX_AUTO_TURNS }, () => claimAutoTurn('looping'));

    expect(describeAutoTurns().join('\n')).toContain('presupuesto agotado');
    expect(budgetExhaustedAlert().description).toContain(String(MAX_AUTO_TURNS));
  });

  it('has nothing to report before anything automatic happened', () => {
    expect(describeAutoTurns().join('\n')).toContain('ninguno');
  });
});
