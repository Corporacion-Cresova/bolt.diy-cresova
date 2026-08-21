import { describe, expect, it } from 'vitest';
import type { Message } from 'ai';
import { MAX_PHASES, findPlan, nextPhase, parsePlan, phasePrompt, renderPlanForDisplay, stripPlan } from './build-plan';

const PLAN = `<cresovaPlan>
FASE 1: Base y sistema de diseño, navbar y footer
FASE 2: Hero con fondo interactivo y marquee
FASE 3: Portafolio y showcase de dispositivos
</cresovaPlan>`;

function assistant(content: string): Message {
  return { id: 'a', role: 'assistant', content } as Message;
}

function user(content: string): Message {
  return { id: 'u', role: 'user', content } as Message;
}

describe('parsePlan', () => {
  it('reads the phases and drops the numbering', () => {
    expect(parsePlan(PLAN)?.phases).toEqual([
      'Base y sistema de diseño, navbar y footer',
      'Hero con fondo interactivo y marquee',
      'Portafolio y showcase de dispositivos',
    ]);
  });

  it('ignores a message with no plan', () => {
    expect(parsePlan('Aquí tienes tu web, ya está lista.')).toBeUndefined();
  });

  /* One phase is not a plan, it is the whole job: phasing it would only cost an extra call. */
  it('ignores a plan with a single phase', () => {
    expect(parsePlan('<cresovaPlan>\nFASE 1: Todo\n</cresovaPlan>')).toBeUndefined();
  });

  it('never returns more phases than the ceiling allows', () => {
    const long = `<cresovaPlan>\n${Array.from({ length: 20 }, (_, i) => `FASE ${i + 1}: Parte ${i + 1}`).join('\n')}\n</cresovaPlan>`;
    expect(parsePlan(long)?.phases.length).toBe(MAX_PHASES);
  });
});

describe('stripPlan', () => {
  it('removes the block so the answer reads normally', () => {
    expect(stripPlan(`Voy a construirlo por partes.\n${PLAN}\nEmpiezo por la base.`)).toBe(
      'Voy a construirlo por partes.\n\nEmpiezo por la base.',
    );
  });
});

describe('nextPhase', () => {
  it('asks for phase 2 right after the plan, because phase 1 came with it', () => {
    expect(nextPhase([user('una web para mi agencia'), assistant(PLAN)])).toMatchObject({
      number: 2,
      total: 3,
      description: 'Hero con fondo interactivo y marquee',
    });
  });

  it('advances as its own messages accumulate', () => {
    const history = [
      user('una web para mi agencia'),
      assistant(PLAN),
      user(phasePrompt({ number: 2, total: 3, description: 'Hero' })),
      assistant('hecho'),
    ];

    expect(nextPhase(history)).toMatchObject({ number: 3, total: 3 });
  });

  it('stops when the plan is finished, instead of looping', () => {
    const history = [
      user('una web para mi agencia'),
      assistant(PLAN),
      user(phasePrompt({ number: 2, total: 3, description: 'Hero' })),
      assistant('hecho'),
      user(phasePrompt({ number: 3, total: 3, description: 'Portafolio' })),
      assistant('hecho'),
    ];

    expect(nextPhase(history)).toBeUndefined();
  });

  it('does nothing when the model never wrote a plan', () => {
    expect(nextPhase([user('una landing sencilla'), assistant('Listo.')])).toBeUndefined();
  });
});

describe('findPlan', () => {
  it('takes the most recent plan, so a second request replaces the first', () => {
    const history = [
      assistant(PLAN),
      user('ahora hazme otra cosa'),
      assistant('<cresovaPlan>\nFASE 1: Uno\nFASE 2: Dos\n</cresovaPlan>'),
    ];

    expect(findPlan(history)?.phases).toEqual(['Uno', 'Dos']);
  });
});

describe('renderPlanForDisplay', () => {
  it('turns the block into a readable list instead of raw tags', () => {
    const shown = renderPlanForDisplay(`Voy por partes.\n${PLAN}\nEmpiezo.`);

    expect(shown).toContain('Plan de construcción (3 fases)');
    expect(shown).toContain('2. Hero con fondo interactivo y marquee');
    expect(shown).not.toContain('cresovaPlan');
  });

  it('leaves an ordinary answer untouched', () => {
    expect(renderPlanForDisplay('Listo, ya tienes tu web.')).toBe('Listo, ya tienes tu web.');
  });
});

/*
 * Taken from a real run: DeepSeek announced `**FASE 1**: ...` as a heading and never wrote the
 * tag, so the plan read as decoration and nothing ever asked for the second phase.
 */
describe('a plan the model announced in prose instead of in the tag', () => {
  const prose = [
    'Voy a construirlo por partes.',
    '',
    '**FASE 1**: Configuración completa + sistema de diseño + navbar + hero + footer',
    '**FASE 2**: Secciones de servicios y galería',
    '**FASE 3**: Formulario de contacto y pulido final',
  ].join('\n');

  it('reads the phases', () => {
    expect(parsePlan(prose)?.phases).toEqual([
      'Configuración completa + sistema de diseño + navbar + hero + footer',
      'Secciones de servicios y galería',
      'Formulario de contacto y pulido final',
    ]);
  });

  it('asks for the second phase, the same as it would with the tag', () => {
    expect(nextPhase([{ id: '1', role: 'assistant', content: prose }])).toEqual({
      number: 2,
      total: 3,
      description: 'Secciones de servicios y galería',
    });
  });

  it('leaves the message alone when it is shown, because prose already reads as prose', () => {
    expect(renderPlanForDisplay(prose)).toBe(prose);
  });

  it('ignores a single phase, which is a model narrating rather than planning', () => {
    expect(parsePlan('**FASE 1**: Configuración y navbar\n\nYa lo tienes.')).toBeUndefined();
  });

  it('ignores phases that are out of order, repeated or skipped', () => {
    expect(parsePlan('FASE 1: uno\nFASE 3: tres')).toBeUndefined();
    expect(parsePlan('FASE 2: dos\nFASE 3: tres')).toBeUndefined();
    expect(parsePlan('FASE 1: uno\nFASE 1: otra vez')).toBeUndefined();
  });

  it('ignores a mention of a phase inside a sentence', () => {
    expect(parsePlan('Terminé la FASE 1: quedó bien. Ahora la FASE 2: sigo.')).toBeUndefined();
  });
});
