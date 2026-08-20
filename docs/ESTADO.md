# Estado del proyecto — Cresova Builder

Documento de continuidad. Si una sesión de trabajo se corta, esto es lo que hace falta leer para
retomar sin volver a deducirlo todo.

**Última actualización:** build 148 · rama `claude/bolt-cresova-evolution-isgupq` · todo fusionado
en `main`.

---

## 1. Qué es esto y a dónde va

Fork de bolt.diy convertido en **Cresova Builder**, el constructor de sitios web interno de
Cresova. El objetivo declarado es **reemplazar a Lovable**, que hoy se sigue usando en producción.

Prioridad acordada, en este orden:

1. **Base sólida de ejecución** ← estamos aquí
2. Calidad visual de los diseños
3. Integración de imágenes

El usuario lo dijo explícitamente: *"antes de mejorar la calidad de los diseños me gustaría mejor
optimizar esto para tener una base más sólida"*.

## 2. Reglas permanentes

**Seguridad — textual del usuario:**

> Nunca: escribas `OPEN_ROUTER_API_KEY` en código; agregues secretos al repositorio; imprimas
> secretos en logs; envíes secretos al browser; coloques secretos dentro de commits. Las API keys
> permanecen en EasyPanel Environment.

**Flujo de trabajo:** *"siempre que hagas cambios fusiona directo con el main"*. Es decir: rama →
commit → PR → merge a `main`. No dejar trabajo colgando en la rama.

**Restricciones técnicas:**

- No reescribir bolt.diy. Reutilizar la arquitectura existente.
- Preferir «50-200 líneas inteligentes» a «2000 líneas duplicando funcionalidades».
- Máximo **1 intento** de recuperación automática. Los bucles infinitos cuestan dinero en
  OpenRouter.
- No romper la infraestructura que funciona: Docker, EasyPanel, dominio, Wrangler.
- No revertir la lista curada de modelos de OpenRouter.
- No actualizar Remix, Vite, React, Wrangler ni WebContainer.

## 3. Dónde se ejecutan los proyectos

Éste es el trabajo grande del momento y ya está terminado del lado del código.

**El problema original:** WebContainer ejecuta `npm install` y el servidor de desarrollo *dentro de
la pestaña del navegador*. Eso significa que las construcciones van a la velocidad del portátil del
usuario, se frenan cuando la pestaña pasa a segundo plano, y el proyecto muere al cerrar la pestaña.

**La solución:** un servicio Node aparte (`runner/`) que ejecuta los proyectos en el VPS. Es un
servicio separado porque la aplicación principal corre bajo Wrangler (`workerd`), que no puede
lanzar procesos ni tocar el sistema de archivos.

### Las cuatro etapas

| Etapa | Qué | Estado |
|---|---|---|
| 1 | El servicio runner | ✅ en `main` |
| 2 | El adaptador cliente con forma de WebContainer | ✅ en `main` |
| 3 | El interruptor + shell compatible con jsh | ✅ en `main` (PR #16) |
| 4 | Docker por proyecto + pool precalentado | ⬜ pendiente |

Los tickets HMAC (PR #15) fueron requisito previo de la etapa 3.

### Cómo se enciende

**No cambia nada** hasta que estén configuradas las dos variables en el servicio **principal** de
EasyPanel:

| Variable | Valor |
|---|---|
| `RUNNER_TOKEN` | El mismo valor que en el servicio runner. Mínimo 32 caracteres. |
| `RUNNER_URL` | Dirección pública del runner, p. ej. `https://runner.cresova.com` |

Sin ellas, o si el runner no responde en 15 segundos, la aplicación arranca WebContainer como
siempre. Una insignia en la cabecera dice cuál está en uso: **VPS** o **Navegador**.

Los pasos de despliegue del runner están en `runner/README.md`.

### Lo que falta del lado de la infraestructura

El **certificado comodín** para `*.preview.<dominio>`. Un certificado comodín **siempre** requiere
validación DNS-01, sin importar la profundidad del subdominio, así que el proveedor de DNS necesita
un token de API.

Alternativa sin Cloudflare, ya ofrecida al usuario: un **conjunto fijo de nombres**
(`p1.preview…` a `p20.preview…`) con certificados HTTP-01 normales. Sólo cambia cómo se reparten
los nombres de vista previa, no el protocolo — se selecciona cambiando `PREVIEW_DOMAIN`.

## 4. Mapa del código propio

Todo lo añadido por Cresova vive en carpetas identificables.

### `app/lib/cresova/`

| Archivo | Qué hace |
|---|---|
| `execution-guard.ts` | Orquestación determinista: espera la cola de acciones, como mucho 1 recuperación, arranque automático, espera la vista previa. |
| `build-intent.ts` | Detecta si el mensaje pide construir algo (ES/EN). Sólo decide si una respuesta sin artefacto merece un reintento. |
| `dev-server.ts` | Detecta comandos de servidor de desarrollo y si ya hay dependencias instaladas. |
| `shell-watchdog.ts` | Presupuestos de tiempo por comando y banderas no interactivas. |
| `remote-container.ts` | `RunnerConnection` (WebSocket con correlación por id) y `RemoteContainer` (forma de WebContainer). |
| `remote-shell.ts` | El shell compatible con jsh. Ver §5. |
| `execution-backend.ts` | Elige el backend y expone `executionBackendStore` para la insignia. |

### `runner/`

| Archivo | Qué hace |
|---|---|
| `src/index.mjs` | Servidor HTTP + WebSocket. Proxy de vistas previas por cabecera Host. Verifica tickets. |
| `src/projects.mjs` | Un directorio y un puerto por proyecto. Puertos 41000–41999. Entorno con lista blanca. |
| `src/paths.mjs` | Confina toda ruta dentro del proyecto. |
| `src/tickets.mjs` | Firma y verificación HMAC-SHA256. |
| `src/ports.mjs` | Descubre por `/proc` qué puerto abrió de verdad el proyecto. |

### Otros

- `app/lib/common/prompts/cresova-build-contract.ts` — contrato de ejecución para `chatMode === 'build'`.
- `app/lib/common/prompts/cresova-design-kit.ts` — menú cerrado de tipografías, tokens, paletas, iconos.
- `app/lib/.server/images/pexels.ts` — catálogo de fotos por sector.
- `app/routes/api.runner-ticket.ts` — emite los tickets.
- `scripts/update-version.mjs` + `app/version.json` — contador de compilación.
- `public/templates/*.json` — plantillas alojadas por nosotros, no en GitHub.

## 5. Las trampas que ya costaron caro

Documentadas para no repetirlas.

### Los límites entre fragmentos del shell son críticos

`BoltShell` puede tener **dos lectores sobre el mismo stream a la vez**: un comando que todavía
espera su código de salida y otro nuevo que espera el prompt. Cada fragmento va al lector que pidió
primero. **Un fragmento de más entre las dos marcas hace que cada lector se coma la marca del otro
y ambos esperen para siempre.**

Por eso `remote-shell.ts` emite las marcas OSC seguidas, con el texto visible plegado dentro del
mismo fragmento. Si alguna vez hay que añadir salida ahí, tiene que ir *dentro* de un fragmento que
ya lleve una marca.

El analizador de `shell.ts` lee el código de salida del **segundo** número:
`exit=<duración>:<código>`.

### Los nietos sobreviven a las señales

`shell: true` significa que el hijo es un shell. Un servidor lanzado como
`npm install && npm run dev` es su **nieto**. Señalar sólo al shell dejaba el servidor vivo
ocupando el puerto. Por eso cada comando arranca en su propio grupo de procesos y se mata el grupo
entero (`killTree` en `projects.mjs`), con escalada a `SIGKILL`.

### La vista previa se alimenta de `port`, no de `server-ready`

`previews.ts` construye la lista de vistas previas desde el evento `port`. `server-ready` sólo
dispara el refresco. El adaptador deriva ambos del `server-ready` del runner.

### El navegador no puede llevar secretos

Cualquier cosa que tenga el cliente es legible por cualquiera que abra la aplicación. Por eso
existen los tickets: alcance de un proyecto, cinco minutos de vigencia. El secreto vive sólo en el
entorno de EasyPanel.

La aplicación firma con WebCrypto bajo `workerd`; el runner verifica con `node:crypto`.
`tickets-crossruntime.spec.mjs` existe para que esas dos firmas nunca se separen.

### Vite ignora `PORT`

**Verificado, no supuesto:** con `PORT=41500`, Vite 5.4.21 escucha en **5173**. `PORT` es una
convención de Create React App y Next.js, no de Vite — y Vite es lo que los modelos generan por
defecto.

WebContainer nunca tuvo este problema porque **observa** la llamada a `listen()`. El runner dictaba
un puerto. Ahora observa: `runner/src/ports.mjs` pregunta al kernel, vía `/proc`, qué puertos
abrieron los procesos del propio proyecto. Nada se deduce de la salida de los comandos, cuyo
formato cambia entre frameworks y versiones.

### Vite bloquea nombres de host desconocidos

Desde 5.4.12, Vite responde *"Blocked request. This host is not allowed"* a cualquier `Host` que no
reconozca. El proxy de vistas previas ya reescribe la cabecera a `127.0.0.1:<puerto>` al reenviar,
que es lo que hace cualquier proxy inverso hacia un servidor de desarrollo. No tocar eso.

### Los procesos huérfanos sirven el proyecto equivocado

Los comandos corren en su propio grupo de procesos —necesario para poder matar al nieto que es el
servidor— y esa misma separación hacía que **sobrevivieran a la muerte del runner**. Un servidor
huérfano conserva su puerto; el siguiente runner reparte ese puerto a otro proyecto, y el proxy
sirve el sitio de un proyecto bajo el nombre de otro. Con los reinicios de EasyPanel eso es
rutinario, no raro.

Dos defensas, ambas necesarias: el runner mata todos los grupos al recibir `SIGTERM`/`SIGINT`, y la
asignación de puertos comprueba que el puerto esté realmente libre intentando enlazarlo.

Esto apareció al probar con Vite real: el proxy devolvió el contenido de una prueba anterior.

### La causa raíz de casi todos los fallos de generación

El modelo tiene que escribir un sitio web entero con **8192 tokens de salida**. Eso fuerza
continuaciones, que causaban archivos truncados, artefactos duplicados y salida perdida. Cada
arreglo endureció la maquinaria; lo que quita la presión de verdad es el Cresova Web Starter
(pendiente) y la ejecución en servidor.

### Cosas verificadas, no supuestas

- `images.pexels.com` → 200
- `picsum.photos` → 200
- `source.unsplash.com` → **503, descontinuado**. No usarlo.
- El estrangulamiento de pestañas en segundo plano es real: temporizadores limitados,
  `requestAnimationFrame` detenido.

## 6. Límites conocidos del camino en servidor

Ninguno impide generar y ver un sitio.

- Los archivos creados por un comando no se reflejan en el árbol de archivos. El navegador tiene la
  fuente de la verdad y empuja cada cambio, pero nada observa la dirección contraria
  (`internal.watchPaths` es un no-op).
- La búsqueda de texto del workbench es una función de WebContainer sin equivalente en el servidor
  (`internal.textSearch`). Degrada de forma limpia: devuelve vacío.
- Los errores en tiempo de ejecución de la vista previa no se reenvían: la vista previa es una
  página con proxy, no un iframe que controlemos.
- Cosmético: la lista de artefactos todavía muestra filas de archivo duplicadas. La ejecución sí se
  omite correctamente.

## 7. Pendientes

| Qué | Notas |
|---|---|
| Etapa 4: Docker por proyecto | Aislamiento real entre proyectos + pool precalentado. |
| Cresova Web Starter | Fase 2 de plantillas. Quita la presión de los 8192 tokens. Aplazado por el usuario. |
| Galería de plantillas | El usuario dijo *"eso para más adelante"*. |
| Cerrar los límites de §6 | `watchPaths` y `textSearch` son los que más se notarían. |
| Calidad visual | Prioridad 2, después de la base. |

## 8. Cómo verificar

```bash
pnpm typecheck        # tsc
pnpm lint             # eslint
npx vitest run        # 108 pruebas en 11 archivos
pnpm build            # remix vite build
```

Las pruebas de integración levantan un **runner real** y hablan con él. Se saltan solas si
`runner/node_modules/ws` no existe:

```bash
cd runner && npm install
```

Las más valiosas:

- `remote-shell.spec.ts` — usa el `BoltShell` **real, sin modificar**, contra el runner. Si el
  protocolo se rompe, ahí se cuelga, igual que se colgaría en la aplicación.
- `remote-preview.spec.ts` — la cadena completa: escribir archivos, arrancar el servidor, detectar
  el puerto, servirlo por el proxy. Incluye el caso de un servidor que elige su propio puerto.
- `runner-shutdown.spec.ts` — que apagar el runner no deje servidores huérfanos ocupando puertos.
  Comprobado que falla si se quita el arreglo.
