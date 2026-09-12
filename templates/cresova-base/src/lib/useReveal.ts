import { useEffect, useRef } from 'react';

/**
 * Revela un elemento cuando entra en pantalla.
 *
 * Existe acá, en la plantilla, y no como una receta en el prompt, por una razón medida. En un
 * sitio generado de verdad —397 KB de bundle— `IntersectionObserver` aparecía **cero** veces,
 * aunque el pedido del cliente pedía reveals al scroll de siete formas distintas y el prompt trae
 * seis recetas de movimiento. El modelo llegó a escribir `@keyframes float` y `@keyframes
 * draw-line` en el CSS y no las aplicó a ningún elemento: escribió la animación y no la cableó.
 *
 * El patrón, medido en las dos direcciones sobre ese mismo sitio: lo que está en la plantilla se
 * copia, lo que está en la prosa se ignora. Una pista de grid mal escrita en la plantilla viajó
 * intacta al sitio del cliente mientras los nueve exemplars del prompt la tenían bien.
 *
 * Así que el movimiento deja de ser algo que el prompt pide y pasa a ser algo que la plantilla
 * trae ya funcionando.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;

    if (!el) {
      return undefined;
    }

    /*
     * Quien pidió menos movimiento ve el contenido, no una animación más corta. Se marca como
     * revelado de entrada y no se observa nada.
     */
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.dataset.revelado = 'si';
      return undefined;
    }

    const observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (entrada.isIntersecting) {
            entrada.target.setAttribute('data-revelado', 'si');
            observador.unobserve(entrada.target);
          }
        }
      },

      /*
       * El margen negativo abajo evita que algo se revele justo en el borde inferior, cuando
       * todavía no se ve. El umbral queda en 0 a propósito: una sección más alta que la ventana
       * nunca llegaría a un umbral por porcentaje.
       */
      { rootMargin: '0px 0px -12% 0px', threshold: 0 },
    );

    observador.observe(el);

    return () => observador.disconnect();
  }, []);

  return ref;
}
