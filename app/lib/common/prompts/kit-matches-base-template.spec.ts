import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CRESOVA_DESIGN_KIT } from './cresova-design-kit';

/**
 * El kit describe el sistema de diseño en prosa; la plantilla base lo trae en código. Los dos
 * llegan al modelo en el mismo build, y hasta ahora nadie los había comparado.
 *
 * No coincidían, y de la peor manera posible: el kit decía «copiá esta forma» y mostraba un
 * `tailwind.config.js` solo con colores en hex, mientras la plantilla trae uno que además declara
 * `text-hero`, `font-heading`, `shadow-raised`, `max-w-measure` y los usa en sus componentes.
 * Un modelo que seguía el kit al pie de la letra sobrescribía ese archivo y borraba todas esas
 * clases — que es exactamente el fallo de PostCSS contra el que el propio kit advierte tres
 * párrafos antes.
 */
const template = JSON.parse(readFileSync('public/templates/cresova-base.json', 'utf8')) as {
  files: Array<{ path: string; content: string }>;
};

const fileFromTemplate = (suffix: string) => {
  const found = template.files.find((file) => file.path.endsWith(suffix));
  expect(found, `la plantilla base no trae ${suffix}`).toBeTruthy();

  return found!.content;
};

const tailwindConfig = fileFromTemplate('tailwind.config.js');

/**
 * Las llaves de primer nivel dentro de `theme.extend`, que es la lista real de qué familias de
 * clases existen.
 *
 * Comparar conjuntos y no substrings: la primera versión de este test afirmaba
 * `expect(kit).toContain('fontFamily')`, y eso lo cumple hasta `_fontFamily`. Lo probé mutando el
 * kit y el test pasó igual — una aserción que no falla cuando el código está mal no está probando
 * nada.
 */
function extendedTokens(source: string): Set<string> {
  const body = source.slice(source.indexOf('extend: {') + 'extend: {'.length);
  const keys = new Set<string>();

  let depth = 0;

  for (const line of body.split('\n')) {
    // la profundidad se mira ANTES de contar las llaves de esta línea, que es donde está la clave
    if (depth === 0) {
      const key = /^\s*'?([A-Za-z][A-Za-z0-9]*)'?:\s*[[{]/.exec(line);

      if (key) {
        keys.add(key[1]);
      }
    }

    for (const char of line) {
      if (char === '{' || char === '[') {
        depth += 1;
      } else if (char === '}' || char === ']') {
        depth -= 1;
      }
    }

    // la llave que cierra `extend` deja el resto del archivo fuera
    if (depth < 0) {
      break;
    }
  }

  return keys;
}

/** El snippet de config que el kit le dicta al modelo para un proyecto sin config previo. */
const kitConfigSnippet = CRESOVA_DESIGN_KIT.slice(
  CRESOVA_DESIGN_KIT.indexOf('// tailwind.config.js'),
  CRESOVA_DESIGN_KIT.indexOf('Then define the six values'),
);

describe('el design kit y la plantilla base', () => {
  it('el kit no manda reescribir un config que la plantilla ya trae', () => {
    expect(CRESOVA_DESIGN_KIT).toMatch(/WHEN THE FILE ALREADY EXISTS, DO NOT REWRITE IT/);
    expect(CRESOVA_DESIGN_KIT).toMatch(/ONLY WHEN THERE IS NO CONFIG YET/);
  });

  it('el config que dicta el kit declara exactamente los tokens que declara la plantilla', () => {
    /*
     * El test que importa. Si la plantilla declara un token y el snippet del kit no, un build desde
     * cero escribe un config sin él y las clases de los ejemplos no compilan. Si el kit declara uno
     * que la plantilla no tiene, los dos caminos producen sitios distintos.
     */
    const fromTemplate = extendedTokens(tailwindConfig);
    const fromKit = extendedTokens(kitConfigSnippet);

    expect(fromTemplate.size).toBeGreaterThanOrEqual(6);
    expect([...fromKit].sort()).toEqual([...fromTemplate].sort());
  });

  it('usa la misma mecánica de color que la plantilla, no hex sueltos', () => {
    /*
     * La plantilla apunta los colores a custom properties para que cambiar de paleta sean seis
     * líneas en un archivo, y `<alpha-value>` es lo que hace funcionar los sufijos /10 y /15. Un
     * config con hex rompe las dos cosas en silencio: el sitio compila y la paleta deja de ser
     * intercambiable.
     */
    expect(tailwindConfig).toContain('<alpha-value>');

    // los seis colores del snippet, no uno suelto
    for (const color of ['bg', 'surface', 'ink', 'muted', 'accent', 'accent-strong']) {
      const key = color.includes('-') ? `'${color}'` : color;
      expect(kitConfigSnippet, color).toContain(`${key}: 'rgb(var(--${color}) / <alpha-value>)'`);
    }

    expect(kitConfigSnippet, 'el kit volvió a dictar hex').not.toMatch(/#[0-9A-Fa-f]{6}/);
  });

  it('el hero declarado es el mismo en el snippet del kit y en la plantilla', () => {
    expect(kitConfigSnippet).toContain('clamp(3rem, 9vw, 10rem)');
  });

  it('el kit manda la paleta al archivo donde la plantilla la lee', () => {
    const css = fileFromTemplate('src/index.css');

    expect(css).toContain('--accent');
    expect(CRESOVA_DESIGN_KIT).toContain('src/index.css');
  });

  it('el tamaño del hero es el mismo número en la prosa y en el código', () => {
    /*
     * 10rem salió de medir seis sitios que el cliente aprobó. Si uno de los dos lados se mueve y
     * el otro no, el modelo recibe dos techos distintos para la misma decisión.
     */
    expect(tailwindConfig).toContain('clamp(3rem, 9vw, 10rem)');
    expect(CRESOVA_DESIGN_KIT).toContain('clamp(3rem, 9vw, 10rem)');
  });
});
