import type { Message } from 'ai';

/**
 * Splits a large request into phases the model can actually finish.
 *
 * A single response has a hard output budget, and a request like "a premium agency site with
 * fifteen interactive sections" does not fit in it. Asking the user to break the work up defeats
 * the point of the product, so the model is asked to break it up instead: it writes a plan, builds
 * the first phase, and the workbench asks for the next one on its own.
 *
 * The whole thing is deliberately stateless. Progress is read back from the conversation rather
 * than stored anywhere, so a reload, a reconnection or a new tab all resume correctly.
 */
const PLAN_OPEN = '<cresovaPlan>';
const PLAN_CLOSE = '</cresovaPlan>';

/** Marks the messages this module sends, so its own advances can be counted later. */
export const PHASE_MARKER = '[Cresova · fase]';

/**
 * How many phases may run automatically.
 *
 * Every phase is one model call and therefore real money, so the ceiling is low and absolute: a
 * model that writes a twenty phase plan still stops here, and the user can always ask for more.
 */
export const MAX_PHASES = 6;

export interface BuildPlan {
  phases: string[];
}

/** Reads a plan out of the tag block the contract asks for. */
function parsePlanBlock(content: string): BuildPlan | undefined {
  const start = content.indexOf(PLAN_OPEN);
  const end = content.indexOf(PLAN_CLOSE);

  if (start === -1 || end === -1 || end < start) {
    return undefined;
  }

  const phases = content
    .slice(start + PLAN_OPEN.length, end)
    .split('\n')
    .map((line) => line.replace(/^\s*(?:FASE\s*)?\d+\s*[.:)-]?\s*/i, '').trim())
    .filter((line) => line.length > 0);

  return phases.length > 1 ? { phases: phases.slice(0, MAX_PHASES) } : undefined;
}

/** `FASE 2` written as a heading, with or without the markdown bold the models like to add. */
const PROSE_PHASE = /^[\s>*_-]*(?:\*\*|__)?\s*FASE\s*(\d+)\s*(?:\*\*|__)?\s*[:.)-]\s*(.+)$/gim;

/**
 * Reads a plan the model announced in prose instead of in the tag.
 *
 * Not every model follows a custom tag reliably — some write `**FASE 1**: navbar y hero` as a
 * heading and get on with it. Without this the phases read as decoration: the build stops after
 * the first one and nothing asks for the second, which looks exactly like the model giving up.
 *
 * Two separate phases are required, numbered from one and in order. A single `FASE 1` is a model
 * narrating what it is doing, not a plan, and acting on it would send a paid request for a phase
 * nobody described.
 */
function parseProsePlan(content: string): BuildPlan | undefined {
  const phases: string[] = [];

  for (const match of content.matchAll(PROSE_PHASE)) {
    const number = Number(match[1]);
    const description = match[2].replace(/\*\*/g, '').trim();

    // out of order, repeated or skipped: not a plan, whatever it is
    if (number !== phases.length + 1 || description.length === 0) {
      return undefined;
    }

    phases.push(description);
  }

  return phases.length > 1 ? { phases: phases.slice(0, MAX_PHASES) } : undefined;
}

/** Reads a plan out of one message, however the model chose to write it. */
export function parsePlan(content: string): BuildPlan | undefined {
  return parsePlanBlock(content) ?? parseProsePlan(content);
}

/** Strips the plan block entirely, for the places that only want the prose. */
export function stripPlan(content: string): string {
  const start = content.indexOf(PLAN_OPEN);
  const end = content.indexOf(PLAN_CLOSE);

  if (start === -1 || end === -1 || end < start) {
    return content;
  }

  return (content.slice(0, start) + content.slice(end + PLAN_CLOSE.length)).trim();
}

/**
 * Turns the plan block into something worth reading.
 *
 * Hiding it would be a loss: knowing the site arrives in four phases, and which one is being built,
 * is the difference between waiting and wondering whether it broke. Only the tags go.
 */
export function renderPlanForDisplay(content: string): string {
  // only the tag needs replacing; a plan written in prose already reads as prose
  const plan = parsePlanBlock(content);

  if (!plan) {
    return content;
  }

  const start = content.indexOf(PLAN_OPEN);
  const end = content.indexOf(PLAN_CLOSE) + PLAN_CLOSE.length;
  const list = plan.phases.map((phase, index) => `${index + 1}. ${phase}`).join('\n');

  return `${content.slice(0, start)}**Plan de construcción (${plan.phases.length} fases):**\n\n${list}\n${content.slice(end)}`;
}

/** The most recent plan in the conversation, if the model wrote one. */
export function findPlan(messages: Message[]): BuildPlan | undefined {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];

    if (message.role !== 'assistant') {
      continue;
    }

    const plan = parsePlan(message.content);

    if (plan) {
      return plan;
    }
  }

  return undefined;
}

/**
 * The phase to build next, or undefined when the plan is finished.
 *
 * Phase one is built in the same response that announces the plan, so the count of advances
 * already sent is what says where we are.
 */
export function nextPhase(messages: Message[]): { number: number; total: number; description: string } | undefined {
  const plan = findPlan(messages);

  if (!plan) {
    return undefined;
  }

  const advancesSent = messages.filter(
    (message) => message.role === 'user' && message.content.includes(PHASE_MARKER),
  ).length;

  // phase 1 came with the plan itself
  const number = advancesSent + 2;

  if (number > plan.phases.length || number > MAX_PHASES) {
    return undefined;
  }

  return { number, total: plan.phases.length, description: plan.phases[number - 1] };
}

/** The message that asks for the next phase. Written as the user would ask for it. */
export function phasePrompt(phase: { number: number; total: number; description: string }): string {
  return `${PHASE_MARKER} Continúa con la FASE ${phase.number} de ${phase.total}: ${phase.description}

Sigue el mismo plan y el mismo sistema de diseño ya establecido en el proyecto. No repitas los
archivos que ya existen salvo que tengas que modificarlos. No reinstales dependencias que ya estén
instaladas, y no vuelvas a arrancar el servidor si ya está corriendo.`;
}
