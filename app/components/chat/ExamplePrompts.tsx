import React from 'react';

/*
 * These are the first thing a new user clicks, so they double as a demo of what the builder is for.
 * The upstream bolt.diy set (todo apps, space invaders, "a mobile app about bolt.diy") demoed the
 * wrong product in the wrong language: every real request here is a client site for a Honduran
 * business. Each one names a sector from <cresova_design_kit> so the generated page inherits that
 * row's palette and type instead of the model's defaults.
 */
const EXAMPLE_PROMPTS = [
  { text: 'Crea el sitio de un taller mecánico en San Pedro Sula, con servicios, zona de cobertura y WhatsApp' },
  { text: 'Crea la página de un eco-resort en Copán: habitaciones, tours y reservas por WhatsApp' },
  { text: 'Crea el sitio de una clínica dental: especialidades, equipo con credenciales y agenda de citas' },
  { text: 'Crea el catálogo de una ferretería con productos, precios y pedido por WhatsApp' },
  { text: 'Crea la página de un restaurante con menú por categorías, galería y reservas' },
];

export function ExamplePrompts(sendMessage?: { (event: React.UIEvent, messageInput?: string): void | undefined }) {
  return (
    <div id="examples" className="relative flex flex-col gap-9 w-full max-w-3xl mx-auto flex justify-center mt-6">
      <div
        className="flex flex-wrap justify-center gap-2"
        style={{
          animation: '.25s ease-out 0s 1 _fade-and-move-in_g2ptj_1 forwards',
        }}
      >
        {EXAMPLE_PROMPTS.map((examplePrompt, index: number) => {
          return (
            <button
              key={index}
              onClick={(event) => {
                sendMessage?.(event, examplePrompt.text);
              }}
              className="border border-bolt-elements-borderColor rounded-full bg-gray-50 hover:bg-gray-100 dark:bg-gray-950 dark:hover:bg-gray-900 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary px-3 py-1 text-xs transition-theme"
            >
              {examplePrompt.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}
