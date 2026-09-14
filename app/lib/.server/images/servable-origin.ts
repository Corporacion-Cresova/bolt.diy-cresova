/**
 * ¿Puede el navegador de un cliente cargar las fotos que generamos?
 *
 * Es una pregunta de infraestructura, no de código, y por eso nadie la hacía: la generación
 * funcionaba, el modelo escribía el `<img>`, y la única señal de que algo andaba mal era una foto
 * que no aparecía en la página de un cliente. Mientras tanto cada sitio pagaba seis imágenes.
 *
 * Dos cosas la rompen, y las dos pasaron:
 *
 *   1. El origen sale en http. Un navegador no carga una imagen http dentro de una página https;
 *      la bloquea por contenido mixto. Lo arregla `publicOrigin`, leyendo X-Forwarded-Proto.
 *   2. El builder está detrás de la autenticación básica de Traefik, así que `/api/cresova-image/`
 *      contesta 401 a cualquiera que no sea Diego con su contraseña. El sitio del cliente no la
 *      tiene, y tampoco debería.
 *
 * Lo segundo no se arregla desde acá —es una regla del proxy— pero sí se puede dejar de pagar por
 * imágenes que no se van a ver, y decir en el log exactamente qué hay que cambiar.
 */
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('servable-origin');

export interface Servibilidad {
  servible: boolean;
  motivo: string;

  /**
   * Verdadero cuando el servidor contestó y la respuesta decide la pregunta.
   *
   * Existe para no recordar una no-respuesta. Una sonda que se agota devuelve «sí» para no frenar
   * la construcción, y si eso se guardara, un único timeout dejaría a la instancia gastando en
   * imágenes por el resto de su vida. Lo que no se pudo comprobar se vuelve a preguntar.
   */
  definitiva: boolean;
}

/** Un id que nunca va a existir: lo que importa es QUIÉN contesta, no qué contesta. */
const SONDA = 'sonda-de-alcance-publico';

const SONDA_TIMEOUT_MS = 2_000;

/**
 * @param origin el origen público de esta app
 * @param fetchImpl seam de tests
 */
export async function comprobarOrigenServible(origin: string, fetchImpl: typeof fetch = fetch): Promise<Servibilidad> {
  if (!origin.startsWith('https://')) {
    /*
     * Salvo en desarrollo, donde todo es http y el preview también: ahí no hay página https que
     * proteger, así que no hay contenido mixto que bloquear.
     */
    if (/^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(origin)) {
      return { servible: true, motivo: 'desarrollo local', definitiva: true };
    }

    return {
      servible: false,
      motivo: `el origen es ${origin}, en http: un navegador bloquea una imagen http dentro de una página https. Revisá que el proxy mande X-Forwarded-Proto.`,
      definitiva: true,
    };
  }

  try {
    const respuesta = await fetchImpl(`${origin}/api/cresova-image/${SONDA}.jpg`, {
      method: 'GET',
      redirect: 'manual',

      /*
       * Con límite de tiempo, y esto no es precaución teórica: sin él, esta petición colgó
       * generaciones enteras. Corre antes del primer token, y el worker le está preguntando a su
       * propio hostname público — o sea que sale a internet y vuelve por el proxy, un camino que
       * en varios despliegues no cierra y se queda esperando. La generación se quedaba «al
       * inicio», sin error y sin texto, y como el título del chat sale del primer artifact, el
       * chat tampoco cambiaba de nombre.
       *
       * Dos segundos alcanzan para una respuesta que viene del mismo servidor. Si no llega, el
       * catch de abajo decide seguir, que es lo correcto: una sonda lenta no es motivo para no
       * construir el sitio.
       */
      signal: AbortSignal.timeout(SONDA_TIMEOUT_MS),
    });

    if (respuesta.status === 401 || respuesta.status === 403) {
      return {
        servible: false,
        motivo: `${origin}/api/cresova-image/ responde ${respuesta.status} a quien no está autenticado, así que el sitio del cliente tampoco va a poder cargar las fotos. Hay que eximir esa ruta de la autenticación básica del proxy.`,
        definitiva: true,
      };
    }

    /*
     * Cualquier otra respuesta significa que la petición llegó hasta la app. Un 404 es lo
     * esperado: la sonda no existe. Lo que se estaba comprobando era quién contesta.
     */
    return { servible: true, motivo: `la ruta contesta ${respuesta.status} sin pedir autenticación`, definitiva: true };
  } catch (error) {
    /*
     * Una falla de red no es una respuesta. Puede ser que el contenedor no alcance su propio
     * hostname público, que es común y no dice nada sobre el navegador de un cliente. Ante la
     * duda se genera, que es lo que se hacía antes: este chequeo existe para evitar gastos
     * seguros, no para inventar motivos de no gastar.
     */
    logger.warn(`No se pudo comprobar si ${origin} sirve imágenes públicamente: ${(error as Error).message}`);

    return { servible: true, motivo: 'no se pudo comprobar; se asume que sí', definitiva: false };
  }
}

/**
 * Lo mismo, pero recordando la respuesta.
 *
 * Es configuración de infraestructura: no cambia entre una generación y la siguiente, y una
 * petición de red extra por build es un modo de falla nuevo a cambio de nada.
 */
const recordadas = new Map<string, Promise<Servibilidad>>();

export function origenServible(origin: string, fetchImpl: typeof fetch = fetch): Promise<Servibilidad> {
  const recordada = recordadas.get(origin);

  if (recordada) {
    return recordada;
  }

  const enCurso = comprobarOrigenServible(origin, fetchImpl).then((resultado) => {
    /*
     * Solo se guarda una respuesta que decide. Si la sonda no llegó a contestar, se olvida, para
     * que la próxima construcción vuelva a preguntar en vez de arrastrar un «sí» que nadie
     * verificó.
     */
    if (!resultado.definitiva) {
      recordadas.delete(origin);
    }

    return resultado;
  });

  recordadas.set(origin, enCurso);

  return enCurso;
}

/** Seam de tests. El runtime no lo llama. */
export function __olvidarOrigenes() {
  recordadas.clear();
}
