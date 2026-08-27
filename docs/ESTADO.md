# Estado del proyecto — Cresova Builder

Documento de continuidad. Si una sesión de trabajo se corta, esto es lo que hace falta leer para
retomar sin volver a deducirlo todo.

**Última actualización:** build 216 · rama `claude/cresova-builder-diagnostic-2oqiv6`.

---

## 0. Dónde retomar

Lo primero que hay que saber al abrir una sesión nueva.

### Lo que espera acción del usuario

**1. Redesplegar `bolt-diy` y RECARGAR FUERTE la pestaña** (Ctrl+Shift+R). La insignia debe pasar a
**build 216**. La recarga fuerte importa: ver §5, «los chunks con hash desaparecen al redesplegar».

**2. Comprobar que el `index.html` generado lleva el `<link>` de Google Fonts.** Es lo único que
importa de esta tanda; sin eso, la tipografía sigue muerta. Sobre cualquier sitio publicado:

```bash
curl -s https://<sitio>.preview.cresova.com/ | grep -i "fonts.googleapis"
```

**3. Y entonces sí, mirar el sitio con el diseño en sus condiciones**, y decidir si sigue por debajo
de Lovable. Ésa es la que decide si pasamos a shadcn (§7).

### Lo cerrado en el build 216

| Qué | Verificado |
|---|---|
| Las cuatro parejas tipográficas traen su `<link>` literal, con `preconnect` | las cuatro URLs **comprobadas contra Google Fonts**: 200 y `@font-face` reales |
| El kit termina con una lista de comprobación para lo que se pierde en la prosa | no — hace falta una generación real |

**Y una corrección de lo que yo mismo escribí en el 214:** dije que si el sitio compilaba y aun así
se veía genérico, el siguiente sospechoso era el modelo. **La medición lo desmiente** — ver §5, «la
tipografía estaba elegida y nunca se cargó». La lista curada no era el problema.

### Lo cerrado en el build 215

| Qué | Verificado |
|---|---|
| El contrato prohíbe inventarse valores de escala en `@apply` (`duration-350` rompió un sitio entero) | no — hace falta una generación real |
| `DiffView` deja de cargar nueve gramáticas que este constructor no usa nunca | typecheck |
| Un resaltador que falla deja de quedarse cacheado como rechazo para toda la vida de la página | typecheck |

**El build 214 funcionó, y conviene no perderlo:** el informe trajo `tokens de salida: 64000`,
`TURNOS AUTOMÁTICOS: ninguno` y **31 archivos en una sola pasada**. Antes eran 2 y 15 encadenando
fases. El techo de 8.192 era la causa y era nuestro.

### Lo cerrado en el build 214

| Qué | Verificado |
|---|---|
| Los cuatro modelos declaran su salida real: **8.192 → 64.000** | typecheck; **la medición de verdad es en ejecución** |
| El tope efectivo sale en el informe, para que no vuelva a ser invisible | no probado en un navegador |

### Lo cerrado en el build 213

| Qué | Verificado |
|---|---|
| Un tope duro de **8 turnos automáticos por petición**, que no depende de saber qué camino está en bucle | sí, 7 pruebas |
| El informe dice quién pidió cada turno automático (`artifact-recovery`, `phase 3/5`…) | sí, pruebas |
| Al agotarse, un aviso en español explica por qué se paró; el usuario puede seguir escribiendo | sí, pruebas |

**Lo que sigue abierto y no hay que olvidar:** la causa del bucle **no está identificada**. Se
descartaron leyendo el código la recuperación de artefacto (acotada a 1, y su contador sólo se
reinicia en `sendMessage`), la continuación del servidor (`MAX_RESPONSE_SEGMENTS`, y el turno del
usuario traía `completion: 1869`, sin corte por longitud) y el `createSampler` del 211 (dos
instancias en toda la página, sin fuga de listeners). El cortafuegos acota el coste; no cierra el
fallo.

Y con él sigue abierta **la duplicación del texto al streamear** (`TheThe files wereThe files
were…`), que no está diagnosticada y no se toca a ciegas: por ese bucle pasa toda la generación.

### Lo cerrado en el build 212

| Qué | Verificado |
|---|---|
| «Arrancando el servidor» para siempre: una acción `start` viva vuelve a contar como servidor sano, no como paso en curso | sí, 12 pruebas — y comprobado que **4 de ellas fallan** contra el código del 211 |
| «Escribiendo archivos · 3 de 4» congelado: una vista previa viva gana siempre a una acción que se quedó a medias | sí, mismas pruebas |
| Dos tarjetas anunciando la misma construcción: cada una habla de **su** turno, no del global | sí, pruebas; no probado en un navegador |
| Fase `truncated`: un turno cortado por el límite de salida se dice en una línea en vez de girar | sí, pruebas |

### Lo cerrado en el build 211 — y confirmado en producción

**La vista previa se incrusta.** El diagnóstico del 211 lo dijo con todas las letras, que es
exactamente para lo que se añadió esa sección:

```
cross-origin-embedder-policy: credentialless
cross-origin-resource-policy: cross-origin
el builder exige política de incrustación: no
se puede incrustar: sí
```

Tres builds de síntoma, cerrados. Ver §0 quinquies.

| Qué | Verificado |
|---|---|
| «Refused to connect»: la vista previa manda ahora **su propia** cabecera de incrustación, y el builder deja de exigir aislamiento cuando el runner está configurado | sí, pruebas del runner en las cuatro ramas del `Host`; no probado aún en un navegador |
| El informe de Diagnóstico mide lo que el navegador recibe de la vista previa, en vez de razonar sobre lo que el runner envía | sí, 6 pruebas |
| El panel abre en **Preview** y deja de saltar al código mientras se escriben archivos | no probado en un navegador |
| Animación de construcción en el panel, con la fase real (escribiendo · instalando · arrancando) | sí, 8 pruebas de la lógica; el componente no se probó en un navegador |
| El chat deja de listar los archivos: una sola línea de agente, con el detalle plegado detrás del acordeón | no probado en un navegador |
| Los bloques de código dejan de quedarse en blanco por una gramática de shiki que no se descarga | no — hace falta un chat real |
| Dos puntos donde la pestaña de fondo rompía la vista previa: `requestAnimationFrame` en `refreshPreview` y el temporizador de cola de `createSampler` | sí, 5 pruebas del sampler |

### Lo cerrado en el build 210

| Qué | Verificado |
|---|---|
| Un solo botón de diagnóstico: se retira «Debug Log» del header y lo único que aportaba —el historial de la terminal— pasa a «Diagnóstico» | sí, pruebas; no probado en un navegador |
| Los errores no capturados del navegador se recogen **desde el primer instante** y salen en el informe | sí, 7 pruebas |

### Lo cerrado en el build 209

| Qué | Verificado |
|---|---|
| El cuelgue de la pestaña: se quita el escaneo cuadrático duplicado del lector del shell | causa medida en producción; el arreglo es un borrado, no probado aún en un navegador |
| Un proyecto que compila mal pero sirve deja de ser una página en blanco sin explicación: la alerta lleva el error y el botón «Ask Bolt» | sí, 6 pruebas del detector |
| El contrato le dice al modelo que `@apply` no funciona con `group`, `peer` ni `dark` | no — hace falta una generación real |

### Lo cerrado en el build 208

| Qué | Verificado |
|---|---|
| El sondeo y el proxy dejan de suponer `127.0.0.1` y usan la dirección que el kernel reporta | **sí, confirmado en producción** — el proyecto escuchaba en `[::1]:5173` y la vista previa apareció |
| El diagnóstico dice **por qué** falló el sondeo, en qué direcciones escucha y qué imprimió el servidor | sí, pruebas del runner |
| El veredicto del runner corta la espera de la vista previa en vez de dejarla agotar 10 minutos | sí, typecheck; no probado en un navegador |
| La construcción avanza de fase aunque la vista previa no llegue, si la fase escribió archivos | no probado en ejecución |
| Atribución de las tareas largas por función (`long-animation-frame`) | sí, pruebas; el informe no se probó en un navegador |

### Lo cerrado en el build 207

| Qué | Verificado |
|---|---|
| La vista previa sobrevive a recargar, reabrir el chat y reconectar: el estado del servidor viaja en el apretón de manos | sí, prueba de extremo a extremo con un runner real |
| Medición de la pestaña en segundo plano dentro del botón Diagnóstico | **sí, y dio resultado** — ver §0 bis |
| Una actualización de React cada 100 ms en vez de una por token (`experimental_throttle`) | no — es menos trabajo por construcción, pero no se midió en ejecución |

### Lo que quedó cerrado en la tanda anterior (PR #37 a #46)

| # | Qué | Verificado |
|---|---|---|
| 37 | El vigilante espera mientras el proceso siga vivo, y avisa al rendirse. Publicar deja de esconderse tras la vista previa | sí, en ejecución |
| 38 | Plazo en el proxy de vistas previas + cabecera CORP en la rama del 502. Republicar: caché y botón | sí, en ejecución |
| 39/42 | Lo publicado sobrevive al redespliegue — el arreglo del default **más** quitar la variable que lo anulaba en el Dockerfile | sí, pruebas |
| 40 | El runner dice **qué observó**, no sólo que se rindió | sí, pruebas |
| 41 | El contador de compilación sube de verdad, y siempre hacia adelante | sí |
| 43 | `selectContext` deja de matar la petición cuando no hace falta ningún archivo nuevo | **no** — necesita una llamada real al modelo |
| 44 | El lockfile sale del árbol de archivos | sí, pruebas |
| 45 | Botón de diagnóstico | sí, pruebas del runner; el botón no se probó en un navegador |
| 46 | Se sirve el servidor que **contesta**, y abrir un proyecto deja de reconstruirlo entero | pruebas del runner; el cambio de `workbench.ts` **no** se probó en un navegador |

### Los problemas abiertos

**1. La pestaña en segundo plano.** Sigue sin causa identificada, pero ya no sin instrumentos, y la
hipótesis de partida está descartada por medición. Ver §0 ter.

**2. Tres cambios sin verificar en ejecución**, todos en caminos delicados: el reintento del stream
en `api.chat.ts` (toca el bucle de streaming, por donde pasa toda la generación), el salto de
reproducción en `workbench.ts` (toca el arranque de cada proyecto) y ahora el
`experimental_throttle` del chat. Si algo se rompe del todo tras el despliegue, son los primeros
sospechosos.

---

## 0 bis. Los problemas abiertos, y lo que se ha medido de ellos

### La vista previa, primera causa: el anuncio que había que estar presente para oír (build 207)

El síntoma que lo delató fue *"la publicación todo bien, solo es la preview que no termina de
aparecer"*. Esa asimetría es la pista entera: **publicar compila los archivos del disco**, así que un
proyecto que publica bien tiene sus archivos, su `package.json` y su build en orden. Lo único que
publicar no necesita es el `server-ready`.

Y el `server-ready` es un **evento que se emite una sola vez**, a los sockets que estén abiertos en
ese instante. El navegador se entera de que existe una vista previa por ahí y por ningún otro sitio:
`previews.ts` construye la lista desde el evento `port`, que `remote-container.ts` deriva de ese
`server-ready`. Quien no estuviera escuchando en ese instante no se enteraba nunca. Eso son tres
formas cotidianas de llegar tarde:

- recargar la página,
- reabrir el chat,
- reconectar después de que el runner se reiniciara (un redespliegue basta).

Y el arreglo del PR #46 —**no reproducir el artefacto si el proyecto ya tiene archivos**, que era
correcto y arreglaba lo de los tres servidores— cerró la única puerta que quedaba: al no volver a
ejecutarse la acción `start`, **no había un segundo anuncio que esperar**. Un chat reabierto no podía
recuperar su vista previa jamás. El sitio servía perfectamente y el builder no enseñaba nada.

El arreglo es dejar de tratarlo como un evento: el estado del servidor viaja ahora en el apretón de
manos (`serverReady`, `servingPort`), y `RemoteContainer.on('server-ready'|'port')` se lo entrega a
quien se suscriba después. La vista previa pasa a ser **un hecho del proyecto que cualquier conexión
nueva puede leer**, en vez de un evento en el que había que estar presente.

Dos detalles que importan:

- El apretón de manos **también manda cuando dice que no hay servidor**. Llegar ahí significa que un
  socket acaba de abrirse, y tras una reconexión eso es un runner que paró todos sus proyectos al
  salir: lo que recordáramos de antes habla de un proceso que ya no existe.
- La entrega al suscriptor tardío va un turno después (`setTimeout(0)`), no síncrona: la tienda de
  vistas previas se suscribe **desde su propio inicializador**, y llamarla en ese momento la
  alcanzaría a medio construir.

No hizo falta tocar el cambio de vista: `Workbench.client.tsx` ya salta a la pestaña de vista previa
cuando aparece una URL nueva.

**La lección, que es la parte reusable:** cuando un arreglo apaga una repetición, hay que preguntarse
qué más dependía de que esa repetición ocurriera. Aquí la reproducción del artefacto no sólo
reconstruía el proyecto — era también lo que volvía a anunciar el servidor.

### La vista previa, segunda causa: el servidor abre su puerto y no contesta (build 208)

El arreglo del apretón de manos era correcto y no era suficiente. La primera lectura real del
diagnóstico lo dijo en una línea:

```
puertos escuchando: 5173
puerto sirviendo: ninguno todavía
servidor anunciado: no
sigue buscándolo: sí
último sondeo: abrió 5173 pero ninguno contestó una petición HTTP
```

Es decir: el proyecto **sí** levantó su servidor —el puerto está abierto y el kernel lo confirma—
pero una petición HTTP a `127.0.0.1:5173` no obtiene respuesta. Nada que ver con el evento perdido:
aquí no había nada que anunciar. Es el fallo que §5 daba por «pendiente de confirmar con el mensaje
nuevo»; queda confirmado.

Y el mensaje, tal como estaba, **juntaba dos fallos opuestos en la misma frase**:

- **conexión rechazada** → el servidor no está donde estamos mirando. Otra dirección, otro puerto.
- **conexión aceptada y sin contestar** → el servidor arrancó y se atascó.

Piden investigaciones contrarias, y «no contestó» valía para las dos. Ahora el sondeo dice cuál fue,
con el código de error cuando lo hay.

**La suposición que había debajo.** `answersHttp` y el proxy hablaban con `127.0.0.1` sin haberlo
observado nunca. Es exactamente el mismo error que `PORT`: dictar en vez de mirar. Un servidor de
desarrollo que acaba en el bucle IPv6 —Node resuelve `localhost` en el orden que le da el sistema, y
en un contenedor con IPv6 eso puede ser `::1`— está escuchando, aparece en la tabla del kernel, y
rechaza todas las conexiones a `127.0.0.1`. Visto desde fuera es idéntico a un servidor atascado.

`ports.mjs` lee ahora la dirección además del puerto, decodificándola de `/proc/net/tcp` y
`/proc/net/tcp6`, y el sondeo y el proxy usan **la que el kernel reporta**. Tres casos, y los tres
con prueba: IPv4 (incluido `0.0.0.0`) → `127.0.0.1`; IPv6 (incluido `::`, que en Node acepta las dos
familias) → `::1`; y una dirección IPv4 mapeada dentro de la tabla IPv6, que es un socket IPv4 con
forma de IPv6 y hay que alcanzarlo como IPv4.

Se midió antes de escribirlo: en este contenedor —sin IPv6 en absoluto, `/proc/net/tcp6` ni existe—
Vite 5.4.21 se ata a `127.0.0.1` y contesta. O sea que **no está reproducido** que el fallo de
producción sea el IPv6; lo que sí está establecido es que el código lo suponía sin mirarlo. El
cambio quita la suposición y, si no era eso, el sondeo nuevo lo dice en la siguiente lectura.

Las pruebas usan un `/proc` de mentira precisamente porque el real no puede enseñar aquí lo que hay
que cubrir. Y encontraron un fallo de verdad al escribirlas: ordenar direcciones con `localeCompare`
pone `::1` antes que `127.0.0.1`, porque la collation no ordena la puntuación como se lee una
dirección.

### La construcción se paraba en la fase 1 cuando no había vista previa

Reportado como *«le pedí que hiciera una opción para verlo en español y no siguió; parece que cuando
el bot quiere seguir da error»*. No era el modelo: el guardián sólo pide la fase siguiente **después**
de que la vista previa esté lista, así que un servidor de desarrollo roto convertía «falta la vista
previa» en «el sitio se queda a medio construir», sin que nada dijera que el plan había terminado
antes de tiempo.

Dos cambios:

- El veredicto del runner (`server-timeout`) **corta la espera**. Antes cada lado esperaba en su
  propio reloj y sólo el runner podía saber algo: él vigila los procesos y sondea los puertos. Que
  el navegador agotara diez minutos más después de que el runner dijera «no viene» era esperar por
  esperar.
- Cuando la vista previa no llega y **la fase sí escribió archivos**, el plan avanza igualmente y el
  aviso lo dice. La regla de coste no cambia: una fase que no escribe nada sigue sin avanzar, y
  `MAX_PHASES` sigue siendo 6. Publicar tampoco necesita el servidor de desarrollo, así que un sitio
  terminado por este camino se puede poner online igual.

## 0 ter. El cuelgue de la pestaña — resuelto, y no era la pestaña

Lo que dijo el usuario: *"cuando regreso a la pestaña se cuelga... creo que es porque se descarga
todo a la vez y cuando son muchos recursos da error, porque si me quedo todo el rato con la pestaña
abierta no hay error"*.

En este proyecto ya hay dos hipótesis muy razonables sobre esto que **costaron un despliegue cada
una** por no medirlas antes (el `MutationObserver` y el coste de renderizar el código; ver §5). Así
que esta vez no se adivina. Lo que se leyó del código, y lo que descartó:

| Sospechoso | Por qué no cuadra |
|---|---|
| El backlog del stream procesado de golpe al volver | `createSampler` no lo mueve un temporizador sino la llegada de cada trozo, así que sigue funcionando con la pestaña oculta; el navegador estrangula los `setTimeout`, no el flujo que los dispara |
| `useStickToBottom` acumulando cadenas de `requestAnimationFrame` | sus disparadores son `ResizeObserver` y `scroll`, que el navegador entrega **dentro** del ciclo de pintado y por tanto también suspende: al volver llega una notificación, no cien |
| La salida del terminal desbordando xterm | el runner arranca los proyectos con `CI=true` y `FORCE_COLOR=0`, así que `npm install` no imprime barras de progreso; el volumen es modesto |
| `debugLogger` capturando cada trozo del terminal | trabajo real pero microscópico: un `import()` ya cacheado y un regex por trozo, del orden de decenas de ms en toda una generación |

Lo que **sí** queda en pie es un mecanismo que el código no puede confirmar solo: Chromium
**congela** una pestaña de fondo (Page Lifecycle), y una pestaña congelada no ejecuta nada — todo lo
que mandaron el runner y el modelo sigue en cola y **entra de golpe al volver**. Eso es exactamente
lo que describe el usuario. Pero una pestaña meramente estrangulada se comporta parecido desde fuera
y pide un arreglo distinto.

`app/lib/cresova/tab-suspension.ts` mide precisamente eso, y sale en el botón Diagnóstico:

- si el navegador llegó a **congelar** la pestaña (eventos `freeze`/`resume`);
- cuántas **tareas largas** hubo en los 15 s siguientes a volver, cuánto bloquearon en total y cuál
  fue la mayor — «Page Unresponsive» *es* un hilo principal retenido, así que esto lo cuantifica;
- cuántos mensajes y KB mandó el runner mientras nadie miraba.

Sólo cuenta tamaños, nunca contenidos: el informe está pensado para pegarse en una conversación.

Y una mitigación que no depende del diagnóstico para justificarse: `useChat` va ahora con
`experimental_throttle: 100`. Sin él, cada trozo del modelo re-renderiza la lista de mensajes entera
y vuelve a analizar el markdown de un mensaje que sólo crece — el coste de un turno sube con el
**cuadrado** de su longitud, y cada render deja estilo, disposición y pintado pendientes, que es
justo el trabajo que una pestaña oculta no puede quitarse de encima. Es menos trabajo en cualquier
caso; **no es una afirmación de haber encontrado la causa.**

### La causa, encontrada: un escaneo cuadrático en el lector del shell (build 209)

La segunda lectura la puso encima de la mesa con nombre y apellidos:

```
tareas largas en toda la sesión: 1258 (242530 ms bloqueado)
quién retuvo el hilo, de mayor a menor:
  204109 ms en 785 veces — ReadableStreamDefaultReader.read.then · Header-BL6qiV7W.js
   26663 ms en 449 veces — MessagePort.onmessage · components-CE_o6jZX.js
```

**204 segundos en 785 trozos: 260 ms de media por trozo de salida del shell.** Y el culpable estaba
en `waitTillOscCode`, el bucle que lee la salida del shell esperando la marca de fin de comando:

```js
buffer += text;                          // nunca se recorta
const expoUrlMatch = buffer.match(expoUrlRegex);   // recorre TODO el buffer, en cada trozo
```

Cuadrático en el tamaño de la salida. `npm install` imprime cientos de kilobytes, así que cada trozo
costaba más que el anterior, y el regex `(exp:\/\/[^\s]+)` sin coincidencia obliga al motor a
probar desde cada posición.

**Y no hacía falta nada de ello.** `_watchExpoUrlInBackground` ya vigila su propio *tee* del mismo
stream buscando exactamente la misma URL —y lo hace con el buffer acotado a 2048 caracteres. Alguien
copió el bloque y en una de las dos copias se perdió el recorte. El arreglo es **borrar la copia**,
no acotarla.

Detalles que conviene retener:

- **El cuelgue no era de la pestaña en segundo plano.** Pasa mientras el modelo genera y el proyecto
  instala, se mire o no. Las ventanas «tras volver» de la lectura anterior daban alto simplemente
  porque coincidían con una generación en curso; en esta lectura, con las vueltas fuera de una
  generación, dan **0 tareas largas**. La correlación con «cambiar de pestaña» era casualidad, y sin
  la atribución por función habríamos seguido persiguiéndola.
- **`longtask` no habría bastado nunca.** Dice que una tarea fue larga, no de quién. Tres lecturas
  costó llegar aquí y la que lo resolvió fue la que traía el nombre.

### La primera lectura real, y qué descartó

Llegó con el build 207 y vale la pena copiarla entera, porque **descarta la hipótesis de partida**:

```
el navegador llegó a congelarla: no
tareas largas en toda la sesión: 2214 (186558 ms bloqueado)
  tras 57 s fuera: 147 tareas largas, 11931 ms, la mayor de 301 ms
                   del runner mientras estuvo fuera: 15 mensajes, 0 KB
  tras 32 s fuera:  83 tareas largas,  8350 ms, la mayor de 236 ms
                   del runner mientras estuvo fuera:  0 mensajes, 0 KB
```

Tres cosas quedan establecidas:

1. **No hay avalancha.** La pestaña nunca se congeló y el runner no mandó prácticamente nada
   mientras estuvo de fondo — **0 KB**. La explicación de partida («se descarga todo a la vez») es
   falsa, y buscar por ahí habría costado otra ronda.
2. **El bloqueo es real y es enorme.** 186 segundos de hilo principal retenido en unos once minutos:
   el 28 % de toda la sesión. En los 15 s siguientes a volver de una ausencia larga sube al **80 %**.
   Eso es exactamente lo que el navegador reporta como «Page Unresponsive».
3. **La forma no es la de un vaciado de cola.** No es una tarea gigante sino ~10 tareas de ~80 ms por
   segundo, sostenidas. Eso es trabajo que se repite, no un atasco que se drena. Y escala con el
   tiempo fuera (57 s fuera → 11,9 s de bloqueo; 32 s → 8,4 s), lo que sí apunta a algo acumulado —
   pero acumulado **en el navegador**, no en la red.

Un hueco del instrumento que conviene saber: cuenta los bytes del **runner**, no los del stream del
modelo, que llega por un `fetch` aparte. Si lo acumulado es el stream, esta medición no lo ve.

**Lo que falta, y lo que se añadió para conseguirlo.** `longtask` dice que una tarea fue larga; no
dice de quién. `long-animation-frame` sí: nombra la función, el archivo y qué la invocó. El informe
lleva ahora las cinco que más hilo retuvieron, con su total y cuántas veces. Sólo Chromium reciente,
así que los recuentos de `longtask` se quedan como la lectura que siempre funciona.

Con un nombre encima de esos 186 segundos, el arreglo deja de ser una elección a ciegas.

### El método que funcionó, y el que no

Se perdieron horas persiguiendo la vista previa en el runner. No había vista previa porque no había
servidor; no había servidor porque no había acción `start`; no había acción `start` porque la
generación no llegaba a producir el artefacto. **El transporte estaba sano — no había carga que
transportar.** Cuando falta el último eslabón de una cadena, conviene comprobar el primero antes de
desarmar el resto.

Y dos hipótesis muy razonables —el `MutationObserver` sobre el documento, el coste de renderizar el
código— costaron un despliegue cada una **por no medirlas antes**. Cuando por fin se midieron, las
dos quedaron descartadas en minutos (§ el árbol de archivos). Medir primero es más barato que
desplegar y preguntar.

---

## 0 quater. Un proyecto que compila mal pero sirve (build 209)

Con la vista previa ya apareciendo, el sitio seguía sin verse **y** publicar fallaba. Una sola causa
para las dos cosas, y estaba en el proyecto generado, no en el transporte:

```
[vite] Pre-transform error: [postcss] src/index.css:76:5:
       @apply should not be used with the 'group' utility
```

`group` es un marcador de Tailwind, no una utilidad: no genera CSS, así que `@apply group` revienta.
El servidor de desarrollo arranca igual, **contesta igual**, y el módulo de CSS falla al
transformarse — con lo que `main.tsx` no puede importarlo y la página sale en blanco. `npm run build`
muere con el mismo error, y por eso publicar tampoco funcionaba.

Lo importante no es el fallo concreto sino su forma: **todas las señales de arriba leen sano**. El
sondeo obtiene respuesta, la vista previa se anuncia, el workbench la muestra viva. El motivo estaba
escrito en la salida del comando, en un panel que nadie tiene abierto.

Dos cambios:

- `dev-server-errors.ts` lee las quejas del propio servidor y el workbench las convierte en la alerta
  que **ya existía** y que trae el botón «Ask Bolt»: un clic devuelve el error al modelo. Sólo los
  prefijos que Vite usa para errores de verdad; cualquier cosa más laxa casa con el ruido normal de
  un install —avisos de auditoría, deprecaciones, browserslist— y una alerta que grita en falso es
  peor que ninguna.
- El contrato de ejecución le dice al modelo que `@apply` no admite `group`, `peer` ni `dark`.

Tres cosas que las pruebas encontraron al escribirlo, y que valen como patrón:

1. **Una línea a medias no se reporta.** La salida llega partida donde caiga; un marcador sin final
   de línea todavía es media frase, y reportarla dejaba al usuario un mensaje truncado *y* silenciaba
   el completo por duplicado.
2. **El solape entre trozos tapaba los errores nuevos.** Buscando la primera coincidencia, un error
   viejo que sigue en el solape gana siempre. Se busca la **última**, que además sale gratis usando
   `lastIndexOf` con marcadores literales en vez de regex.
3. **El deduplicado exige un texto estable.** Tomar «todo lo que sigue al marcador» cambia en cada
   trozo por culpa del solape, así que el mismo error nunca se parece a sí mismo. Se toma la línea.

Y el detector nace con su propia prueba de que no vuelve a ser cuadrático — que es justo el fallo que
esta misma tanda acaba de borrar del lector del shell.

## 0 quinquies. La vista previa, tercera causa: media cabecera (build 211)

La lectura del build 210 fue la más engañosa de todas, porque **todo estaba bien**:

```
vistas previas: 1
  https://cresova-04544854a85f953b.preview.cresova.com (lista: sí)
sirviendo en: ::1:5173
servidor anunciado: sí
último sondeo: contestó en [::1]:5173
```

Y aun así, «refused to connect». Comprobado desde fuera, sin tocar nada:

```
GET https://cresova-04544854a85f953b.preview.cresova.com/
HTTP/2 200 · content-type: text/html · content-length: 1597
cross-origin-resource-policy: cross-origin
```

Es decir: DNS, TLS, Traefik, el runner y Vite, todos correctos. Lo que faltaba era una cabecera, y es
la que el arreglo del build 199 (§5, «era COEP, no una conexión rechazada») dejó a medias.

**La regla completa son dos condiciones, no una.** Un marco de otro origen dentro de una página que
declara `Cross-Origin-Embedder-Policy` necesita:

1. `Cross-Origin-Resource-Policy: cross-origin` — bajo la política del que incrusta, la CORP del
   recurso pasa a valer `same-origin` por defecto, así que sin esto se bloquea como subrecurso.
2. **Su propia** `Cross-Origin-Embedder-Policy` — un documento anidado tiene que llevar una política
   compatible con la de su anfitrión.

Cumplir sólo la primera es exactamente lo que había, y el navegador lo reporta igual que no cumplir
ninguna: «refused to connect». Ese es el motivo de que el arreglo anterior pareciera correcto y de
que el síntoma no se moviera.

**Por qué `credentialless` y no `require-corp`.** Se midió antes de elegir: `images.pexels.com` y
`picsum.photos` **no** mandan CORP (`fonts.gstatic.com` sí). Bajo `require-corp` cada imagen de otro
origen dentro del sitio generado tendría que mandarla, así que habríamos cambiado un marco bloqueado
por sitios llenos de fotos rotas. `credentialless` carga esos recursos sin credenciales, que es todo
lo que una foto pública necesitó nunca.

**Y la otra capa: el builder deja de exigir aislamiento cuando no le hace falta.** El aislamiento
existe por una sola razón —WebContainer necesita `SharedArrayBuffer`— y con `RUNNER_URL` configurado
WebContainer es el respaldo, no el camino. `entry.server.tsx` sólo pone `COEP`/`COOP` cuando no hay
runner. El precio, dicho claro: en un despliegue con `RUNNER_URL`, si el runner no responde el
respaldo WebContainer tampoco arranca.

**La lección, que es la parte reusable, y la razón de la sección nueva del Diagnóstico:** las tres
causas de este mismo síntoma se diagnosticaron razonando sobre cabeceras en vez de leyendo las que
llegaron. Y no es lo mismo: entre el runner y el navegador hay un Traefik y un certificado comodín,
cualquiera de los dos podría estar cambiándolas. Ahora el botón Diagnóstico **pide la vista previa
desde la propia página** y escribe lo que recibió:

```
VISTA PREVIA, VISTA DESDE EL NAVEGADOR
  https://cresova-….preview.cresova.com
  contestó: 200
  cross-origin-embedder-policy: credentialless
  cross-origin-resource-policy: cross-origin
  el builder exige política de incrustación: no
  se puede incrustar: sí — el builder no impone ninguna condición
```

Para que el navegador pueda leer esas dos cabeceras hace falta que el runner las exponga
(`access-control-expose-headers`), que es lo único que se abrió: una URL de vista previa ya servía
páginas públicas a cualquiera que la tuviera, sin credenciales de por medio.

## 0 sexies. Lo que se le pidió a la herramienta, y qué se hizo (build 211)

Textual del usuario: *«al final se busca que se sienta como que estás hablando con un agente
constructor»*, *«debería quedarse la pestaña de Preview como primera, así como lo hace Lovable,
mostrando una animación como construyendo»*, y *«en el chat no creo que sea necesario que se muestre
los archivos que se están generando»*.

| Qué se pidió | Qué se hizo |
|---|---|
| Preview como primera pestaña | `currentView` arranca en `'preview'`, y `workbench.ts` deja de saltar a `'code'` cada vez que se escribe un archivo. El editor sigue seleccionando el archivo, así que quien abra Code lo encuentra donde estaba. |
| Animación de construcción | `PreviewBuilding.tsx` sustituye al «No preview available». Esqueleto de página con pulso CSS y una línea con la fase real. |
| El chat sin lista de archivos | La tarjeta del artefacto muestra una línea —«Escribiendo archivos · 7 de 14», «Sitio listo · 14 archivos»— y el acordeón ya no se abre solo. La lista entera sigue detrás del caret. |

Las dos superficies leen la misma función, `build-progress.ts`, precisamente para que no puedan
decir cosas distintas del mismo momento. Está aparte y sin importar `workbenchStore`, por la misma
razón que `action-failures.ts`: importar esa tienda abre la conexión con el runner como efecto del
import, y un módulo que abre un socket no se puede probar barato.

**Lo que la animación no arregla, y conviene no confundirlo:** que la construcción siga dependiendo
de que la pestaña esté delante. Eso es arquitectura, no interfaz — ver §7.

### El código que no se pintaba nunca, y sale en el mismo informe

`ERRORES DEL NAVEGADOR` del build 210 traía una línea sola: `Failed to fetch dynamically imported
module: …/ruby-DeZ3UC14.js (×26)`. Es el otro síntoma que reportó el usuario, *«ya no sale el código
como antes pero siempre da la impresión como que se muestra»*.

`CodeBlock.tsx` era el único sitio del repo que usaba el `codeToHtml` del paquete completo de shiki
—los otros tres ya usaban `createHighlighter` con `langs` explícitos—, y ese `codeToHtml` descarga la
gramática bajo demanda. La de `markdown` arrastra unas cuarenta gramáticas incrustadas, `ruby` entre
ellas. Con que **una** falle, la promesa se rechaza, el HTML se queda en `undefined` y el bloque no
pinta nada: un bloque que parece estar cargando para siempre. Y el ×26 no son 26 descargas: el
navegador memoriza el módulo que falló, así que todos los bloques siguientes fallan al instante y sin
tocar la red.

Ahora hay una lista cerrada de idiomas y un `try/catch` con reserva a texto plano. Un resaltador que
falla no puede dejar un hueco.

### Los dos sitios donde la pestaña de fondo rompía la vista previa

Medidos, no supuestos, y los dos son de una línea:

- `previews.ts`, `refreshPreview`: ponía `ready = false` y lo devolvía a `true` dentro de un
  `requestAnimationFrame`. **rAF no dispara en una pestaña oculta**, así que un refresco empezado de
  fondo dejaba la vista previa marcada como no lista para siempre — y todo lo de abajo filtra por
  `ready`. Al volver a la pestaña no había vista previa, y lo que la había perdido era el refresco,
  no la pestaña. Ahora es un `setTimeout(…, 0)`, que da la misma vuelta al bucle de eventos sin
  depender de que se pinte un fotograma.
- `sampler.ts`: la llamada de cola es un `setTimeout`, y en una pestaña oculta el navegador lo estira
  a un segundo, y a uno por minuto pasados cinco. Debajo de ese sampler están el analizador de
  mensajes y el flujo de acciones. Ahora se vacía lo pendiente en `visibilitychange`, que es el
  último instante en que algo está garantizado que corre a tiempo.

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

**Y el merge no se pregunta.** El usuario lo repitió, ya con fastidio: *"claro, siempre haz merge,
¿qué me andas preguntando?"*. Preguntar antes de cada fusión es fricción que él ya autorizó a saltarse
de una vez y para siempre. Terminar una tanda significa: rama, commit, PR, merge, y **avisar de qué
hay que redesplegar** — que es lo único que de verdad necesita de él al final.

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
| `tab-suspension.ts` | Mide qué le pasa a la pestaña mientras está de fondo: si la congelaron, cuánto bloqueó el hilo al volver, cuánto mandó el runner entretanto, y **qué función** lo retuvo. Sale en el botón Diagnóstico. |
| `dev-server-errors.ts` | Lee las quejas del servidor de desarrollo en su propia salida. Un proyecto que compila mal sigue sirviendo, así que ninguna otra señal lo nota. |
| `browser-errors.ts` | Recoge las excepciones no capturadas y las promesas rechazadas, siempre, desde que se abre el chat. Sale en el botón Diagnóstico. |
| `build-progress.ts` | Una sola lectura de «qué está haciendo el constructor ahora», en español. La leen el chat y el panel de vista previa, para que no puedan contradecirse. |
| `preview-embedding.ts` | Pide la vista previa desde la propia página y dice si el navegador **puede** incrustarla, con las cabeceras que recibió. Sale en el botón Diagnóstico. |

### `runner/`

| Archivo | Qué hace |
|---|---|
| `src/index.mjs` | Servidor HTTP + WebSocket. Proxy de vistas previas por cabecera Host. Verifica tickets. |
| `src/projects.mjs` | Un directorio y un puerto por proyecto. Puertos 41000–41999. Entorno con lista blanca. |
| `src/paths.mjs` | Confina toda ruta dentro del proyecto. |
| `src/tickets.mjs` | Firma y verificación HMAC-SHA256. |
| `src/ports.mjs` | Descubre por `/proc` **en qué dirección y puerto** escucha de verdad el proyecto. La dirección importa: un servidor en el bucle IPv6 rechaza todo lo que vaya a `127.0.0.1`. |

### Otros

- `app/lib/common/prompts/cresova-build-contract.ts` — contrato de ejecución para `chatMode === 'build'`.
- `app/lib/common/prompts/cresova-design-kit.ts` — menú cerrado de tipografías, tokens, paletas, iconos.
- `app/lib/.server/images/pexels.ts` — catálogo de fotos por sector.
- `app/routes/api.runner-ticket.ts` — emite los tickets.
- `scripts/update-version.mjs` + `app/version.json` — contador de compilación.
- `public/templates/*.json` — plantillas alojadas por nosotros, no en GitHub.
- `app/components/workbench/PreviewBuilding.tsx` — el esqueleto animado que llena el panel mientras no hay nada que enmarcar.

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

> **Corregido en el build 211: esto era la mitad del arreglo.** Un marco de otro origen necesita
> además **su propia** `Cross-Origin-Embedder-Policy`; con sólo la de recurso el navegador lo sigue
> rechazando, y con el mismo mensaje. Ver §0 quinquies. Lo que esta entrada dio por cerrado no lo
> estaba, y el síntoma no se movió durante tres builds por eso.

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

### La tipografía estaba elegida y nunca se cargó

La lección más cara de todas, y la que explica «se ve genérico y plano» entero.

Se miró el CSS compilado de un sitio real publicado (`parnaza`) en vez de teorizar sobre él. Y el
modelo **estaba cumpliendo el kit con precisión decimal**:

| El kit pide | El sitio tenía |
|---|---|
| `clamp(2.5rem, 5vw, 4.5rem)` en el titular | `clamp(2.5rem,5vw,4.5rem)` — exacto |
| `clamp(1.75rem, 3vw, 2.5rem)` en secciones | `clamp(1.75rem,3vw,2.5rem)` — exacto |
| `tracking -0.02em` | `letter-spacing:-.02em` |
| Secciones a 96 / 128 px | `padding: 6rem` y `8rem` |
| Un par del menú cerrado | `Instrument Sans` + `Public Sans` |

Y aun así se veía mal, por una sola cosa:

```
font-family: Instrument Sans, system-ui, sans-serif
```

**Esa fuente no se cargaba en ninguna parte.** Cero apariciones de `fonts.googleapis`,
`fonts.gstatic`, `@font-face` o `.woff` en el HTML publicado, en el CSS compilado y en el bundle de
JS. El navegador leía `Instrument Sans`, no la tenía, y caía a `system-ui`.

Todos los sitios generados hasta el build 216 se vieron **con la fuente del sistema**, diera igual
qué par eligiera el modelo.

Y la culpa era del kit, no del modelo. Decía:

> TYPE PAIRINGS (Google Fonts, pick one, never Inter + Playfair Display):

Los llamaba «Google Fonts», los nombraba, y **nunca decía que hubiera que cargarlos**. El modelo
obedeció exactamente lo que se le pidió.

**La lección, y van cuatro:** `PORT`, `127.0.0.1`, el techo de 8192, y ahora esto. Siempre lo mismo
— **algo especificado, nunca verificado, que en silencio no ocurre**. Y siempre con una explicación
convincente encima que manda la investigación a otro sitio: aquí llegó a acusarse al modelo.

*Una elección de diseño que no se carga es una elección que no existe.*

El corolario práctico, que es lo que se hizo: no dar la regla general («carga la tipografía»), dar
**la URL literal de cada pareja**, verificada contra Google Fonts antes de escribirla. Mismo motivo
por el que la lista de iconos de lucide es cerrada — un modelo que compone una URL se inventa los
pesos; uno que la copia, no.

### El modelo cumple los números y se salta la prosa

Corolario del anterior, medido en el mismo CSS. El kit pide una medida de lectura —`max-w-[65ch]`,
«los párrafos a todo el ancho se leen como sin terminar»— y **no aparecía por ninguna parte**,
mientras que todos los valores numéricos concretos sí estaban.

El patrón es claro: lo que está en forma de valor (`clamp(...)`, `-0.02em`, `96px`) se cumple; lo
que está en forma de prosa dentro de setenta líneas densas se pierde.

Por eso el kit termina ahora con una lista corta de comprobación, en imperativo, sólo de lo que se
ve de un vistazo en el archivo terminado. Lo que ya funcionaba se deja como está.

### Una utilidad de Tailwind que parece real y no existe

`@apply group` fue la primera versión de esta trampa y decírselo al modelo bastó. Ésta es la
segunda, y la regla que había **no la cubría**:

```
The `duration-350` class does not exist.
  .product-card {
    @apply relative bg-white rounded-card shadow-card border border-black/5
           transition-all duration-350 ease-out cursor-pointer
```

`rounded-card` y `shadow-card` **sí** existían: el modelo las había añadido a `theme.extend`.
`duration-350` no, y la escala por defecto de Tailwind es 75 100 150 200 300 500 700 1000. Extendió
unas claves del tema y no otras, y luego usó las cuatro como si todas existieran.

El contrato ya decía «todo lo que pongas en `@apply` tiene que ser una utilidad que produzca
declaraciones». Es cierto y no sirve aquí: `duration-350` **parece** exactamente eso. No es un
fallo de categoría como `group`, es un fallo de existencia — un número elegido a ojo dentro de una
escala cerrada.

La regla nueva da la salida segura en vez de pedir memoria: **dentro de una hoja de estilo, para
cualquier número que elijas tú, CSS plano** (`transition-duration: 350ms`), y `@apply` sólo para
utilidades que no te has inventado.

### El arreglo de shiki del build 211 fue la mitad

`CodeBlock.tsx` era **un** sitio que cargaba gramáticas bajo demanda. `DiffView.tsx` era el otro, y
siguió cargando diecisiete —php, ruby, java, c, cpp, csharp, go, rust incluidas— para un constructor
que escribe React y TypeScript. Las dos que han fallado en producción, `ruby` en el build 210 y
`php` en el 214, estaban las dos en esa lista.

Y había un detalle peor que el desperdicio: `getSharedHighlighter` guardaba la promesa en
`highlighterPromise` y sólo la limpiaba **al resolverse**. Una que fallara quedaba cacheada como
rechazo para el resto de la vida de la página, y cada llamada posterior devolvía el mismo rechazo
sin tocar la red. De ahí el `(×31)` del informe: un fallo real y treinta ecos.

**Por qué fallan, probablemente:** los chunks llevan hash en el nombre. Al redesplegar `bolt-diy`
con una pestaña abierta, los viejos desaparecen del servidor y la siguiente importación perezosa da
404. Encaja con que sea una gramática distinta cada vez y con que empezara justo en la tanda de
redesplegar cada media hora. **Una recarga fuerte tras cada redespliegue lo evita.**

### El coste del hilo subió, y es la contrapartida de escribir de una vez

Tras el build 214: **717 tareas largas, 53 s bloqueados**, 42 de ellos en
`ReadableStreamDefaultReader.read.then`. Antes eran ~16 tareas y 1,8 s. No es una regresión: es lo
que cuesta streamear 31 archivos en una pasada en lugar de 2 con fases.

No se toca —la pestaña no se congeló y las vueltas del segundo plano fueron limpias— pero queda
medido. Si empeora, el lector del shell es donde mirar, y ya se le borró un escaneo cuadrático una
vez (§0 ter).

### Nadie contaba el total, y por ahí se coló un bucle

Cada mecanismo que se pide un turno a sí mismo está acotado: la recuperación de artefacto permite
**uno** (`MAX_RECOVERY_ATTEMPTS`), el plan para en `MAX_PHASES = 6`. Y aun así el usuario vio la
misma respuesta veinte veces seguidas, cada vuelta una llamada pagada a OpenRouter.

Lo que empezó todo fue un error de verdad, y de los conocidos:

```
Failed to resolve import "./components/AINetwork" from "src/App.tsx". Does the file exist?
```

El modelo escribió `App.tsx` importando un componente que nunca llegó a crear — la firma del corte
por límite de salida. El usuario pulsó «Fix this terminal error», y a partir de ahí el builder se
quedó dando vueltas.

**El agujero no era ninguno de los contadores: era que ninguno contaba el total.** Un presupuesto
por mecanismo es justo lo que un bucle derrota, porque cada vuelta parece un turno nuevo y correcto.

Por eso `auto-turn-budget.ts` cuenta **turnos automáticos por petición**, sin mirar quién los pide.
Ocho: seis fases más una recuperación más uno de holgura. Y guarda el motivo de cada uno, que es lo
que de verdad faltó — veinte vueltas idénticas y ninguna forma de saber quién las pedía.

Dos decisiones que importan:

- **Nunca bloquea a la persona.** Lo que se agota es la licencia del builder para hablar consigo
  mismo. El usuario puede seguir escribiendo, y justo cuando salta el tope es cuando hace falta.
- **Se reinicia sólo en `sendMessage`**, el único sitio donde hay una intención humana nueva. El
  `append()` de la recuperación no pasa por ahí, y ése es exactamente el motivo de que el
  presupuesto no se recargue solo.

**La causa del bucle sigue sin identificar**, y el arreglo está diseñado para no necesitarla. Si se
hubiera acotado sólo el mecanismo que ya se entendía, no habría parado éste.

### Una acción `start` que corre es un servidor **sano**, no uno arrancando

La trampa más barata de caer y de las más caras de leer, porque el síntoma dice justo lo contrario
de lo que pasa.

`action-runner.ts` arranca el servidor de desarrollo **sin bloquear**, a propósito:

```js
this.#runStartAction(action).then(() => this.#updateAction(actionId, { status: 'complete' }))
```

Esa promesa se resuelve **cuando el proceso muere**. Un servidor que sirve no muere, así que la
acción se queda en `status: 'running'` durante toda la vida del proyecto. Leerlo como «todavía está
arrancando» es leerlo al revés: cuanto más sano está el servidor, más tiempo dura el mensaje.

El código lo sabía y lo decía en `Artifact.tsx`:

```js
!(action.type === 'start' && action.status === 'running')
```

Esa línea se perdió al reescribir la tarjeta del chat en el build 211, y el resultado fue el chat
anunciando «Arrancando el servidor» con la vista previa ya viva al lado, y el usuario preguntando
—con razón— qué se había roto en la generación. No se había roto nada: el diagnóstico de esa misma
sesión traía `servidor anunciado: sí`, `contestó en [::1]:5174` y `vistas previas: 1 (lista: sí)`.

Ahora vive en `build-progress.ts` con nombre propio, `isSettledStart`, y una prueba que falla si
alguien la vuelve a quitar (comprobado: contra el código del 211 fallan 4 de las 12).

**Y la lección de fondo, que es más grande que esta regla:** un hecho terminal —hay vista previa—
tiene que ganar siempre a una señal en vuelo. La primera versión resolvía las dos cosas en una sola
cadena de condiciones, así que cualquier acción que se quedara a medias tapaba el hecho de que el
sitio ya estaba en pie. Ahora son dos ramas: si el turno sigue abierto se nombra lo que está en
marcha; si terminó, se reporta el desenlace y **nunca** un spinner.

### Una tarjeta habla de su turno, no del sitio

Corolario del anterior, y el motivo de que se vieran **dos** tarjetas construyendo a la vez.

`Artifact.tsx` se dibuja una vez por artefacto y lee `artifact.runner.actions`, que son las acciones
de **ese turno**. Pero se le pasaba el `streaming` global, así que un artefacto cerrado del turno 1
se creía en marcha en cuanto el turno 3 empezaba a escribir.

El turno abierto es `!artifact.closed && streaming`, y hacen falta las dos mitades: `closed` no llega
nunca si la respuesta se corta a mitad de artefacto —`onArtifactClose` no se emite—, así que el fin
del streaming tiene que cerrar el turno igualmente. Con una sola de las dos, una respuesta truncada
deja la tarjeta girando para siempre.

De ahí sale también la fase `truncated`: un turno que acaba con acciones de archivo sin cerrar es la
firma del corte por límite de salida, la causa raíz de §5 más abajo. Antes era un spinner en una fila
dentro de una lista plegada; ahora se dice en una línea, sin alarma —el turno siguiente suele
reescribir el archivo— pero sin fingir que se sigue trabajando.

### Un puerto abierto no es una vista previa que funcione

Vite abre su puerto y **después** resuelve dependencias, así que la primera petición puede llegar
antes de que haya algo que responder. Anunciar `server-ready` en cuanto aparece el puerto ponía una
página en blanco delante del usuario que sólo se arreglaba recargando a mano. Ahora el runner hace
una petición HTTP real antes de anunciar: cuesta nada y de paso calienta el servidor, así que la
primera carga del navegador es la segunda petición, no la primera.

### Tres servidores a la vez, y el runner eligiendo siempre el muerto

El botón de diagnóstico dio la respuesta en su primer uso real:

```
procesos vivos: 3
puertos escuchando: 5173, 5175, 5174
puerto sirviendo: ninguno todavía
último sondeo: abrió el puerto 5173 pero no contestó una petición HTTP
```

Tres servidores del mismo proyecto. Son **dos fallos que se suman**, y hacía falta verlos juntos.

**1. Abrir un proyecto reconstruía todo otra vez.** Al reabrir un chat se re-analizan sus mensajes
guardados y **cada acción vuelve a ejecutarse**: reescribe los archivos, repite el `npm install` y
levanta otro servidor. `#reloadedMessages` existía pero sólo silenciaba **alertas**, no impedía la
ejecución.

No es un descuido: bajo WebContainer **es la única forma** de que el proyecto vuelva, porque el
contenedor muere con la pestaña. En el runner los archivos sobreviven, así que ahí sobra — salvo
cuando el proyecto fue reciclado por inactividad, que es justo cuando hace falta. Por eso la regla
no es «no reproducir en el runner» sino **«no reproducir si el proyecto ya tiene archivos»**, y el
runner lo dice en el `ready` del apretón de manos, antes de que el navegador decida nada.

**2. Se elegía el puerto más bajo, que es el más viejo.** `findServingPort` tomaba `Math.min(...)`.
Vite intenta 5173 y sube cuando lo encuentra ocupado, así que el número más bajo es el **primer**
servidor: el más viejo y el más probable de estar atascado. El sondeo lo re-elegía cada medio
segundo hasta rendirse, con un servidor sano a un número de distancia.

Ahora se devuelven **candidatos** y se le pregunta a cada uno por una página: cuál está *abierto*
deja de ser la pregunta, la útil es cuál **contesta**. `preferred` sigue primero, porque un
framework que respeta `PORT` está diciendo dónde está.

La prueba usa la disposición difícil a propósito —el atascado en el puerto **alto**, el sano en el
bajo— porque los candidatos se prueban de mayor a menor: sólo pasa si un puerto que no contesta es
seguido por el siguiente en vez de terminar la búsqueda.

### Un botón de diagnóstico, porque las lecturas sueltas no servían

Diagnosticar la vista previa costó horas de ida y vuelta pidiendo comandos de a uno: mira los
puertos, mira los procesos, pega el log. Y el problema no era la falta de datos sino **cuándo** se
tomaban: las lecturas sólo significan algo **juntas y en el mismo instante**.

- Un proceso vivo **sin ningún puerto abierto** es un comando que nunca arrancó.
- Un puerto abierto **que no contesta** es un servidor que arrancó y se atascó.

Son fallos opuestos y piden arreglos opuestos. Recogidas por separado y con horas de diferencia, el
proyecto ya se había reciclado antes de completar el juego — pasó exactamente así más de una vez.

`diagnostics` en el runner devuelve todo de una: procesos vivos, puertos escuchando, puerto
asignado frente a puerto sirviendo, si el vigilante sigue buscando, el último sondeo, el último
comando y qué hay publicado. El botón de la cabecera lo junta con lo que cree el navegador —backend
en uso, archivos, vistas previas— y lo copia como texto para pegar en el chat.

Dos decisiones que importan:

- **No lleva entorno ni contenido de archivos.** Está pensado para pegarse en una conversación, y el
  entorno es donde viven las credenciales. Una prueba lo fija comprobando que la respuesta no
  contenga nada con forma de clave — la lección de haber pedido un `ps` que imprimió tres.
- **No se esconde detrás de la vista previa**, como sí hacen los botones vecinos. El momento en que
  vale la pena pulsarlo es justo el momento en que no hay vista previa.

No se extendió `debugLogger` (1284 líneas heredadas de bolt.diy): produce un volcado JSON genérico
que no sabe nada del runner, que es donde estaban todas las respuestas.

**Y en el build 210 se retiró su botón del header**, al leerlo de verdad. Su volcado sale casi vacío
en una sesión normal, y por diseño: los errores, la consola y la red sólo se capturan cuando alguien
enciende el modo debug en los ajustes, cosa que nadie hace **antes** del fallo que quiere capturar.
`generateDebugLog` enciende la captura, recoge y la vuelve a apagar, así que informa de los errores
del instante en que no pasaba nada. Peor todavía, su bloque de estado del workbench lee
`window.__bolt_workbench_store`, un global que **no existe en este proyecto**: devuelve siempre los
mismos valores por defecto —sin vista previa, sin archivos— tenga razón o no. Una lectura que miente
con confianza es más cara que una que falta.

Lo único suyo que sí se llena es el historial de la terminal, porque `shell.ts` lo alimenta esté el
modo debug encendido o no. Eso pasó a «Diagnóstico», junto con una captura de errores propia que
escucha desde que se abre el chat — que es la única forma de atrapar algo que no se reproduce a
pedido. La descarga completa sigue en el menú de usuario para quien la quiera.

### El árbol de archivos llevaba el lockfile, y midiendo se descartaron dos teorías

`fs.tree` manda **todos los archivos con contenido** después de **cada comando**, y excluía
`node_modules`, `.git` y `dist` pero **no el lockfile**. En un proyecto Vite+React eso es entre 500 KB
y 1.5 MB reenviados una y otra vez para descubrir, casi siempre, que no cambió nada. Y no lo quiere
nadie: el navegador no lo muestra, y `sanitizeText` ya lo borra de lo que llega al modelo — se
transportaba sólo para tirarlo al otro lado.

Se excluye entero en vez de listarlo sin contenido: una entrada sin contenido llega al almacén como
**archivo vacío**, y un archivo que el workbench cree vacío es peor que uno del que nunca supo.

**Lo importante de este apartado es lo que la medición descartó.** La sospecha era que descargar el
árbol y renderizar el código durante la generación causaba los cuelgues de pestaña. Medido:

| | |
|---|---|
| Parsear un árbol de 444 KB (`JSON.parse` + `TextEncoder`) | **0.9 ms** |
| `diffLines` de un archivo de 2000 líneas, 100 recálculos | **77 ms en total** |

Ninguno de los dos se acerca a los segundos de bloqueo que produce un «Page Unresponsive». Quitar el
lockfile es una mejora de **ancho de banda, no de CPU**, y conviene no venderla como otra cosa. La
causa del cuelgue sigue **sin identificar**; el único sospechoso de esa lista que no se pudo medir
aquí es el re-render de CodeMirror, que necesita las dependencias de la aplicación.

### «Bolt failed to select files»: elegir nada se trataba como fallo

Antes de generar, `selectContext` hace una llamada aparte al modelo para decidir qué archivos entran
en el buffer de contexto. Su propio prompt dice **dos veces** que si no hace falta cambiar nada se
puede devolver el bloque vacío… y después el código lanzaba un error fatal justo con esa respuesta:

```js
if (totalFiles == 0) {
  throw new Error(`Bolt failed to select files`);
}
```

La petición moría **antes de generar un solo token**. Desde fuera se ve como un modelo que no
responde, que es exactamente como se reportó: *«le mandé mensaje y no respondió»*.

Y hay una segunda vía, más silenciosa, hacia el mismo cero: `filteredFiles` sólo acumula lo
**nuevo**, porque lo que ya está en el buffer se salta unas líneas antes. Un modelo que elige
correctamente los archivos que necesita, todos ya cargados, produce cero — su acierto reportado como
fallo. Con un proyecto de 3 archivos eso deja de ser un caso raro y pasa a ser lo normal.

Ahora cero significa «el buffer está bien como está» y se devuelve el buffer vigente, ya con las
exclusiones aplicadas.

**Lo que este fallo enseñó del método:** se pasaron horas buscando en el runner por qué no había
vista previa. No había vista previa porque no había servidor; no había servidor porque no había
acción `start`; no había acción `start` porque la generación no llegaba a producir el artefacto. El
transporte estaba sano — no había carga que transportar. Cuando falta el último eslabón de una
cadena, conviene comprobar el primero antes de desarmar el resto.

### El arreglo del volumen estaba inerte porque la imagen fijaba la variable

Cambiar el **default** de `PUBLISHED_ROOT` no sirvió de nada: `runner/Dockerfile` traía
`ENV ... PUBLISHED_ROOT=/data/published`, y una variable puesta en la imagen gana siempre sobre un
valor por defecto del código. El arreglo se fusionó, se desplegó, y los sitios publicados **seguían
en la capa efímera del contenedor**.

La lección es general y vale para cualquier `X = process.env.X || <default>`: el default sólo manda
si nadie puso la variable, y aquí hay **tres sitios** donde puede aparecer —el Dockerfile, el
entorno del servicio en EasyPanel, y `docker-compose.yaml`—. Arreglar el default sin mirar los tres
es arreglar la mitad que no se estaba usando.

Ahora el Dockerfile **no** la fija, con un comentario que explica por qué no volver a ponerla.

### El contador de compilación llevaba días parado

La insignia del header es **cómo se comprueba que un despliegue llegó**. Estuvo clavada en 197
mientras se fusionaban cuatro PR, y eso hizo perder tiempo real: no había forma de distinguir «se
desplegó y no arregló nada» de «no se desplegó».

Dos causas, las dos hay que tenerlas presentes:

1. **El hook no corre en todas partes.** El número lo escribe `.husky/pre-commit`, y un commit hecho
   donde husky no está instalado —CI, otra máquina, un agente— se lo salta **en silencio**. Un hook
   de git no se puede imponer desde el repositorio.
2. **El número no era monótono.** Salía de `git rev-list --count HEAD`, que cuenta el HEAD de quien
   commitea; los PR entran aquí aplastados, así que una rama tiene más commits que la historia en la
   que colapsan. Tomado al pie de la letra iba **hacia atrás**: 197 en el archivo, 88 en `main`. Un
   contador que retrocede es peor que uno parado, porque quien mira la insignia concluye que está
   viendo una versión vieja.

`update-version.mjs` toma ahora `max(cuenta de git, valor anterior + 1)`: sube siempre, venga de
donde venga, y funciona incluso sin repositorio que consultar.

**Y la parte de proceso, que es la que falla sola:** si commiteas donde husky no está instalado,
corre `node scripts/update-version.mjs` a mano antes de commitear. No hay forma de que el repositorio
lo garantice por ti.

### El runner ahora dice qué vio, no sólo que se rindió

«No llegó a estar listo» deja indistinguibles los dos fallos posibles, y piden investigaciones
opuestas: un servidor que **nunca abrió un puerto** es un comando que falló o un framework que no
arrancó; uno que **abrió el puerto y no contestó** arrancó y se atascó. El log decía sólo que la
espera terminó, así que cada caso costaba otra ronda de conjeturas.

Ahora el mensaje lleva lo observado en el último sondeo: *«ningún proceso del proyecto tenía un
puerto escuchando»* o *«abrió el puerto N pero no contestó una petición HTTP»*. El evento
`server-timeout` lleva el mismo dato al navegador.

Pendiente de cerrar con esa información: un proyecto real estuvo **30 minutos con el proceso vivo
sin llegar a servir**, y los dos sintomas —el sondeo que nunca daba verde y el proxy que se colgaba—
encajan con un servidor que abre su puerto y no contesta. Falta confirmarlo con el mensaje nuevo.

### Un redespliegue borraba los sitios publicados

`PUBLISHED_ROOT` caía por defecto en `/data/published`. Se lee como «al lado de los proyectos», y es
justo lo que no es: el volumen está montado en `/data/projects` y en ningún otro sitio, así que ese
directorio vivía en la capa de escritura del contenedor. **Cada redespliegue del runner borraba todo
lo publicado**, sin nada que pudiera devolverlo — los archivos compilados son el registro entero de
una publicación.

Pasó de verdad: un sitio publicado desde el builder desapareció en el siguiente despliegue del
servicio.

El default ahora cae **dentro** de `PROJECT_ROOT`, que es la parte que sí está en el volumen. El
punto inicial lo mantiene fuera del espacio de nombres de los proyectos: `isValidProjectId` rechaza
cualquier nombre que empiece por punto, así que ningún proyecto puede recibir esa ruta.
`PUBLISHED_ROOT` sigue mandando si alguien monta su propio volumen.

**La lección, que es la parte reusable:** esto se había detectado horas antes y se anotó como
pendiente de configuración en vez de arreglarse. Era un default peligroso del código, no un descuido
del panel. Un valor por defecto que sólo es correcto si alguien recuerda montar un segundo volumen
no es un pendiente: es un fallo esperando su turno.

### Republicar parecía imposible, y eran dos cosas distintas

Del lado del runner republicar siempre funcionó — se comprobó publicando dos veces con el mismo
nombre y verificando que el sitio servido cambiaba. Lo que fallaba estaba a los lados.

**La caché.** `servePublished` no mandaba nada sobre frescura, así que el navegador cacheaba por
heurística. La página que alguien vuelve a publicar para enseñar lo que cambió es justo la que el
navegador le devuelve **sin cambiar**, desde caché. Visto desde fuera es idéntico a que publicar no
haya funcionado, y así se reportó. Ahora va `cache-control: no-cache`, y a todo, no sólo al HTML:
Vite pone huella a lo que compila en `assets/`, pero lo que el proyecto guarde en `public/` se copia
con su propio nombre y cachearlo fuerte devolvería el mismo problema por otra puerta.

**El diálogo.** Tras publicar, la vista de éxito terminaba en «Cerrar»: para volver al formulario
había que cerrar y reabrir. Volver a publicar es lo normal —se construye el sitio, se enseña, piden
un cambio, se quiere el mismo enlace— así que ahora hay un botón «Publicar de nuevo con los
cambios» ahí mismo.

### El 502 que no era del runner

Diagnosticado desde fuera, y el método vale tanto como el hallazgo: se probaron cinco nombres bajo
el comodín. Cuatro contestaron **con** `cross-origin-resource-policy` — o sea, los contestó el
runner. El quinto, el del proyecto que sí existía, devolvió un 502 **sin** esa cabecera y con la
página de error de EasyPanel. Esa cabecera es la firma del runner: si falta, la petición ni le
llegó. DNS, TLS, el comodín y Traefik estaban perfectos; el problema estaba dentro.

Lo que pasaba: el proxy reenvía al servidor del proyecto y **no tenía plazo**. Un servidor de
desarrollo atascado en su primera compilación acepta la conexión y se queda callado, así que el
runner sostenía la petición abierta sin nada que la cortara, hasta que la pasarela de delante se
cansaba y servía su propio error. El usuario veía un 502 genérico de un servicio que ni siquiera
había opinado, y el mensaje del runner —que existe y explica el problema— no llegaba a ejecutarse.

Y la rama del 502 **no llevaba `EMBEDDABLE`**. Las otras tres del enrutado por Host sí; a esta se le
pasó. Bajo la política COEP del builder, una respuesta sin esa cabecera se bloquea antes de
pintarse: una explicación que no se puede leer dentro del marco vale lo mismo que ninguna. Es
exactamente el fallo que ya estaba documentado más arriba, sobreviviendo en la cuarta rama.

`ready-watcher.spec.mjs` lo fija con un servidor que acepta y nunca contesta: la respuesta llega en
15 s, con el mensaje del runner y con la cabecera. Las dos mitades de ese archivo viven juntas a
propósito — vitest paraleliza archivos pero serializa dentro de uno, y separadas competían por el
rango de puertos 41000-41999: el sondeo de una alcanzaba el servidor deliberadamente mudo de la
otra.

### El «StreamRecoveryManager» que no recuperaba nada

Cuando OpenRouter enruta a un proveedor que se cuelga, el modelo deja de mandar tokens y no avisa.
`api.chat.ts` lo detecta con un vigilante de 180 s — eso estaba bien. Lo que no estaba bien es lo que
hacía después.

`StreamRecoveryManager` lleva `_retryCount`, `maxRetries`, `onRecovery`, y escribe *«Attempting
stream recovery»* en el log. No reintenta nunca: lo único que hace su `_handleTimeout` es llamar a
`onTimeout`, y en `api.chat.ts` ese callback **aborta la petición**. `maxRetries: 1` no significaba
«reintenta una vez», significaba «aborta en el primer timeout». Es el mismo patrón que ya estaba
documentado del handler viejo que «sólo registraba *attempting recovery* sin recuperar nada»: quedó
a medio arreglar, y el nombre siguió mintiendo.

Ahora sí reintenta, **una sola vez y sólo cuando no llegó nada**. Esa condición es la que hace que
sea seguro: si el modelo todavía no escribió un carácter, volver a preguntar no puede duplicar nada
porque no hay nada en pantalla que duplicar. En cuanto llega el primer `text-delta`, `receivedOutput`
se pone en `true` y un cuelgue posterior vuelve a terminar la petición como antes — reintentar ahí
repetiría trabajo ya mostrado.

Dos cosas que el reintento tiene que respetar y por las que el código es más largo de lo que parece:

1. **El intento colgado hay que soltarlo**, no dejarlo corriendo. Cada intento lleva su propio
   `AbortController` para poder abortarlo sin abortar la petición entera.
2. **Un rezagado no puede escribir en una respuesta que ya siguió sin él.** Cada intento lleva su
   número, y sólo el intento vigente puede reportar un fallo o dar la respuesta por terminada. Sin
   eso, abortar el intento 1 haría que su propio error cerrara la respuesta del intento 2.

Y como abortar hace que el `for await` lance, el bucle va dentro de un `try/catch` que distingue «me
abortaron a propósito» de un fallo real.

**Sin verificar en ejecución.** Un cuelgue de OpenRouter no se reproduce a pedido, y las
dependencias de la app no se pueden instalar donde se escribió esto. Es el cambio más delicado de
esta tanda: toca el bucle de streaming, que es por donde pasa toda la generación.

### Un `MutationObserver` sobre todo el documento para leer la URL

`FilesStore` quería enterarse de que el chat de la URL había cambiado, y lo hacía con un
`MutationObserver` sobre **`document` con `subtree: true`**: cada nodo que entra o sale en cualquier
parte de la aplicación, leído sólo para comparar una ruta.

Generar es justo la carga que lo vuelve ruinoso. Mientras el modelo escribe, el mensaje se
re-renderiza, el editor re-renderiza el archivo que se está escribiendo, el árbol se actualiza y la
terminal escupe salida — y cada una de esas mutaciones reserva un registro para un observador al que
sólo le importaba la barra de direcciones. Lo paga el hilo principal, que es lo que el navegador
reporta como **«Page Unresponsive»**.

Navegar es algo que la aplicación **hace**, no algo que haya que descubrir espiando el DOM.
`popstate` cubre atrás y adelante; `pushState` y `replaceState` no emiten nada por diseño, así que se
envuelven una vez —con guarda contra el recarga en caliente, que reconstruye el store y apilaría una
capa nueva cada vez— y navegar pasa a ser un evento.

**Ojo con el diagnóstico:** esto se encontró leyendo la consola del navegador, donde lo revelador fue
lo que *no* había — ni un error en rojo. Un cuelgue sin excepción es el hilo principal bloqueado, no
código que falla, y eso manda a buscar trabajo caro, no errores.

### El reloj que esperaba el servidor corría sobre `npm install`

El navegador se entera de que existe una vista previa por **un solo mensaje**: el `server-ready` del
runner. `remote-container.ts` deriva de él tanto el evento `server-ready` como el `port`, y sin ese
mensaje no hay vista previa en la lista, no se dispara el refresco y **no aparece el botón
Publicar**. Un mensaje que falta apaga tres cosas a la vez.

El vigilante del runner se rendía a los **3 minutos contados desde el spawn**. Pero el servidor se
lanza como `npm install && npm run dev` en un único comando —a propósito, para que no puedan
separarse—, así que esos 3 minutos eran en realidad el presupuesto del `npm install`. En un host
ocupado ese install solo ya lo supera. Cuando eso pasaba, el vigilante moría antes de que Vite
abriera su puerto: el servidor arrancaba, servía perfectamente, y nadie se enteraba nunca.

Y se rendía **en silencio** —un `return` pelado, sin log ni evento—, que es la forma más cara que
puede tomar un fallo aquí: un servicio sano indistinguible de uno colgado.

Peor todavía, como el vigilante nunca llegó a fijar `servingPort`, el proxy reenviaba al puerto
*asignado* (41xxx) y Vite ignora `PORT` (ver arriba). Así que abrir la URL de la vista previa a mano
daba **502** con el servidor vivo y sirviendo.

La regla correcta no es un número más grande, es **medir contra otra cosa**: se sigue esperando
mientras el comando siga vivo, porque un proceso vivo es la señal honesta de que el servidor todavía
viene en camino. Cuando ya no queda nada corriendo, el comando falló o terminó sin servir, y una
gracia corta cubre el hueco entre un proceso que sale y su sucesor. Queda un techo absoluto para que
un vigilante no sobreviva al proyecto que lo creó.

Las dos duraciones se pueden inyectar por el constructor de `ProjectManager` **sólo para poder
probarlo**: `ready-watcher.spec.mjs` ejercita los dos finales en milisegundos en vez de en minutos.
Producción no pasa ninguna de las dos y se queda con las constantes.

Del lado del navegador, el guardián esperaba 2 minutos —menos todavía que el runner— y también se
rendía callado. Ahora espera diez minutos, que no cuestan nada cuando todo va bien (la espera
termina en cuanto llega la vista previa, y termina antes por `giveUp` si el comando ya falló), y
cuando se acaba **lo dice** con una alerta.

### Publicar no depende de que la vista previa esté viva

`HeaderActionButtons` escondía los tres botones detrás de `previews[0]`, Publicar incluido. Pero
`publish` compila los archivos **del disco** en el servidor y sirve la salida: no toca el servidor de
desarrollo ni su puerto. Un proyecto cuyo dev server no levantó es perfectamente publicable — y
esconder el botón ahí quitaba justamente la única salida de esa situación. Ahora Publicar decide por
su cuenta: backend en `runner` y que haya archivos.

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

### La causa raíz de casi todos los fallos de generación — y el techo nos lo poníamos nosotros

El modelo tenía que escribir un sitio web entero con **8192 tokens de salida**. Eso forzaba
continuaciones, que causaban archivos truncados, artefactos duplicados y salida perdida.

El diagnóstico era correcto. **El origen estaba mal atribuido**, y durante muchas tandas.

Ese 8192 no era una limitación de los modelos: era `PROVIDER_COMPLETION_LIMITS.OpenRouter` en
`app/lib/.server/llm/constants.ts`, una constante heredada de bolt.diy de cuando OpenRouter servía
sobre todo modelos con ese tope. Consultada la API de OpenRouter, los cuatro modelos de la lista
curada admiten **384.000** (los dos DeepSeek V4), **235.929** (Qwen3 Coder Next) y **65.536**
(Qwen3.6 Plus) tokens de salida. Entre 8 y 47 veces más de lo que les dejábamos.

La resolución de `stream-text.ts` ya miraba primero `modelDetails.maxCompletionTokens`; ninguno de
los cuatro lo declaraba, así que todos caían al valor del proveedor. Ahora los cuatro declaran
**64.000** — por debajo del techo real del más bajo, así que un número sirve para todos.

**La lección, y van tres:** `PORT`, `127.0.0.1`, y ahora esto. El mismo patrón exacto — **dictar en
vez de mirar**. Un valor por defecto heredado que nadie vuelve a mirar puede pasar durante meses por
una limitación de terceros, y encima con una explicación convincente. La contramedida es la de
siempre: que el número se pueda leer en ejecución. Sale ahora en el informe de Diagnóstico.

Lo que esto **no** arregla por sí solo es la calidad visual: eso hay que medirlo con un sitio real
antes de invertir en el Cresova Web Starter.

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
| Cresova Web Starter | **Cambió el motivo en el build 214.** Ya no se justifica por la presión de tokens —ésa se fue al subir el tope a 64.000—, sólo por calidad de diseño. Construirlo **después** de medir si un sitio real sigue viéndose plano. |
| ~~El modelo, si sigue viéndose plano~~ | **Descartado por medición en el build 216.** El modelo cumple el kit con precisión decimal; lo que fallaba era que la tipografía elegida nunca se cargaba. Si tras el 216 sigue por debajo de Lovable, el escalón siguiente es **componer con componentes reales** (`vite-shadcn`, ya declarada en `constants.ts` y ya cacheada en `public/templates/`), no cambiar de modelo. |
| Galería de plantillas | El usuario dijo *"eso para más adelante"*. |
| Cerrar los límites de §6 | `textSearch` y los errores de la vista previa son los que quedan. |
| ~~La pestaña en segundo plano~~ | **Resuelto en el build 209.** Ni congelación ni avalancha ni segundo plano: un escaneo cuadrático en `waitTillOscCode`, 204 de 242 s. Ver §0 ter. |
| ~~El servidor que abre su puerto y no contesta~~ | **Resuelto en el build 208 y confirmado en el 209:** escuchaba en `[::1]:5173` y sondeábamos la IPv4. Ver §0 bis. |
| **Calidad del CSS generado** | `@apply group` rompió un sitio entero. El contrato ya lo prohíbe y el error se convierte en alerta; falta ver si basta con decírselo al modelo. Ver §0 quater. |
| Verificar lo que se desplegó sin probar | El reintento del stream (`api.chat.ts`), el salto de reproducción (`workbench.ts`) y el `experimental_throttle` del chat. |
| ~~Vista Preview por defecto~~ | **Hecho en el build 211.** `currentView` arranca en `'preview'` y el panel ya no salta al código mientras se escriben archivos. Code sigue en el slider. |
| `bindings.sh` pasa los secretos por la línea de comandos | Cualquiera con una shell en el contenedor los ve con un `ps`, y se filtran a cualquier diagnóstico que liste procesos. Es así en bolt.diy de origen. Se arregla con `.dev.vars`. |
| Los proyectos se acumulan en un contenedor | Con `IDLE_TIMEOUT_MS` en 30 min, varios proyectos comparten host y Vite va escalando 5173, 5174, 5175. La etapa 4 (Docker por proyecto) es la solución de fondo. |
| Unificar la barra de botones | Ver la tabla de abajo — ya no incluye `Publish`, resuelto. |
| Calidad visual | **Prioridad 2**, después de la base. |
| Interfaz al estilo Lovable | **Prioridad 3**. La barra superior unificada sigue pendiente; la sensación de agente (preview primero, animación, chat sin lista de archivos) se hizo en el build 211. Ver abajo. |
| **La construcción depende de la pestaña** | Lo pidió el usuario en el build 210: *"siento que todavía es dependiente de que yo esté viendo la pestaña"*. Las dos fugas medibles están tapadas (§0 sexies), pero el fondo es arquitectura: hoy el navegador es el que orquesta —el stream del modelo llega a la pestaña y la pestaña maneja la cola de acciones contra el runner—, así que cerrarla corta la construcción. La respuesta de fondo es que el servidor conduzca la generación contra el runner y la pestaña sólo mire. Es la tanda grande siguiente. |

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

Las nuevas del build 211, todas sin dependencias de la aplicación y por tanto ejecutables aunque
`pnpm install` falle (ver abajo): `build-progress.spec.ts`, `preview-embedding.spec.ts` y
`sampler.spec.ts`. Las dos primeras encierran las reglas que costaron caro — que un turno terminado
sin vista previa no se quede girando, y que cumplir **una** de las dos cabeceras de incrustación
cuente como fallo y diga cuál falta. Las cabeceras de la vista previa se afirman además en las cuatro
ramas del enrutado por `Host`: `ready-watcher.spec.mjs` (sitio publicado y proyecto muerto) y
`remote-preview.spec.ts` (proxy vivo y 404).

De las tandas anteriores: `runner/src/ready-watcher.spec.mjs` cubre que una segunda conexión a un
proyecto que ya sirve reciba el servidor en el apretón de manos (comprobado que **falla** sin el
arreglo); `runner/src/ports.spec.mjs` cubre la lectura de direcciones con un `/proc` de mentira,
porque el real no puede enseñar aquí lo que hay que cubrir; `remote-container.spec.ts` cubre el
suscriptor tardío desde el lado del navegador. Y dos más que se pueden correr sueltas:
`tab-suspension.spec.ts` y `dev-server-errors.spec.ts`.

Las pruebas de integración levantan un **runner real** y hablan con él. Se saltan solas si
`runner/node_modules/ws` no existe:

```bash
cd runner && npm install
```

### Si `pnpm install` falla en el entorno de desarrollo

En algunos entornos `codeload.github.com` está bloqueado por política de egreso, y `electron-builder`
lo necesita: **no hay forma de instalar las dependencias de la aplicación**, así que `pnpm typecheck`,
`pnpm lint` y el grueso de las pruebas no se pueden correr. Eso deja dos salidas, y conviene conocer
las dos porque hicieron todo el trabajo de esta tanda:

**Las pruebas del runner sí se pueden correr solas** — no dependen de la aplicación:

```bash
cd runner && npm install --no-save vitest
cat > vitest.temp.config.mjs <<'EOF'
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['src/**/*.spec.mjs'], testTimeout: 90000, hookTimeout: 90000 } });
EOF
npx vitest run --config vitest.temp.config.mjs && rm vitest.temp.config.mjs
```

Hace falta el config temporal **dentro de `runner/`**: sin él vitest sube hasta el `vite.config.ts`
de la raíz, que no puede cargar sin las dependencias de la aplicación. Hoy: **4 archivos, 28
pruebas.**

**Y las pruebas puras del lado del navegador también**, con un config temporal en la raíz que sólo
aporta el alias `~`:

```bash
cat > vitest.temp.config.mjs <<'EOF'
import { fileURLToPath } from 'node:url';
export default {
  resolve: { alias: { '~': fileURLToPath(new URL('./app', import.meta.url)) } },
  test: { include: ['app/lib/cresova/build-progress.spec.ts', 'app/lib/cresova/preview-embedding.spec.ts', 'app/utils/sampler.spec.ts'] },
};
EOF
npx --yes vitest@2 run --config vitest.temp.config.mjs && rm vitest.temp.config.mjs
```

Sólo sirve para módulos que no importan nada de la aplicación en tiempo de ejecución, que es
justamente por lo que la lógica nueva vive en módulos así.

**Y un typecheck parcial del lado TypeScript**, instalando sólo `typescript` y saltándose la
resolución de módulos:

```bash
npx --yes typescript@latest tsc --ignoreConfig --noEmit --noResolve --skipLibCheck \
  --jsx react-jsx --target es2022 --lib es2022,dom --module esnext --moduleResolution bundler --strict \
  app/ruta/al/archivo.ts
```

Atrapa errores de sintaxis y de tipos locales. **Ignora** todo lo que diga `Cannot find module`,
`Cannot find name`, `implicitly has an 'any'`, `JSX element implicitly` y `Property 'hot' does not
exist`: son consecuencia de `--noResolve`, no hallazgos. Lo delator es que aparezcan en **líneas que
acabas de escribir**; en líneas preexistentes son ruido.

Las más valiosas:

- `remote-shell.spec.ts` — usa el `BoltShell` **real, sin modificar**, contra el runner. Si el
  protocolo se rompe, ahí se cuelga, igual que se colgaría en la aplicación.
- `remote-preview.spec.ts` — la cadena completa: escribir archivos, arrancar el servidor, detectar
  el puerto, servirlo por el proxy. Incluye el caso de un servidor que elige su propio puerto.
- `runner-shutdown.spec.ts` — que apagar el runner no deje servidores huérfanos ocupando puertos.
  Comprobado que falla si se quita el arreglo.
- `runner/src/ready-watcher.spec.mjs` — el archivo más denso del runner, y a propósito: contra qué
  reloj se mide la espera del servidor, qué pasa con **varios servidores a la vez** (el sano gana
  aunque no sea el primero), qué lleva y qué no lleva el árbol de archivos, dónde queda lo publicado,
  y que el diagnóstico no filtre credenciales. Sus mitades viven juntas porque separadas competían
  por el rango de puertos 41000-41999.
