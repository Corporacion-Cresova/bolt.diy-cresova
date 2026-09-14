/**
 * ¿Esta generación paga imágenes de IA?
 *
 * Es una función aparte porque es la línea que cuesta dinero, y una condición enterrada en medio
 * de `streamText` no se puede probar. Durante semanas la respuesta fue «sí» en todos los casos y
 * ninguna de las imágenes llegó a verse.
 *
 * Hacen falta las tres:
 *
 *   - `CRESOVA_IMAGES_ENABLED`, que dice si esta instancia sabe generar.
 *   - La llave de la API de imágenes, separada de la del texto para que el gasto se vea en su
 *     propia línea de facturación.
 *   - El interruptor de la caja de chat, que dice si ESTA generación las paga. Apagado por
 *     defecto: un gasto recurrente que se enciende solo es el que nadie revisa.
 */
export interface DecisionDeImagenes {
  generar: boolean;
  motivo: string;
}

export function debeGenerarImagenes(opciones: {
  habilitadoEnElEntorno: boolean;
  llave?: string;
  pedidoPorElUsuario?: boolean;
}): DecisionDeImagenes {
  if (!opciones.habilitadoEnElEntorno) {
    return { generar: false, motivo: 'CRESOVA_IMAGES_ENABLED no vale "true" en esta instancia' };
  }

  if (!opciones.llave) {
    return { generar: false, motivo: 'falta OPENROUTER_IMAGES_KEY' };
  }

  if (opciones.pedidoPorElUsuario !== true) {
    return { generar: false, motivo: 'el interruptor de imágenes está apagado' };
  }

  return { generar: true, motivo: 'las tres condiciones se cumplen' };
}
