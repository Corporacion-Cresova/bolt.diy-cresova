#!/usr/bin/env node
/**
 * Audita un sitio generado, en el navegador, y devuelve números.
 *
 * Existe porque cada falla de calidad que encontramos costó una sesión entera: bajar el sitio,
 * servirlo local, levantar Chromium y medir a mano. Las cuatro que salieron de ese trabajo —la
 * columna del hero colapsada a 294px, el titular de 160px, el 93% de la página en escala de
 * grises, los diez targets tocables bajo 44px— eran todas medibles en un comando. Ahora lo son.
 *
 *   node scripts/medir-sitio.mjs https://cliente.preview.cresova.com/
 *
 * Necesita Chromium. Lo busca en CHROME_PATH y en las rutas habituales; si no lo encuentra, lo
 * dice y sale, en vez de fallar con un stack.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/* ------------------------------------------------------------------ análisis puro */

const lineal = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** Croma en OKLCH. Es la forma honesta de preguntar «¿esto tiene color o es gris?». */
export function croma(rgb) {
  const [r, g, b] = rgb.map((v) => lineal(v / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

  return Math.hypot(A, B);
}

export const UMBRAL_GRIS = 0.04;

/**
 * Convierte lo que se recolectó del navegador en hallazgos.
 *
 * Separado del navegador a propósito: es la parte que tiene reglas y por lo tanto la parte que
 * puede equivocarse en silencio, así que es la que lleva tests.
 */
export function analizar(crudo) {
  const hallazgos = [];
  const anota = (ok, titulo, detalle) => hallazgos.push({ ok, titulo, detalle });

  // --- tipografía ---------------------------------------------------------
  const { h1, h2Max, cuerpo } = crudo.tipografia;
  const razon = cuerpo > 0 ? h1 / cuerpo : 0;
  anota(
    h1 >= 48 && h1 <= 96,
    'titular del hero',
    `${h1}px` + (h1 < 48 ? ' — demasiado chico, suele ser una pista de grid colapsada' : h1 > 96 ? ' — pasado' : ''),
  );
  anota(razon > 0 && razon <= 5, 'proporción titular / cuerpo', `${razon.toFixed(1)}x sobre cuerpo de ${cuerpo}px`);
  anota(h2Max <= 96, 'el h2 más grande', `${h2Max}px`);

  // --- la columna del titular --------------------------------------------
  const { anchoColumna, anchoGrid } = crudo.hero;
  const porcion = anchoGrid > 0 ? anchoColumna / anchoGrid : 0;
  anota(
    porcion >= 0.4,
    'ancho de la columna del titular',
    `${anchoColumna}px de ${anchoGrid}px (${Math.round(porcion * 100)}%)` +
      (porcion < 0.4 ? ' — pista de grid colapsada: falta minmax(0,Nfr)' : ''),
  );

  // --- color --------------------------------------------------------------
  const total = crudo.areaPorColor.reduce((suma, [, area]) => suma + area, 0);
  const gris = crudo.areaPorColor.filter(([rgb]) => croma(rgb) < UMBRAL_GRIS).reduce((s, [, a]) => s + a, 0);
  const porcentajeGris = total > 0 ? (gris / total) * 100 : 0;
  anota(
    porcentajeGris <= 90,
    'área de la página con color',
    `${(100 - porcentajeGris).toFixed(1)}% con color, ${porcentajeGris.toFixed(1)}% en escala de grises`,
  );
  anota(crudo.fondosDistintos >= 3, 'fondos distintos entre secciones', `${crudo.fondosDistintos}`);

  // --- movimiento ---------------------------------------------------------
  anota(
    crudo.movimiento.intersectionObserver > 0,
    'reveals al scroll',
    crudo.movimiento.intersectionObserver > 0
      ? `IntersectionObserver presente`
      : 'ninguno — IntersectionObserver no aparece en el JS',
  );

  const huerfanos = crudo.movimiento.keyframesDeclarados.filter((k) => !crudo.movimiento.keyframesUsados.includes(k));
  anota(
    huerfanos.length === 0,
    'animaciones cableadas',
    huerfanos.length ? `declaradas y nunca aplicadas: ${huerfanos.join(', ')}` : 'todas las declaradas se usan',
  );

  // --- móvil --------------------------------------------------------------
  anota(
    crudo.movil.tocablesChicos === 0,
    'áreas tocables de 44px a 390px',
    `${crudo.movil.tocablesChicos} de ${crudo.movil.tocablesTotal} por debajo`,
  );
  anota(
    !crudo.movil.scrollHorizontal,
    'sin scroll horizontal en el teléfono',
    crudo.movil.scrollHorizontal ? 'desborda' : 'ok',
  );

  return hallazgos;
}

/* ------------------------------------------------------------------ navegador */

const RUTAS_CHROME = [
  process.env.CHROME_PATH,
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
];

function buscarChrome() {
  for (const ruta of RUTAS_CHROME) {
    if (ruta && existsSync(ruta)) {
      return ruta;
    }
  }

  // Los navegadores que instala Playwright, que es como viene el contenedor del builder.
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';

  if (existsSync(base)) {
    for (const dir of readdirSync(base)) {
      const ruta = join(base, dir, 'chrome-linux', 'chrome');

      if (existsSync(ruta)) {
        return ruta;
      }
    }
  }

  return null;
}

function conectar(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let id = 0;
    const pendientes = new Map();

    ws.addEventListener('message', (evento) => {
      const mensaje = JSON.parse(evento.data);

      if (mensaje.id && pendientes.has(mensaje.id)) {
        pendientes.get(mensaje.id)(mensaje);
        pendientes.delete(mensaje.id);
      }
    });
    ws.addEventListener('error', reject);
    ws.addEventListener('open', () =>
      resolve({
        enviar: (method, params = {}) =>
          new Promise((res) => {
            const i = ++id;
            pendientes.set(i, res);
            ws.send(JSON.stringify({ id: i, method, params }));
          }),
        cerrar: () => ws.close(),
      }),
    );
  });
}

/** Lo que se ejecuta dentro de la página. Devuelve datos crudos; las reglas viven en `analizar`. */
const RECOLECTAR = `(() => {
  const px = (e, p) => parseFloat(getComputedStyle(e)[p]) || 0;
  const moda = (xs) => Object.entries(xs.reduce((m, v) => ((m[v] = (m[v] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1])[0];
  const h1 = document.querySelector('h1');
  const h2s = [...document.querySelectorAll('h2')].map((h) => Math.round(px(h, 'fontSize')));
  const ps = [...document.querySelectorAll('p')].map((p) => Math.round(px(p, 'fontSize'))).filter((s) => s >= 14);
  const secciones = [...document.querySelectorAll('section')];

  const area = new Map();
  for (const e of document.querySelectorAll('*')) {
    const bg = getComputedStyle(e).backgroundColor;
    const m = bg.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/);
    if (!m || (m[4] !== undefined && parseFloat(m[4]) < 0.5)) continue;
    const r = e.getBoundingClientRect();
    const a = Math.max(0, r.width) * Math.max(0, r.height);
    if (!a) continue;
    const clave = m[1] + ',' + m[2] + ',' + m[3];
    area.set(clave, (area.get(clave) || 0) + a);
  }

  const columna = h1 ? h1.closest('[class*="mide-por-columna"]') || h1.parentElement : null;
  const grid = columna ? columna.parentElement : null;

  const reglas = [...document.styleSheets].flatMap((h) => { try { return [...h.cssRules]; } catch { return []; } });
  const declarados = reglas.filter((r) => r.type === 7).map((r) => r.name);
  const usados = [...new Set([...document.querySelectorAll('*')].map((e) => getComputedStyle(e).animationName).filter((n) => n && n !== 'none'))];

  return {
    tipografia: { h1: h1 ? Math.round(px(h1, 'fontSize')) : 0, h2Max: h2s.length ? Math.max(...h2s) : 0, cuerpo: ps.length ? Number(moda(ps)[0]) : 0 },
    hero: { anchoColumna: columna ? Math.round(columna.getBoundingClientRect().width) : 0, anchoGrid: grid ? Math.round(grid.getBoundingClientRect().width) : 0 },
    areaPorColor: [...area.entries()].map(([k, v]) => [k.split(',').map(Number), v]),
    fondosDistintos: new Set(secciones.map((s) => getComputedStyle(s).backgroundColor)).size,
    secciones: secciones.length,
    keyframesDeclarados: declarados,
    keyframesUsados: usados,
    scripts: [...document.querySelectorAll('script[src]')].map((s) => s.src),
  };
}) ()`;

const RECOLECTAR_MOVIL = `(() => {
  const tocables = [...document.querySelectorAll('a[href], button')].map((b) => Math.round(b.getBoundingClientRect().height)).filter((h) => h > 0);
  return {
    tocablesTotal: tocables.length,
    tocablesChicos: tocables.filter((h) => h < 44).length,
    scrollHorizontal: document.documentElement.scrollWidth > window.innerWidth + 1,
  };
}) ()`;

/**
 * Espera a que la página esté montada Y a que las fotos hayan resuelto.
 *
 * Lo segundo no es una cortesía, cambia el resultado. Una pista de grid escrita como fracción
 * pelada se colapsa por el ancho intrínseco de la imagen que vive adentro, así que el número depende de
 * si la foto llegó. Sobre el mismo sitio medimos 638px de columna midiendo antes de que cargaran,
 * 294px con las fotos puestas, y 153px con las fotos rotas: tres respuestas distintas a la misma
 * pregunta.
 *
 * Por eso el reporte dice cuántas cargaron: una medición con fotos rotas vale menos y quien la lee
 * tiene que poder saberlo.
 */
async function esperarRender(evaluar) {
  let montada = false;

  for (let i = 0; i < 30 && !montada; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    montada = await evaluar('!!document.querySelector("h1") && document.documentElement.scrollHeight > 1200');
  }

  if (!montada) {
    return { montada: false, imagenes: 0, imagenesCargadas: 0 };
  }

  for (let i = 0; i < 15; i++) {
    const pendientes = await evaluar('[...document.querySelectorAll("img")].filter((x) => !x.complete).length');

    if (pendientes === 0) {
      break;
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  const imagenes = await evaluar(
    'JSON.stringify({ total: document.querySelectorAll("img").length, cargadas: [...document.querySelectorAll("img")].filter((x) => x.complete && x.naturalWidth > 0).length })',
  );
  const { total, cargadas } = JSON.parse(imagenes);

  return { montada: true, imagenes: total, imagenesCargadas: cargadas };
}

async function medir(url) {
  const chrome = buscarChrome();

  if (!chrome) {
    console.error('No encontré Chromium. Poné la ruta en CHROME_PATH y volvé a correr.');
    process.exit(2);
  }

  const perfil = mkdtempSync(join(tmpdir(), 'medir-'));
  const puerto = 9400 + Math.floor(Math.random() * 400);
  const proceso = spawn(
    chrome,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',

      // Sin esto el navegador sale a hablar con Google al arrancar y ensucia cualquier log de red.
      '--disable-background-networking',
      '--disable-sync',
      '--no-first-run',
      `--remote-debugging-port=${puerto}`,
      `--user-data-dir=${perfil}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  try {
    let objetivo = null;

    for (let i = 0; i < 20 && !objetivo; i++) {
      await new Promise((r) => setTimeout(r, 1000));

      try {
        const lista = await (await fetch(`http://127.0.0.1:${puerto}/json/list`)).json();
        objetivo = lista.find((t) => t.type === 'page');
      } catch {
        /* todavía no levantó */
      }
    }

    if (!objetivo) {
      console.error('Chromium no respondió en el puerto de depuración.');
      process.exit(2);
    }

    const { enviar, cerrar } = await conectar(objetivo.webSocketDebuggerUrl);
    const evaluar = async (expr) =>
      (await enviar('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result
        ?.value;

    await enviar('Page.enable');
    await enviar('Runtime.enable');

    await enviar('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await enviar('Page.navigate', { url });

    const render = await esperarRender(evaluar);

    if (!render.montada) {
      console.error(`La página no terminó de renderizar: ${url}`);
      process.exit(1);
    }

    const escritorio = await evaluar(`JSON.stringify(${RECOLECTAR})`);
    const datos = JSON.parse(escritorio);

    /*
     * El bundle se busca por fuera de la página. Un reveal al scroll no deja rastro en el DOM una
     * vez que corrió, así que preguntarle al DOM si existe da un falso negativo; el JS sí lo dice.
     */
    let intersectionObserver = 0;

    for (const src of datos.scripts) {
      try {
        const texto = await (await fetch(src)).text();
        intersectionObserver += (texto.match(/IntersectionObserver/g) || []).length;
      } catch {
        /* un script que no se puede bajar no cuenta ni a favor ni en contra */
      }
    }

    await enviar('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await enviar('Page.navigate', { url });
    await esperarRender(evaluar);

    const movil = JSON.parse(await evaluar(`JSON.stringify(${RECOLECTAR_MOVIL})`));

    cerrar();

    return {
      ...datos,
      imagenes: render.imagenes,
      imagenesCargadas: render.imagenesCargadas,
      movimiento: {
        intersectionObserver,
        keyframesDeclarados: datos.keyframesDeclarados,
        keyframesUsados: datos.keyframesUsados,
      },
      movil,
    };
  } finally {
    proceso.kill();
  }
}

/* ------------------------------------------------------------------ salida */

export function imprimir(url, crudo, hallazgos) {
  const ancho = Math.max(...hallazgos.map((h) => h.titulo.length));
  console.log(`\n  ${url}`);

  const fotos = `${crudo.imagenesCargadas ?? 0} de ${crudo.imagenes ?? 0} fotos cargaron`;
  console.log(`  ${crudo.secciones} secciones · ${crudo.fondosDistintos} fondos distintos · ${fotos}`);

  /*
   * Dicho arriba de los hallazgos y no al pie: con fotos rotas, la medición del ancho de columna
   * es optimista, y quien lee el reporte tiene que enterarse antes de creerle.
   */
  if ((crudo.imagenesCargadas ?? 0) < (crudo.imagenes ?? 0)) {
    console.log('  ⚠ faltan fotos: el ancho de la columna del titular no es confiable en esta corrida.');
  }

  console.log('');

  for (const { ok, titulo, detalle } of hallazgos) {
    console.log(`  ${ok ? '✓' : '✗'} ${titulo.padEnd(ancho)}  ${detalle}`);
  }

  const fallan = hallazgos.filter((h) => !h.ok).length;
  console.log(`\n  ${hallazgos.length - fallan} de ${hallazgos.length} pasan.\n`);

  return fallan;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const url = process.argv[2];

  if (!url) {
    console.error('Uso: node scripts/medir-sitio.mjs <url>');
    process.exit(2);
  }

  const crudo = await medir(url);
  process.exit(imprimir(url, crudo, analizar(crudo)) > 0 ? 1 : 0);
}
