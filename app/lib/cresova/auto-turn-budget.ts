/**
 * A hard ceiling on the turns the builder asks itself for, and a record of who asked.
 *
 * Every automatic turn is a paid call to OpenRouter. The permanent rule is blunt about it — «máximo
 * 1 intento de recuperación automática; los bucles infinitos cuestan dinero» — and each mechanism
 * does bound itself: artifact recovery allows one attempt, the plan stops at `MAX_PHASES`. What
 * nobody did was count the **total**, and a loop got through anyway: twenty identical turns, each
 * one billed, none of them building anything.
 *
 * So the ceiling here does not depend on knowing which path is looping. That is the point. A budget
 * that only stops the mechanism you already understood would not have stopped this one.
 *
 * Two deliberate choices:
 *
 * - **Per chat, not per turn.** A per-turn budget is what every mechanism already has, and it is
 *   exactly what a loop defeats: each lap looks like a fresh, well-behaved turn.
 * - **It never blocks the human.** What runs out is the builder's licence to talk to itself. The
 *   user can always keep typing, which matters because the moment the budget trips is the moment
 *   something needs a person.
 *
 * No import of `workbenchStore`, for the reason spelled out in `action-failures.ts`: importing that
 * module opens the runner connection as a side effect, and a module that opens a socket cannot be
 * unit tested cheaply.
 */

/**
 * `MAX_PHASES` is 6 and artifact recovery allows 1, so a build that behaves needs at most 7. Eight
 * leaves a turn of slack and still catches a runaway within a couple of calls.
 */
export const MAX_AUTO_TURNS = 8;

export interface AutoTurn {
  /** why the builder asked for this one, e.g. `artifact-recovery` or `phase 3/5` */
  reason: string;
  at: number;
}

let spent: AutoTurn[] = [];

/**
 * Whether one more automatic turn may be requested, recording it when the answer is yes.
 *
 * Asking and spending are one call on purpose: two calls invite a caller that checks and then
 * forgets to record, which is the same bug this module exists to prevent.
 */
export function claimAutoTurn(reason: string): boolean {
  if (spent.length >= MAX_AUTO_TURNS) {
    return false;
  }

  spent.push({ reason, at: Date.now() });

  return true;
}

/** A new human message is the only thing that means a fresh intent, so it is the only thing that resets. */
export function resetAutoTurns(): void {
  spent = [];
}

export function autoTurnsSpent(): AutoTurn[] {
  return [...spent];
}

/** The alert shown when the budget runs out — the user has to know why the builder went quiet. */
export function budgetExhaustedAlert(): { title: string; description: string; content: string } {
  return {
    title: 'La construcción se detuvo sola',
    description: `El builder se pidió ${MAX_AUTO_TURNS} turnos seguidos a sí mismo sin terminar, así que se paró para no seguir gastando. Dime qué falta y seguimos.`,
    content: describeAutoTurns().join('\n'),
  };
}

/**
 * The list for the Diagnóstico report.
 *
 * The whole reason this exists: twenty identical laps went by and there was no way to tell which
 * mechanism had asked for them. Reading beats deducing — the same lesson that closed the preview
 * bug three builds running.
 */
export function describeAutoTurns(): string[] {
  if (spent.length === 0) {
    return ['TURNOS AUTOMÁTICOS', '  ninguno en esta petición'];
  }

  const first = spent[0].at;

  return [
    'TURNOS AUTOMÁTICOS',
    `  ${spent.length} de ${MAX_AUTO_TURNS} gastados${spent.length >= MAX_AUTO_TURNS ? ' — presupuesto agotado' : ''}`,
    ...spent.map((turn, index) => `    ${index + 1}. ${turn.reason} (+${Math.round((turn.at - first) / 1000)} s)`),
  ];
}
