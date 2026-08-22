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

### Lo que faltaba del lado de la infraestructura (ya resuelto)

El **certificado comodín** para `*.preview.<dominio>` ya está configurado y funcionando (el usuario
lo confirmó: un subdominio cualquiera bajo el comodín responde). La alternativa sin Cloudflare que
se había ofrecido — un conjunto fijo de nombres con certificados HTTP-01 normales — no hizo falta.

### Publicar un sitio terminado

Distinto de correr el servidor de desarrollo: `container.publish(name)` compila el proyecto en el
VPS (`npm run build`), copia la salida a `/data/published/<name>` y la sirve bajo el mismo comodín,
en `<name>.preview.<dominio>` — un host aparte del `cresova-<id>.preview.<dominio>` del proyecto en
desarrollo, para que uno no choque con el otro. El directorio **es** el registro: sobrevive a que el
runner se reinicie y a que el proyecto se cierre, sin guardar nada aparte. Botón junto al Deploy
existente, sólo visible con el backend en `runner`.

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

### El runner se reinicia y eso es normal

`SIGTERM` en los logs del runner no es un fallo suyo: es algo externo ordenándole parar. En
EasyPanel eso es un redespliegue, un reinicio manual, o **un health check que falla**. El runner
responde 200 en `/` y en `/health`; si alguna vez se cambia eso, un orquestador que sondee `/` verá
un 404, concluirá que el servicio está caído y lo reiniciará en bucle.

Dos consecuencias que costaron una sesión entera de depuración:

1. **La conexión tenía que sobrevivir al reinicio.** Antes, un socket caído era definitivo: toda
   llamada posterior fallaba con *"The runner connection is not open"*, el workbench se quedaba
   mudo y nada decía por qué. Ahora reconecta sola pidiendo un ticket nuevo —los tickets caducan a
   los cinco minutos, así que no vale reusar el anterior— y las llamadas hechas mientras tanto
   esperan en vez de fallar.
2. **Al apagarse hay que cerrar los WebSockets a mano.** `server.close()` sólo deja de aceptar
   conexiones nuevas; las abiertas siguen vivas. Sin cerrarlas, el navegador seguía hablándole a un
   servicio que se estaba yendo y perdía en silencio lo que enviara en esa ventana.

### Los dos servicios se redespliegan juntos

El runner y la aplicación se construyen del **mismo repositorio y la misma rama**, con Build Path
`/` y Dockerfile `runner/Dockerfile`. Cualquier fusión a `main` redespliega **los dos**. Un SIGTERM
en los logs del runner casi siempre es eso, no un fallo suyo.

Por eso importa que la sesión sobreviva a un reinicio, y por eso el proyecto recuerda en disco
(`.cresova-runner.json`) con qué comando se levantó su servidor: los archivos sobreviven en el
volumen, pero el proceso no, y nadie más sabe cómo revivirlo — el navegador sólo envía un comando
de arranque mientras está generando.

Restaurarlo **no está en el camino crítico** de abrir el proyecto: si tardara o fallara, el
`ready` no saldría y el navegador se quedaría colgado conectando.

### Matar el runner con SIGKILL deja huérfanos

Vale para las pruebas y para producción: el apagado ordenado del runner es lo que detiene los
procesos de los proyectos, y `SIGKILL` se lo salta. Un servidor filtrado conserva su puerto, así
que la siguiente ejecución falla sobre un puerto ya tomado.

Costó una depuración larga porque una prueba se envenenaba a sí misma: pasaba, dejaba un huérfano,
y fallaba en todas las corridas siguientes. Las pruebas paran el runner con `SIGTERM` y esperan a
que salga.

### El portero que decidía si había diseño e imágenes

`detectBuildIntent` no sirve sólo para el reintento automático: **decide si el kit de diseño y el
catálogo de fotos llegan al modelo**. Si no reconoce la petición, sale una página genérica y sin
imágenes.

Tenía dos fallos, y con peticiones reales fallaba **5 de cada 10**:

1. Exigía el compuesto (`página web`, `sitio web`), pero la gente escribe *"una web para mi
   taller"* o *"Página para una barbería"*. Ahora también acepta los sustantivos sueltos.
2. El patrón de preguntas no reconocía ninguna pregunta bien escrita en español. Anclaba en la
   palabra sin admitir el `¿` inicial, y —más sutil— usaba `\b`, que **en JavaScript sólo conoce
   letras ASCII**: después de la `é` de *"qué"* no hay frontera de palabra, así que esa palabra
   nunca casaba. *"Cómo"* sí funcionaba, por terminar en `o`. Ahora usa una anticipación Unicode.

El segundo estaba tapado por el primero: al ser la lista de sustantivos tan estrecha, las preguntas
casi nunca llegaban a evaluarse.

### El runner necesita su propio dominio, aparte del comodín

`*.preview.<dominio>` sirve las **vistas previas**. La aplicación se conecta a otra cosa: la API del
runner, en `RUNNER_URL`. Son dos entradas distintas al mismo servicio y hacen falta las dos.

Configurar sólo el comodín deja `RUNNER_URL` apuntando a un dominio inexistente: la aplicación no
conecta, cae al navegador **en silencio** —que es el comportamiento correcto— y desde fuera parece
que todo va bien. Pasó exactamente así, y se diagnosticó comparando cuatro destinos: el comodín
respondía 404 (mensaje del propio runner) mientras `runner.<dominio>` no resolvía.

Detalle útil: el runner enruta los **upgrades de WebSocket por ruta, no por host**, así que
cualquier nombre bajo el comodín sirve como `RUNNER_URL` en un apuro (`https://conexion.preview.…`).
El `/health` de ese nombre devolverá 404 porque por HTTP sí se enruta por host.

Por eso la insignia ahora dice **«Navegador · VPS falló»** con el motivo en el tooltip: un
fallo silencioso es indistinguible de no haberlo configurado.

### Dónde se escribe cada archivo, y por qué se escribía fuera

`#runFileAction` calculaba la ruta con `path.relative(workdir, filePath)`. Eso **sólo significa algo
si `filePath` es absoluta**: con una ruta ya relativa —`package.json`, que es como la escriben los
modelos y como vienen las plantillas— `relative` la resuelve primero contra el directorio de
trabajo del proceso y devuelve algo que **se sale del proyecto** (`../../package.json`).

El runner rechaza esas rutas, que es lo correcto. Lo grave era lo otro: **el error se registraba y
se seguía adelante**. Los 25 archivos aparecían como creados, ninguno existía, y el síntoma llegaba
mucho después como `npm error enoent ... package.json`.

Ahora `toWorkdirRelative` convierte sólo las absolutas y deja las relativas en paz, y un fallo de
escritura **corta la acción** en vez de callarse.

### «Refused to connect» en la vista previa era COEP, no una conexión rechazada

`app/entry.server.tsx` sirve el builder con `Cross-Origin-Embedder-Policy: require-corp`, que hace
falta para WebContainer. Bajo esa política **todo subrecurso de otro origen que carga la página —un
iframe incluido— tiene que dar permiso** con `Cross-Origin-Resource-Policy: cross-origin`. El runner
no lo mandaba, así que el navegador bloqueaba el marco antes de pintar un byte y lo reportaba como
«refused to connect»: una vista previa que respondía perfectamente, leída como un servidor caído.

Verificado desde fuera antes de tocar nada: `cresova-000000.preview.cresova.com` devolvía 404 con el
texto correcto, o sea que DNS, Traefik, TLS y el runner estaban bien. El problema estaba en el
navegador, no en la red.

La cabecera va en las tres ramas del enrutado por Host, la del proyecto muerto incluida: un mensaje
que no se puede leer dentro del marco no sirve de nada.

### Publicar caducaba a los 60 segundos con el runner trabajando

`CALL_TIMEOUT_MS` era un minuto para toda llamada, y `publish` corre `npm run build` entero dentro de
la llamada. Un sitio real tarda más que eso, así que el navegador declaraba al runner sin respuesta
mientras seguía compilando tan tranquilo — y como el build no imprime nada, en los logs tampoco se
veía actividad que lo desmintiera. `call` acepta ahora un plazo por llamada, publicar usa diez
minutos, y el runner registra una línea al empezar y otra al terminar.

### Un método desconocido se descartaba en silencio

`handlers[message.type]` devolvía `return` a secas si no conocía el método. El navegador se quedaba
esperando una respuesta que no iba a llegar hasta agotar su propio plazo. Es exactamente cómo se ve
un runner desactualizado desde el otro lado: un servicio sano acusado de estar colgado. Ahora
contesta `Unknown method: <tipo>`, que además dice al instante que hay que redesplegarlo.

### Una acción que falla cancelaba todas las siguientes

`addToExecutionQueue` encadenaba con `chain.then(() => callback())`. Encadenar así encadena también
el **fallo**: una acción rechazada deja la cadena rechazada, y todo lo que se añada después se salta
sin ejecutarse, sin registrarse y sin nada en pantalla. Una construcción que muere en su tercer
archivo se ve exactamente igual que un modelo que deja de escribir — el tipo de fallo más caro,
porque manda la investigación hacia el modelo en vez de hacia nosotros.

El disparador estaba en `FilesStore.saveFile`: trataba «el archivo no está todavía en el almacén»
como `unreachable`. Pero un archivo que el modelo acaba de crear **no está** en el almacén; no hay
versión anterior que recordar para el reset, y eso no es un estado roto. Los dos se arreglaron:
`queueTask` reporta el fallo y devuelve la cadena sana, y `saveFile` acepta un archivo nuevo.

Detalle que costó entender el orden de los hechos: el eco de escrituras del navegador (§ árbol de
archivos) **tapó este fallo sin querer**, porque al llenar el almacén durante el streaming hacía que
`saveFile` encontrara contenido previo. Por eso la generación empezó a funcionar mejor justo después
de aquel arreglo, y por eso saltarse las escrituras parciales en el runner —que parecía una
optimización obvia— habría reintroducido el fallo entero.

### Un fallo del modelo se cerraba como si el modelo hubiera terminado

Tres sitios de `api.chat.ts` registraban un fallo del stream y luego cerraban la respuesta
limpiamente: el error del primer segmento, el `streamText` de una continuación que lanza, y el
error de una continuación en curso. Los tres viven dentro de un bucle desacoplado sobre
`fullStream`, donde un `throw` es un rechazo sin dueño que no llega a nadie.

El resultado para el usuario era peor que un error: la generación se cortaba a mitad de frase, sin
aviso, indistinguible de un modelo que decide parar. El fallo se lleva ahora hasta donde se arma la
respuesta y se lanza allí, después de haber fusionado lo que sí llegó — así el texto parcial se
queda en pantalla y el error aparece al lado, no en su lugar.

### Los modelos no siempre usan la etiqueta del plan

DeepSeek V4 anunció `**FASE 1**: ...` como encabezado y nunca escribió `<cresovaPlan>`. Sin la
etiqueta, `findPlan` no encuentra nada y el avance automático no dispara: las fases se leen como
decoración, la construcción para tras la primera y nadie pide la segunda.

`parsePlan` acepta ahora las dos formas. La versión en prosa exige **dos fases numeradas desde uno
y en orden**: un `FASE 1` suelto es un modelo narrando lo que hace, y actuar sobre él mandaría una
petición de pago por una fase que nadie describió.

### `cd /home/project` no existe en el VPS

El modelo escribe `cd /home/project && npm install` porque es lo que se le dice que es el directorio
de trabajo, y en WebContainer lo es. En el runner el proyecto vive en `/data/projects/<id>`, así que
el `cd` fallaba (`/bin/sh: 1: cd: can't cd to /home/project`, salida 2) y el `&&` convertía un `cd`
fallido en una compilación fallida: **todos** los comandos del artefacto morían antes de empezar. Se
veía como *Failed To Start Application* sin más explicación.

La ruta se reescribe a `.` en vez de traducirse (`toRunnerPaths`, en `runner-connection.ts`): el
comando ya arranca en el directorio del proyecto, así que el runner nunca tiene que saber cómo llama
el navegador a su propio directorio.

### El árbol de archivos vacío no era un problema estético

En el camino del VPS, `internal.watchPaths` era un no-op, así que el árbol quedaba vacío. Eso no
sólo se ve mal: el mismo almacén alimenta el arranque automático, la detección del comando de inicio
y **el contexto que se le manda al modelo en la fase 2**. Con el árbol vacío, la fase 2 no sabe qué
construyó la fase 1.

La solución no fue observar el disco en el servidor — eso obligaría a mandar por el socket cada ruta
que toca `npm install` para no decir nada útil — sino que el navegador reporte sus propias
escrituras: es él quien las hace. `remote-container.ts` emite el evento después de que la escritura
tiene éxito, nunca antes.

### Un puerto abierto no es una vista previa que funcione

Vite abre su puerto y **después** resuelve dependencias, así que la primera petición puede llegar
antes de que haya algo que responder. Anunciar `server-ready` en cuanto aparece el puerto ponía una
página en blanco delante del usuario que sólo se arreglaba recargando a mano. Ahora el runner hace
una petición HTTP real antes de anunciar: cuesta nada y de paso calienta el servidor, así que la
primera carga del navegador es la segunda petición, no la primera.

### Publicar reutiliza el mismo comodín, con un espacio de nombres aparte

Los sitios publicados viven bajo el mismo `*.preview.<dominio>` que los proyectos en desarrollo, así
que el enrutado por `Host` en `index.mjs` tenía que distinguir uno de otro sin un segundo dominio. La
regla es simple porque los ids de proyecto tienen una forma reservada: cualquier nombre publicado que
empezara por `cresova-` podría chocar con un id de proyecto real, así que `isValidPublishName`
rechaza ese prefijo — el mismo motivo por el que un usuario nunca podría publicar accidentalmente
encima del proyecto de otro.

El directorio publicado es intencionalmente ajeno al ciclo de vida del proyecto: `ProjectManager` no
guarda en memoria qué está publicado, sólo mira si `/data/published/<nombre>` existe. Eso es lo que
hace que sobreviva a un reinicio del runner sin ningún trabajo extra — se verificó arrancando un
runner, publicando, matándolo, y sirviendo el sitio desde uno nuevo que nunca abrió ese proyecto.

### Dos chats distintos compartían el mismo proyecto del VPS

El id del proyecto se guardaba bajo **una sola clave global** de `localStorage`
(`cresova.projectId`), sin relación con qué chat la pidiera. Cualquier chat nuevo en el mismo
navegador reutilizaba el proyecto del anterior: el `package.json`, los componentes y las
dependencias de un sitio se escribían encima de los de otro completamente distinto. Así fue como
`cresova-65852feb893920c2` apareció primero en el fallo original de npm ENOENT y, días después, en
un build de SOLTECSA Corporate Website que no tenía nada que ver — mismo id, mismo directorio,
proyectos distintos peleándose por él.

Arreglado leyendo el id del chat directamente de la URL (`/chat/<id>`) y guardando el proyecto bajo
una clave por chat, no una global. El caso incómodo era el chat que todavía no tiene id (antes del
primer mensaje): se guarda en `sessionStorage` bajo una clave de «borrador», propia de la pestaña, y
se «reclama» bajo el id permanente en el mismo instante en que el chat lo recibe — leyendo la URL en
ese momento, no el id que se le pasó, porque más de un camino del código la reescribe y sólo lo que
esté ahí en ese instante es lo que una recarga futura va a encontrar.

### Un turno con acciones fallidas ya no se contaba como si hubiera salido bien

La cola de acciones sigue adelante tras un fallo desde que se arregló el envenenamiento (más abajo),
que era lo correcto — pero el guardián de ejecución nunca miraba `action.status`. Un turno donde
tres archivos no se escribieron llegaba igual a `preview-ready`, y la fase 2 se construía sobre un
proyecto incompleto. Ahora el guardián revisa las acciones fallidas antes que nada, avisa con las
rutas afectadas y no avanza de fase. La lógica de qué decir vive aparte en `action-failures.ts`,
sin ninguna dependencia de `workbenchStore`, precisamente para poder probarla sin arrancar el runner.

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

## 5 bis. Variables de entorno

Sólo `OPEN_ROUTER_API_KEY` es imprescindible. Todo lo demás es opcional y desactiva una función
concreta si falta.

| Variable | Para qué | Sin ella |
|---|---|---|
| `OPEN_ROUTER_API_KEY` | Los modelos. **Imprescindible.** | No genera nada. |
| `PEXELS_API_KEY` | Catálogo de fotos verificadas por sector. | Los sitios salen sin imágenes reales. |
| `MAX_COMPLETION_TOKENS` | Techo de tokens de salida. | Se queda en 8192, que es lo que obliga a escribir por continuaciones. |
| `GITHUB_ACCESS_TOKEN` | Sube el límite de peticiones a GitHub. | Sólo importa si fallan las plantillas alojadas por nosotros. |
| `RUNNER_TOKEN` + `RUNNER_URL` | Ejecución en el VPS. | Se ejecuta en el navegador, como siempre. |

**Cuidado:** `bindings.sh` sólo reenvía al worker las variables **declaradas en
`worker-configuration.d.ts`**. Una variable puesta en EasyPanel pero no declarada ahí no llega
nunca, y falla en silencio. Le pasó a `MAX_COMPLETION_TOKENS`, que estuvo muerto desde que lo
añadí hasta el build 151.

## 5 ter. El MCP de EasyPanel

`.mcp.json` en la raíz declara el servidor `easypanel-mcp-server`, **sin el token dentro**: sólo
referencias a `${EASYPANEL_URL}` y `${EASYPANEL_TOKEN}`, que tienen que existir en el entorno de
quien lanza Claude Code.

Arranca en **`readonly`** y con **`EASYPANEL_RAW_DISABLED=1`**, y eso es deliberado:

- La documentación del propio MCP avisa de que las lecturas de `easypanel_raw` **no** están
  cubiertas por el modo de sólo lectura y pueden devolver secretos.
- Las claves de este proyecto —`OPEN_ROUTER_API_KEY`, `RUNNER_TOKEN`— viven justamente en las
  variables de entorno de EasyPanel. Una lectura cruda las traería a la conversación, que es
  exactamente lo que la regla de seguridad prohíbe.
- Este producto procesa contenido no fiable todo el rato (salida de modelos, logs, comentarios),
  que es el escenario de inyección de prompts contra el que avisa esa documentación.

Para diagnosticar —leer logs, ver estado, comprobar variables definidas— `readonly` basta. Subir a
`full` es una decisión consciente, no el punto de partida.

## 5 quater. Construcción por fases

Un prompt enorme no cabe en una respuesta, y pedirle al usuario que lo trocee él anula el sentido
del producto. Así que **trocea el modelo**: abre su respuesta con un plan, construye la fase 1, y el
workbench le pide la siguiente por su cuenta.

- `build-plan.ts` — analiza `<cresovaPlan>`, calcula qué fase toca y redacta la petición.
- El contrato de ejecución le dice al modelo cuándo escribir un plan y qué debe contener la fase 1
  (proyecto ejecutable: `package.json`, dependencias, arranque).
- El guard avanza la fase **sólo después** de que la vista previa esté lista, así cada fase enriquece
  algo que ya se ve funcionando.

**Sin estado.** El progreso se deduce del historial contando los mensajes que lleva la marca
`[Cresova · fase]`, así que recargar, reconectar o abrir otra pestaña reanudan bien.

**Control de coste**, que es la restricción explícita del usuario:

- `MAX_PHASES = 6`, absoluto. Un plan de veinte fases se corta ahí.
- Una fase que **no escribe archivos no avanza**: algo salió mal y seguir sería gastar dinero
  construyendo sobre un proyecto que no está.
- Un plan de una sola fase se ignora: sería una llamada extra para nada.

## 6. Límites conocidos del camino en servidor

Ninguno impide generar y ver un sitio.

- Los archivos creados por **un comando** en el servidor se reflejan en el árbol con un retraso: no
  en vivo, sino reconciliados justo después de que el comando termina (`fs.tree` + `reconcileTree`).
  Una acción `shell` o `start` en curso, mientras corre, sigue siendo invisible.
- La búsqueda de texto del workbench es una función de WebContainer sin equivalente en el servidor
  (`internal.textSearch`). Degrada de forma limpia: devuelve vacío.
- Los errores en tiempo de ejecución de la vista previa no se reenvían: la vista previa es una
  página con proxy, no un iframe que controlemos.

## 7. Pendientes

| Qué | Notas |
|---|---|
| Etapa 4: Docker por proyecto | Aislamiento real entre proyectos + pool precalentado. |
| Cresova Web Starter | Fase 2 de plantillas. Quita la presión de los 8192 tokens. Aplazado por el usuario. |
| Galería de plantillas | El usuario dijo *"eso para más adelante"*. |
| Cerrar los límites de §6 | `textSearch` y los errores de la vista previa son los que quedan. |
| Unificar la barra de botones | Ver la tabla de abajo — ya no incluye `Publish`, resuelto. |
| Calidad visual | **Prioridad 2**, después de la base. |
| Interfaz al estilo Lovable | **Prioridad 3**, lo último. Ver abajo. |

### Interfaz al estilo Lovable (prioridad 3)

El usuario pidió una barra superior como la de Lovable. El hallazgo importante es que **casi todo
ya existe**, repartido entre tres sitios, y tres de esas cosas sólo se ven si estás en la pestaña
correcta:

| Botón de Lovable | Qué hay hoy | Dónde vive |
|---|---|---|
| Vista previa / código / capas | Slider Code · Diff · Preview | `Workbench.client.tsx` |
| Modo dispositivo, refrescar, abrir fuera | Sí, con marcos de iPhone/iPad/laptop | Dentro de `Preview.tsx` |
| `Publish` | Botón Deploy a Netlify/Vercel/GitHub/GitLab, **y ahora también** un botón Publicar al VPS | Cabecera |
| Base de datos | Integración Supabase completa | Ajustes → pestaña Supabase |
| `Share` | Export/Import de chat + Sync | Sólo en la vista de código |

- **Barato** (una tarde, riesgo cero): unificar todo en una sola barra y restilarla como píldora
  segmentada. Sólo se mueven componentes que ya funcionan.
- **Feature de verdad**: el selector de páginas (`Homepage ▾`) necesita leer las rutas del proyecto
  generado. Versión a mitad de camino: `displayPath` ya existe en el preview, convertirlo en campo
  editable con desplegable de rutas visitadas.
- El panel de base de datos es re-superficie, no construcción, pero la integración de Supabase **no
  está verificada contra el camino del VPS**. Comprobarlo antes de darle un botón prominente.

## 8. Cómo verificar

```bash
pnpm typecheck        # tsc
pnpm lint             # eslint
npx vitest run        # 203 pruebas en 23 archivos
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
