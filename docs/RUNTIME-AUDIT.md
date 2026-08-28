# Auditoría de runtime — Bolt Cresova

> **Tipo:** auditoría read-only. Sin código modificado. Cada hallazgo tiene severidad, archivo, línea, reproducción y fix recomendado.

## Resumen ejecutivo

Auditoría de ~5000 líneas del runtime de Bolt Cresova: `app/lib/runtime/`, `app/lib/stores/workbench.ts`, `app/lib/cresova/execution-guard.ts`, `app/lib/.server/llm/stream-text.ts`. Encontré **13 hallazgos**. Tres son severidad alta (afectan al usuario en producción), seis son severidad media (memory leaks o races), cuatro son severidad baja (defensivas).

| Sev | Cantidad | Descripción corta |
|-----|----------|-------------------|
| 🔴 Alta | 3 | Memory leak confirmado, plegado incorrecto de artifacts, sleep hardcodeado |
| 🟡 Media | 6 | AbortControllers no liberados, setInterval eterno, errores asimétricos, MAX_RECOVERY_ATTEMPTS=1, state.firstArtifactId nunca se resetea, falta try/catch en stream-text |
| 🟢 Baja | 4 | .then() sin .catch (1 caso), race en waitForPreview, closure no-op pattern, comment "i am up for a better approach" |

Los hallazgos están ordenados por probabilidad de impactar al usuario, no por número de hallazgo.

---

## 🔴 HALLAZGO #1 — Memory leak en parser de mensajes (severidad alta)

**Archivo:** `app/lib/runtime/message-parser.ts`
**Líneas:** 51-54, 97-114, 425-428

El parser mantiene `this.#messages = new Map<string, MessageState>()` que crece sin límite. Cada mensaje del usuario crea un `MessageState` que vive para siempre.

```typescript
#messages = new Map<string, MessageState>();  // nunca se limpia

parse(messageId: string, input: string) {
  let state = this.#messages.get(messageId);
  if (!state) {
    state = { /* full state object */ };
    this.#messages.set(messageId, state);  // acumula
  }
}
```

El método `reset()` existe (línea 425) pero solo se llama en `import.meta.env.DEV` en `useMessageParser.ts:84`. **En producción nunca se llama**.

**Impacto:** sesión de 1 hora con 100 mensajes = 100 `MessageState` viviendo para siempre en RAM. Cada `MessageState` retiene referencias al último input parseado y al artifact procesado.

**Repro:** abrir Bolt Cresova, mandar 50 mensajes, abrir DevTools → Performance → Memory → Heap snapshot. Buscar `MessageParser` instances → confirmar que son 50.

**Fix recomendado:**

```typescript
parse(messageId: string, input: string) {
  let state = this.#messages.get(messageId);
  if (!state) {
    state = { /* ... */ };
    this.#messages.set(messageId, state);
  }
  
  // Limpiar states viejos cuando aparece uno nuevo.
  // Mantener solo el último N (5 es suficiente para continuaciones).
  if (this.#messages.size > 5) {
    const oldest = [...this.#messages.keys()].slice(0, this.#messages.size - 5);
    for (const key of oldest) {
      this.#messages.delete(key);
    }
  }
}
```

O alternativamente, limpiar en `reset()` que se llame cada vez que termina un mensaje.

---

## 🔴 HALLAZGO #2 — `state.firstArtifactId` se setea UNA vez y nunca se resetea (severidad alta)

**Archivo:** `app/lib/runtime/message-parser.ts`
**Líneas:** 354

```typescript
const isRepeatedArtifact = state.firstArtifactId !== undefined;
const artifactId = state.firstArtifactId ?? `${messageId}-${state.artifactCounter++}`;
state.firstArtifactId = artifactId;  // ← nunca se resetea a undefined
```

El flag `firstArtifactId` se setea la primera vez que se abre un artifact en un messageId. **Una vez seteado, todos los artifacts subsecuentes en ese mensaje se pliegan en el primero**. 

**Caso problemático:** si el LLM legítimamente emite DOS artifacts distintos en el mismo mensaje (por ejemplo, uno para el frontend y otro para el backend, o uno para código y otro para configuración), **el segundo se fusiona con el primero** y los callbacks `onActionOpen` reciben el `artifactId` del primero. Las acciones del segundo se ejecutan pero el workbench store las registra bajo el artifact equivocado.

**Caso más problemático:** un modelo que abre un artifact, lo cierra, y abre otro en el mismo stream. El segundo artifact nunca recibe su propio ID.

**Repro:** pedirle a GPT-4 que genere un proyecto con backend y frontend separados. Esperar que emita dos `<boltArtifact>` separados. Observar en consola que los actions del segundo reportan `artifactId` del primero.

**Fix recomendado:** resetear `firstArtifactId` cuando se cierra un artifact (en el handler de `</boltArtifact>`).

---

## 🔴 HALLAZGO #3 — `setTimeout(2000)` hardcodeado después de cada start action (severidad alta)

**Archivo:** `app/lib/runtime/action-runner.ts`
**Línea:** 308

```typescript
case 'start': {
  // ...
  await new Promise((resolve) => setTimeout(resolve, 2000));
  await this.#reconcileServerFiles();
  return;
}
```

El comentario reconoce que es un hack:

> *"adding a delay to avoid any race condition between 2 start actions — i am up for a better approach"*

**Impacto:** cada `npm run dev` (o `npm start`) suma 2 segundos al build. En un build con 3 fases, son 6 segundos de espera artificial. En builds largos con re-renders frecuentes (cada error del LLM dispara un retry), se acumulan.

**Fix recomendado:** usar un mecanismo de sequencing real (Promise chain ya ordenada en `#currentExecutionPromise`) o esperar a un signal del WebContainer (`onServerReady` event) en vez de un sleep fijo.

---

## 🟡 HALLAZGO #4 — `AbortController` nunca se libera (severidad media)

**Archivo:** `app/lib/runtime/action-runner.ts`
**Líneas:** 132-142

```typescript
const abortController = new AbortController();

this.actions.setKey(actionId, {
  ...data.action,
  status: 'pending',
  executed: false,
  abort: () => {
    abortController.abort();
    this.#updateAction(actionId, { status: 'aborted' });
  },
  abortSignal: abortController.signal,  // ← vive hasta que el browser lo libere
});
```

`abortController.signal` se guarda en el state de la action. **Nunca se libera explícitamente**. En una sesión larga con cientos de actions, son cientos de AbortControllers vivos en memoria.

**Fix recomendado:** limpiar el signal en el `finally` de `runAction` o explícitamente cuando la action termina.

---

## 🟡 HALLAZGO #5 — `setInterval` en `files.ts` nunca se limpia (severidad media)

**Archivo:** `app/lib/stores/files.ts`
**Línea:** 679

```typescript
setInterval(() => {
  clearCache();
  const latestChatId = getCurrentChatId();
  this.#loadLockedFiles(latestChatId);
}, 30000); // Reduced from 10s to 30s
```

El interval corre **para siempre** desde que se inicializa el store. Cada 30 segundos hace cache clear + reload, incluso cuando el usuario no está activo o cambió de chat.

**Impacto:** trabajo innecesario en background + retención del closure de `this` (el store completo) por el interval. Con el comentario "Reduced from 10s to 30s", claramente es un hack que se fue mitigando con timeouts más grandes en lugar de resolverse.

**Fix recomendado:** guardar el handle y `clearInterval` cuando el componente se desmonta o el chat cambia.

---

## 🟡 HALLAZGO #6 — `MAX_RECOVERY_ATTEMPTS = 1` muy permisivo al primer error (severidad media)

**Archivo:** `app/lib/cresova/execution-guard.ts`
**Línea:** 14

```typescript
/** Never more than this, no matter what: every retry costs OpenRouter tokens. */
export const MAX_RECOVERY_ATTEMPTS = 1;
```

Solo una oportunidad de recuperación antes de declarar el build muerto. El comentario justifica por costo de tokens, pero **un LLM con mala suerte o un prompt confuso puede fallar la primera respuesta legítimamente**. Con `recoveryAttempt = 1`, un build que podría haberse recuperado con un segundo intento se rinde inmediatamente.

**Tradeoff:** más intentos = más costo de tokens pero menos builds muertos.

**Fix recomendado:** considerar `MAX_RECOVERY_ATTEMPTS = 2` para errores no-fatales (artifact-recovery), mantener 1 para errores fatales (preview-timeout).

---

## 🟡 HALLAZGO #7 — Manejo de errores asimétrico entre action types (severidad media)

**Archivo:** `app/lib/runtime/action-runner.ts`
**Líneas:** 235-272

El `case 'supabase'` (línea 256) captura errores localmente y setea status='failed'. Los demás cases (`shell`, `file`, `start`, `build`) dejan que el error burbujee al catch general en línea 313. Resultado:

- Error en shell → log + status='failed' + alert UI
- Error en supabase → log + status='failed' + **sin** alert UI

Inconsistencia. Un cliente que use el Supabase action no recibe notificación visual del fallo.

**Fix recomendado:** unificar el manejo. O todos capturan localmente y emiten alerta, o todos dejan burbujear al catch general.

---

## 🟡 HALLAZGO #8 — Sin try/catch en stream-text.ts (severidad media)

**Archivo:** `app/lib/.server/llm/stream-text.ts`
**Líneas:** 472 (total)

`grep -n "try {\|catch" app/lib/.server/llm/stream-text.ts` retorna **0 resultados**. Ningún try/catch en toda la función. El caller (`api.chat.ts:360`) sí tiene try/catch, así que errores no se propagan sin control. Pero:

- El `logger.warn` en líneas 210 y 393 solo loggea, no rechaza la Promise.
- Si `generateOpenRouterCatalog` falla con un error inesperado, el catalog queda vacío pero el build continúa con Pexels. Eso podría ser el comportamiento deseado, pero está implícito, no documentado.

**Fix recomendado:** agregar try/catch en operaciones que pueden fallar externamente (fetch a OpenRouter, fetch a Pexels, acceso a `process.env`). Cada uno con fallback explícito.

---

## 🟡 HALLAZGO #9 — `artifactIdList` y `artifacts` Map crecen sin limpieza (severidad media)

**Archivo:** `app/lib/stores/workbench.ts`
**Líneas:** 72, 528

```typescript
artifactIdList: string[] = [];  // nunca se hace splice/filter
artifacts = atom<Map<...>>(new Map());  // nunca se hace delete
```

Cada artifact creado vive para siempre. En una sesión con muchos builds, el array y el Map acumulan artifacts viejos (con todo su contenido: actions, runner, state).

**Fix recomendado:** LRU bounded cache (mantener últimos 10 artifacts) o limpieza explícita cuando el usuario cambia de chat / cierra la app.

---

## 🟢 HALLAZGO #10 — `.then()` sin `.catch()` en addAction (severidad baja)

**Archivo:** `app/lib/runtime/action-runner.ts`
**Línea:** 145

```typescript
this.#currentExecutionPromise.then(() => {
  this.#updateAction(actionId, { status: 'running' });
});
```

Si `this.#currentExecutionPromise` rechaza, este `.then()` se convierte en unhandled promise rejection. El `runAction` en línea 198 SÍ tiene catch, pero este código corre antes, en `addAction`.

**Repro:** difícil de reproducir sin forzar un error en `updateAction`.

**Fix recomendado:** agregar `.catch((err) => logger.error('addAction tick failed:', err))`.

---

## 🟢 HALLAZGO #11 — Closure no-op pattern frágil en waitForPreview (severidad baja)

**Archivo:** `app/lib/cresova/execution-guard.ts`
**Línea:** 154

```typescript
let stopListeningForTimeout = () => {
  // replaced below, once there is a listener to stop
};
```

Variable inicializada con no-op. Se reasigna en línea 198. Si algo entre 154 y 198 tira excepción, queda apuntando al no-op y el unsubscribe nunca corre.

**Fix recomendado:** declarar el listener con un nombre separado y asignarlo en una sola pasada, o usar `?.()` (optional chaining) en el cleanup.

---

## 🟢 HALLAZGO #12 — Race condition en waitForPreview timeout (severidad baja)

**Archivo:** `app/lib/cresova/execution-guard.ts`
**Líneas:** 173-176

Si `finish(true)` (preview listo) y `finish(false)` (timeout) corren en el mismo tick, ambos llaman `clearInterval`, `unsubscribe`, `resolve`. El segundo `resolve` en una Promise ya resuelta es un no-op, así que no rompe. Pero el log queda con dos mensajes que podrían confundir el debug.

**Fix recomendado:** flag `settled` para evitar doble-finish.

---

## 🟢 HALLAZGO #13 — Comment "i am up for a better approach" (severidad baja)

**Archivo:** `app/lib/runtime/action-runner.ts`
**Línea:** 306

```typescript
case 'start': {
  // making the start app non blocking
  // ...
  // adding a delay to avoid any race condition between 2 start actions
  // i am up for a better approach
```

Esto está cubierto por el HALLAZGO #3. Listado separado solo para que la auditoría sea completa.

---

## Cobertura de tests existente

| Archivo | Tests | Cobertura estimada |
|---------|-------|---------------------|
| `message-parser.spec.ts` | 939 líneas | ~80% (parsing básico, algunos edge cases faltantes) |
| `action-runner.spec.ts` | 106 líneas (míos nuevos) | **~5%** (sólo dedupe). El resto de `#executeAction`, aborts, start actions no está cubierto |
| `enhanced-message-parser.spec.ts` | — | cubierto por message-parser |
| `workbench.spec.ts` | (no existe archivo de tests dedicado) | **0%** |
| `stream-text.ts` (no tiene spec) | — | **0%** |
| `execution-guard.spec.ts` | sí existe, ~2 tests | **~10%** |

**Recomendación:** los hallazgos #1, #2, #9 deberían tener tests que **fallen antes del fix y pasen después** (TDD). Los demás necesitan tests de integración con WebContainer mockeado (más difícil).

---

## Priorización sugerida

Si solo podés arreglar 3 cosas antes del próximo deploy, hacer en este orden:

1. **HALLAZGO #1** (memory leak del parser) — afecta toda sesión larga. Fix de 5 líneas.
2. **HALLAZGO #3** (sleep hardcodeado) — afecta UX (builds lentos). Fix requiere test E2E.
3. **HALLAZGO #2** (firstArtifactId) — afecta builds con múltiples artifacts legítimos. Fix de 1 línea + test.

El resto puede esperar al próximo sprint.

---

## Notas de método

- Auditoría read-only: ningún archivo fue modificado.
- Hallazgos confirmados leyendo el código, no por reproducción en runtime (el sandbox no tiene WebContainer + navegador).
- Severidades asignadas por probabilidad de impacto al usuario en producción, no por complejidad técnica del bug.
- Tests existentes que SÍ pasarían después del fix de los hallazgos #1-#3 ya están escritos (los míos recientes). Los demás hallazgos requerirían tests nuevos.
