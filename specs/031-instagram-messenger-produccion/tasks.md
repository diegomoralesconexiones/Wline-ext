---

description: "Tareas de la 031: Instagram y Messenger por Zernio en producción (Wline-ext)"
---

# Tasks: Instagram y Messenger por Zernio en producción (Wline-ext)

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: sí. La spec pide primero la prueba que falla y después el arreglo
(«Estrategia de pruebas»). Cada prueba nueva se ve **fallar** con el código de
hoy antes de implementar.

**Organización**: una fase por historia de la spec. Todas son P1, así que el
orden lo marcan las dependencias:

```
US3 (mock) → US1 (Instagram) → US2 (hora) → US5 (respuesta larga) → cierre → US4 (producción)
```

## Formato: `[ID] [P?] [Story] Descripción`

- **[P]**: puede ir en paralelo (otro archivo, sin depender de tareas abiertas).
- **[USn]**: la historia *n* de la spec.
- **Quién**: si no se dice nada, la hace Claude. «**Dueño**» marca lo que solo
  puede hacer el dueño de las cuentas. «**Preguntar antes**» marca lo que
  necesita su permiso explícito (Límites de la spec).
- **Piso de calidad**: [CONSTRAINTS.md](../../CONSTRAINTS.md). Toda tarea de
  código cierra con `pnpm check:task` en verde. Toda historia cierra con sus
  guiones E2E en verde.

---

## Phase 1: Setup

**Propósito**: entorno local listo y una línea base con el código de hoy, para
distinguir fallos previos de los que traiga la 031.

- [x] T001 Confirmar que el `.env` local (no se versiona) tiene los mocks y los canales de [quickstart.md](quickstart.md) §1: `WA_MOCK_ENABLED=true`, `CHANNELS=whatsapp,instagram,messenger,tiktok`, `META_GRAPH_BASE_URL`, `OPENROUTER_BASE_URL` y `ZERNIO_BASE_URL` apuntando a los mocks. Ningún valor se copia al chat.
- [x] T002 Línea base con el código de hoy:
  - Gate: `pnpm typecheck && pnpm lint && pnpm build && pnpm test`.
  - Con `pnpm dev` vivo: `scripts/e2e-canales.mjs`, `scripts/e2e-messenger.mjs`, `scripts/e2e-ventana-social.mjs`, `scripts/e2e-tiktok.mjs`, `scripts/e2e-despacho.mjs` y `pnpm test:e2e`.
  - Cualquier fallo previo se anota en «Notas» al final de este archivo.

---

## Phase 2: Foundational

**Propósito**: la 031 no necesita infraestructura nueva. El único prerrequisito
compartido es el mock de Zernio, y vive en la US3, que va primero.

Sin tareas.

---

## Phase 3: User Story 3 — Las pruebas ven la forma real de Zernio (P1)

**Goal**: que el mock responda como la API real, para que un transporte que
lea otra forma falle en las pruebas y no en producción (AC6–AC8).

**Independent Test**:
- Con el mock nuevo, la afirmación de AC7 **falla** con el código de hoy.
- Messenger y TikTok siguen en verde, porque ya leen `data.messageId`.

### Tests for User Story 3

- [x] T003 [US3] En `scripts/e2e-canales.mjs`, enviar un texto por una conversación de Instagram conectada por Zernio.
  - Afirmar que el `wa_message_id` guardado en la fila de `message` saliente es el `messageId` que respondió el mock, en vez de un `zernio_<hora>`.
  - El guion ya consulta la base para las credenciales (030), así que se lee la fila de la misma forma.
  - Correrlo y **ver que falla** (AC7).

### Implementation for User Story 3

- [x] T004 [US3] En `src/app/api/dev/zernio-mock/[...path]/route.ts` (respuesta del envío, ~L154), responder `{ success: true, data: { messageId: id, conversationId } }`.
  - Sin `message.id` ni `id` en la raíz.
  - Se mantiene lo que guarda en `state.sent` y el respeto a `state.down`.
  - Forma exacta en [contracts/zernio-enviar-mensaje.md](contracts/zernio-enviar-mensaje.md).
- [x] T005 [US3] Correr `scripts/e2e-messenger.mjs` y `scripts/e2e-tiktok.mjs` con el mock nuevo y confirmar que siguen en verde (AC6, parte de AC8). T003 sigue en rojo hasta la US1.

**Checkpoint**: el mock tiene la forma real, AC7 está en rojo y lo demás en verde.

---

## Phase 4: User Story 1 — Instagram por Zernio guarda el id real (P1)

**Goal**: un solo transporte de Zernio. Instagram guarda el id real de la
plataforma (AC1–AC3, D1).

**Independent Test**: T003 pasa a verde y las unitarias de T006 quedan en verde.

### Tests for User Story 1

- [x] T006 [P] [US1] Crear `tests/unit/instagram-send.test.ts`. Con `fetch` simulado y credenciales `source: "zernio"`, `sendInstagramText` debe:
  - (a) hacer `POST {ZERNIO_BASE}/inbox/conversations/{threadRef}/messages` con `accountId` = `accountRef` y `message`;
  - (b) con `humanAgentTag: true`, mandar `messagingType: "MESSAGE_TAG"` y `messageTag: "HUMAN_AGENT"`;
  - (c) devolver `platformMessageId` = `data.messageId`;
  - (d) sin `threadRef`, lanzar `MetaApiError` 400;
  - (e) ante un 401, lanzar un `MetaApiError` con `isAuthError`.

  Confirmar que (c) **falla** con el código de hoy.

### Implementation for User Story 1

- [x] T007 [US1] En `src/server/instagram/send.ts`:
  - `sendInstagramText` delega en `sendZernioMessage` (de `@/server/zernio`) cuando `source === "zernio"`, con el comentario 031 del plan («Estilo»).
  - Se borran `sendViaZernio` y la constante `ZERNIO_BASE`.
  - `fetchJson`, `sendViaMeta`, `IG_TEXT_MAX_BYTES` y `fitsInstagramText` no se tocan.
- [x] T008 [US1] Verificar en verde: `pnpm test` (T006) y `scripts/e2e-canales.mjs` (T003, AC7).
  - AC2 y AC3 quedan cubiertos por T006 (b, d, e).
  - `scripts/e2e-ventana-social.mjs` sigue en verde: comprueba la etiqueta fuera de ventana de punta a punta.

**Checkpoint**: Instagram y Messenger comparten transporte; el hallazgo 4 está cerrado.

---

## Phase 5: User Story 2 — La hora de la conversación no retrocede (P1)

**Goal**: un entrante tardío no mueve hacia atrás `lastInboundAt` ni
`lastMessageAt` (AC4–AC5, D2).

**Independent Test**: dos eventos de Zernio fuera de orden. La conversación
conserva la hora del más nuevo y el viejo aparece en el hilo.

### Tests for User Story 2

- [x] T009 [US2] En `scripts/e2e-ventana-social.mjs`, agregar un caso:
  - Un evento de Instagram por Zernio con `sentAt` de hace 1 min.
  - Después, otro del mismo cliente (id de mensaje distinto) con `sentAt` de hace 20 h.
  - Afirmar que `lastInboundAt` de la conversación sigue en la hora del primero y que el mensaje viejo está en el hilo.
  - Confirmar que **falla** con el código de hoy (AC4).

### Implementation for User Story 2

- [x] T010 [US2] En `src/server/inbox/ingest.ts` (actualización de la conversación, ~L507–515):
  - `lastInboundAt: sql\`greatest(${schema.conversation.lastInboundAt}, ${waTimestamp})\``, y lo mismo para `lastMessageAt`. Si el driver no infiere el tipo del parámetro, se le pone un cast explícito a `timestamptz`.
  - `unreadCount` y el resto no cambian.
  - Comentario 031: Zernio reintenta hasta 7 veces en ~51 h (R4, R5).
- [x] T011 [US2] Verificar en verde: `scripts/e2e-ventana-social.mjs` (AC4, AC5) y `pnpm test:e2e`, porque WhatsApp comparte la misma ingesta.

**Checkpoint**: la hora de la conversación es monotónica en todos los canales.

---

## Phase 6: User Story 5 — Una respuesta larga del agente llega igual (P1)

**Goal**: el agente no se calla cuando su texto no cabe en el canal. Se envía
en partes que sí caben (AC17–AC21, D8, R1).

**Independent Test**: un DM «respuesta larga» por Instagram llega al mock de
Zernio en varias partes de 1.000 bytes o menos, en orden. Un DM normal sale
en una sola.

### Tests for User Story 5

- [x] T012 [P] [US5] Crear `tests/unit/split-to-fit.test.ts` para `splitToFit` y `replyParts`, que todavía no existen:
  - Un texto que cabe da 1 parte.
  - Más de 1.000 bytes con párrafos se corta en párrafos; un párrafo largo, en frases; una frase larga, en palabras; una palabra larga, en puntos de código sin partir emojis (`"😀".repeat(400)`).
  - No hay partes vacías y cada parte cumple `textFits`.
  - Las partes juntas conservan todas las palabras.
  - Tope de 5 partes, con «…» al final de la quinta.
  - `messenger` corta en 2.000; `whatsapp` mide en caracteres (4.096).
  - `replyParts` aplica `plainSocialText` antes de partir en los canales `plain` (AC20 por construcción).
- [x] T013 [P] [US5] En `tests/unit/social-text.test.ts` (crearlo si no existe), afirmar que `plainSocialText` es idempotente: aplicarla dos veces da lo mismo que una, con textos con negritas, listas, enlaces y emojis. Si falla, ver la alternativa de R1.

### Implementation for User Story 5

- [x] T014 [US5] En `src/server/channels/capabilities.ts`, junto a `textFits`:
  - Implementar `splitToFit(channel, text): string[]` según R1: cascada párrafo → frase → palabra → punto de código, separadores originales, `trim`, sin vacías y tope de 5 con «…».
  - Implementar `replyParts(channel, text): string[]`: `plainSocialText` (de `@/lib/social-text`) si el canal es `plain`, y luego `splitToFit`.
- [x] T015 [US5] En `src/server/ai/pipeline.ts`, `deliverReply` (~L387):
  - Calcular `replyParts(conversation.channel, text)` **antes** de separar el Laboratorio.
  - Si `isTest`, `persistTestOutbound` por cada parte.
  - Si no, `sendText` (`aiGenerated: true`) por cada parte, en orden y esperando cada una.
  - `window_closed` → `applyHandoff(..., "ventana")` y no se mandan las restantes (AC21).
  - `message_limit` → `console.warn` y return, como hoy.
  - Cualquier otro error se relanza.
  - Si se llega al tope, `console.warn` con el id de la conversación, nunca con el texto.
- [x] T016 [P] [US5] En `src/server/dev/ai-mock.ts`, antes del eco final (~L185): si el texto del cliente contiene «respuesta larga», responder `{ action: "reply", text }` con un texto fijo de unos 2.500 bytes, en tres párrafos, con acentos y un emoji (R6).
- [x] T017 [US5] En `scripts/e2e-ventana-social.mjs`, un DM de Instagram con «respuesta larga»:
  - Afirmar que en `state.sent` del mock de Zernio llegan 3 o más partes, cada una de 1.000 bytes o menos, en orden, y que juntas contienen el texto completo (AC17).
  - Un DM normal llega en 1 parte (AC19).
- [x] T018 [US5] En `scripts/e2e-messenger.mjs`, el mismo DM «respuesta larga» por Messenger. Afirmar que llega en partes de 2.000 bytes o menos (AC18).
- [x] T019 [US5] Verificar en verde: `pnpm test` (T012, T013), `scripts/e2e-ventana-social.mjs`, `scripts/e2e-messenger.mjs` y `pnpm test:e2e`, que incluye el Laboratorio.
  - AC20 queda cubierto por `replyParts` (T012) más el orden de T015.
  - AC21 a mitad de una respuesta no se puede provocar con los mocks. Queda verificado por revisión de código del bucle de T015, y así se anota en «Notas» (Principio VII).

**Checkpoint**: ninguna respuesta del agente se pierde por largo.

---

## Phase 7: Cierre del código (transversal)

**Propósito**: todo en verde y en `main` del fork antes de tocar producción.

- [x] T020 [P] En `src/server/zernio/index.ts` (~L107–112), corregir el comentario «backoff de hasta 24 h» por «hasta 7 intentos en ~51 h» (R4).
- [x] T021 Gate técnico completo: `pnpm typecheck && pnpm lint && pnpm build && pnpm test`.
- [x] T022 Todos los E2E en verde: `pnpm test:e2e`, `scripts/e2e-canales.mjs`, `scripts/e2e-messenger.mjs`, `scripts/e2e-ventana-social.mjs`, `scripts/e2e-tiktok.mjs` y `scripts/e2e-despacho.mjs` (AC8).
  - AC15: con `state.down` en el envío del mock, el operador ve «no está disponible» y nada se cuelga.
  - AC16: una entrega con firma inválida responde 401.
  - Si algún guion no los cubre ya, se agrega la afirmación en `scripts/e2e-canales.mjs`.
- [x] T023 [P] `graphify update .` para refrescar el grafo (`graphify-out/`, no se versiona).
- [ ] T039 Capturas de la app real **antes del PR** (va antes de T024; el ID es posterior porque se agregó después).
  - Con la app viva en local, los mocks y `CHANNELS=whatsapp,instagram,messenger`, sembrar conversaciones de Instagram y Messenger con los guiones E2E.
  - Con Playwright, como hace `scripts/e2e-responsive.mjs`, tomar capturas de escritorio y de teléfono de cuatro vistas: la bandeja con los tres canales, una conversación de Instagram con una respuesta larga en partes, una de Messenger con el aviso «Solo puede contestar una persona», y Ajustes → Canales.
  - Guardarlas en `scratch/031/`, que git ignora.
  - El **Dueño** las compara con el [prototipo](https://claude.ai/artifact/AkcWoAELMLWf8RFXbwXDrC) y aprueba antes de seguir.
  - Requiere Postgres en local, por ejemplo con Docker Desktop encendido.
- [ ] T024 Commits en `feat/031-instagram-messenger-produccion` y PR a `main` del fork `diegomoralesconexiones/Wline-ext`, con `ci.yml` y el build de `imagen.yml` en verde. **Preguntar antes**; el merge lo aprueba el **Dueño**.

**Checkpoint**: `main` del fork tiene la 031 con la CI en verde.

---

## Phase 8: User Story 4 — Encendido en producción (P1)

**Goal**: un DM real de Instagram y uno de Messenger entran a la bandeja de
Wline-ext; el agente contesta y un operador puede responder (AC9–AC14, D4–D6).

**Independent Test**: [quickstart.md](quickstart.md) §2–§4 completo, sin
desviaciones.

- [ ] T025 [US4] **Preguntar antes**. Crear y empujar `git tag v1.6.0-wline.1` sobre `main` del fork.
  - Verificar que el workflow *Imagen* (`.github/workflows/imagen.yml`) termina en verde y publica `ghcr.io/diegomoralesconexiones/wline-ext:1.6.0-wline.1`.
  - Si falla por la mayúscula del nombre, aplicar R7, que es un cambio de CI y se pregunta antes.
- [ ] T026 [US4] **Dueño**: hacer público el paquete `wline-ext` (*Package settings* → *Change visibility* → *Public*, R8). Claude verifica que la etiqueta se puede leer sin credenciales.
- [ ] T027 [US4] **Preguntar antes**. En Coolify, app Wline-ext (`esy1owctf4ga9booy475qjeb`):
  - Imagen `ghcr.io/diegomoralesconexiones/wline-ext`, etiqueta `1.6.0-wline.1`.
  - Variable de ejecución `CHANNELS=whatsapp,instagram,messenger`.
  - Redesplegar.
  - Verificar con `curl -s https://wline-ext.morales-tec.xyz/api/health` el commit del tag, `commitVerified: true` y los tres canales (AC9).
- [ ] T028 [US4] **Dueño**, con guía de Claude en el navegador: Ajustes → IA → «Probar conexión» y `/api/agent/brain-status`. Confirmar que contesta el agente del CRM y no un cerebro externo.
- [ ] T029 [US4] **Dueño**: guardar la llave de Zernio en Ajustes → Instagram y Ajustes → Messenger. La llave nunca se escribe en el chat. Claude verifica en Ajustes → Canales las dos cuentas sanas y el webhook apuntando aquí con secreto, sin `sin_https`, `sin_conexiones` ni `zernio_unavailable` (AC10).
- [ ] T030 [US4] **Preguntar antes**. El **Dueño** dispara el evento de prueba desde el panel de webhooks de Zernio (*Test webhook*). Claude verifica que llegó firmado y que Wline-ext respondió 200 (AC11).
- [ ] T031 [US4] **Dueño**: DM real desde su Instagram personal a la cuenta del negocio. Claude verifica que entra a la bandeja en segundos y que el agente contesta. Después un operador responde a mano, y el dueño confirma en su teléfono que llegaron las dos respuestas (AC12).
- [ ] T032 [US4] **Dueño**: mensaje real desde su Facebook personal a la página. Las mismas verificaciones, por Messenger (AC13).
- [ ] T033 [US4] **Dueño**: un DM de Instagram que pida una respuesta larga. Llega en partes, sin silencio (AC17 en vivo).
- [ ] T034 [US4] **Dueño**: un WhatsApp de ida y vuelta, sin cambios (AC14).
- [ ] T035 [US4] Llenar la sección «Prueba en vivo» de `specs/031-instagram-messenger-produccion/spec.md`: fecha, commit, resultado de AC9–AC14 y AC17, y cualquier desviación.

**Checkpoint**: Instagram y Messenger atendiendo en producción.

---

## Phase 9: Polish & documentación

- [ ] T036 [P] En `docs/zernio-meta-referencia.md` §3, marcar como resueltos la respuesta de envío de Instagram, el mock y el comentario de reintentos (de ❌/⚠️ a ✅, citando la 031).
- [ ] T037 [P] Agregar la 031 al índice de `specs/README.md`, y crear `docs/bitacora-wline.md` (propia del fork) con la salida a producción. Así la bitácora de Kevin no choca al hacer *Sync fork* (D7).
- [ ] T038 Actualizar el `Status` de `specs/031-instagram-messenger-produccion/spec.md` a «Implementada; gates y E2E en verde; probada en vivo en Wline-ext».

---

## Dependencies & Execution Order

### Fases

- **Setup (1)**: sin dependencias.
- **Foundational (2)**: vacía.
- **US3 (3)**: depende de Setup. Bloquea a la US1 (T003 usa el mock nuevo) y a la US5 (T017 y T018 leen `state.sent` con la forma nueva).
- **US1 (4)**: depende de la US3.
- **US2 (5)**: solo depende de Setup. Va después de la US1 para no tocar `e2e-ventana-social.mjs` en dos frentes a la vez.
- **US5 (6)**: depende de la US3. Comparte `e2e-ventana-social.mjs` con la US2, así que va después de ella.
- **Cierre (7)**: depende de US1, US2, US3 y US5.
- **US4 (8)**: depende del Cierre, con el PR fusionado.
- **Polish (9)**: depende de la US4.

### Dentro de cada historia

1. La prueba primero, y se ve fallar.
2. Después la implementación.
3. Después la verificación en verde.

### Oportunidades en paralelo

- T006 (unitaria de Instagram) puede escribirse junto con T003–T005, porque es otro archivo.
- T012, T013 y T016 son archivos distintos y pueden ir juntos.
- T020 y T023 en el Cierre.
- T036 y T037 en Polish.
- La US2 podría adelantarse en paralelo a la US1, porque toca `ingest.ts`, que nadie más toca, salvo por el guion compartido.

---

## Parallel Example: User Story 5

```text
Task: "T012 Unitarias de splitToFit y replyParts en tests/unit/split-to-fit.test.ts"
Task: "T013 Idempotencia de plainSocialText en tests/unit/social-text.test.ts"
Task: "T016 Disparador «respuesta larga» en src/server/dev/ai-mock.ts"
```

---

## Implementation Strategy

### Lo mínimo para salir (todo P1)

La meta confirmada solo se cumple completa: US3 → US1 → US2 → US5 → Cierre →
US4. No hay un subconjunto que valga la pena desplegar solo, porque cada
despliegue cambia la imagen de producción.

### Paradas para validar

1. Después de la US1: el hallazgo 4 está cerrado.
2. Después de la US5: todo el código está listo, pero sin desplegar.
3. Después de T027: producción con los canales encendidos, todavía sin
   cuentas conectadas.
4. Después de T031: el primer DM real.

### Si algo falla en producción

Revertir según [quickstart.md](quickstart.md#revertir): quitar redes de
`CHANNELS`, o volver a la imagen anterior. No hay migración.

---

## Notas

- *Fallos previos de la línea base (T002)*:
  - 2026-10-21, al fijar CONSTRAINTS.md: `pnpm check:task` en verde (typecheck, lint, piso, 101 archivos / 1.145 unitarias, cobertura de líneas 27.93%, build).
  - 2026-10-21, al empezar la implementación: `pnpm check:task` otra vez en verde con el código de hoy (mismos números).
  - 2026-10-22, E2E con el código de hoy (los guiones de HEAD, la app viva y los mocks): selftest 213/213, canales 76/76, messenger 42/42, ventana-social 57/57, tiktok 52/52 y despacho 14/14. **Sin fallos previos.**
  - Docker Desktop no arrancaba en esta máquina: en esta versión de Windows los sockets AF_UNIX que deja al cerrarse quedan inaccesibles (error 1920) y al volver a arrancar se cae al renombrarlos. Se arregla renombrando **juntas** `%LOCALAPPDATA%\Docker\run` y `%LOCALAPPDATA%\docker-secrets-engine` a `*.stale-<fecha>` antes de abrirlo, igual que las carpetas `*.stale-*` anteriores.
  - Los guiones inician sesión cada vez y el login tiene un tope de 10 intentos por IP cada 10 minutos (FR-062, en memoria del proceso). Correr más de ~8 guiones seguidos lo agota («Demasiados intentos») sin que sea un fallo de la 031: entre tandas se reinició `next dev`.
- *Entorno (T001)*: no había `.env`. Se creó con `pnpm init-env` (secretos generados, sin imprimirlos) y se ajustó a desarrollo local: `APP_BASE_URL=http://localhost:3000`, `DATABASE_URL` al Postgres de `docker-compose.dev.yml`, el bloque de mocks de quickstart §1, `OPENROUTER_API_TOKEN`/`OPENROUTER_MODEL` de prueba, `BOT_API_KEY` generada y `AGENT_COALESCE_MS=1500`.
- *Rojo antes del arreglo*:
  - T006: `expected 'zernio_1792620632451' to be 'aWdfZAG1-real'` con el código de hoy; las otras cinco afirmaciones ya pasaban.
  - T012: las doce pruebas fallan porque `splitToFit` y `replyParts` no existían.
  - T013: la idempotencia de `plainSocialText` ya se cumplía; no hizo falta la alternativa de R1. El archivo ya existía y se le agregó un caso con emojis y marcas mezcladas.
  - T015: las tres pruebas nuevas de `handoff-ack.test.ts` (partes en Instagram, Laboratorio, ventana cerrada a media respuesta) fallan con el `pipeline.ts` de HEAD.
  - T003: con el mock viejo la afirmación de AC7 pasaría, porque el mock viejo responde `message.id`, que es justo lo que leía la copia de Instagram. El rojo se ve con el mock nuevo (T004), como dice el plan.
  - E2E con el mock nuevo y el resto del código de hoy:
    - T005: el mock responde `{"success":true,"data":{"messageId":"zmock_…","conversationId":"zc-1"}}`; los guiones de HEAD de Messenger (42/42) y TikTok (52/52) siguen en verde.
    - T003 (AC7): `e2e-canales` 85/86. Falla solo «Instagram: se guarda el id que respondió Zernio» con `guardado=zernio_1792707741347 n=64`; Messenger pasa.
    - T009 (AC4): `e2e-ventana-social` 65/70. `lastInboundAt` y `lastMessageAt` retroceden 20 h (`22:24:41Z → 02:25:42Z`).
    - T017 y T018 (AC17, AC18): el agente se calla, 0 partes por Instagram y por Messenger (`e2e-messenger` 45/48). AC19 ya pasaba.
- *Desviaciones*:
  - **D8 / R1**: partir el texto ya limpio no basta. Un corte por frase o por palabra puede dejar al inicio de una parte un «- » que en el texto entero iba a media línea; `sendText` vuelve a limpiar la parte, lo convierte en «• » (dos bytes más) y el envío falla por largo. `replyParts` mide cada trozo como quedará después de limpiarlo y lo entrega ya limpio. La prueba «lo que sale ya está limpio…» de `split-to-fit.test.ts` falló con R1 al pie de la letra y pasa con el arreglo.
  - **T015**: AC20 y AC21 quedan cubiertos por unitarias en `handoff-ack.test.ts`, además de la revisión de código. El aviso del tope sale cuando la respuesta ocupa 5 mensajes; no distingue si hubo recorte.
  - **AC4, «en su lugar cronológico»**: el hilo se ordena por `created_at` (`listMessages` en `src/server/inbox/queries.ts`), así que el mensaje tardío aparece al final del hilo, aunque muestra su propia hora (el DTO usa `wa_timestamp`). Ordenarlo por su hora toca `queries.ts`, fuera de «Dónde vive el cambio»: queda para decidir con el dueño. T009 afirma que entra al hilo con su hora, que la conversación no retrocede y que uno posterior sí la avanza.
  - **D2 en el eco**: `ingestManualEcho` (eco de WhatsApp, mismo archivo) sigue sobrescribiendo `lastMessageAt` con la hora del eco. T010 solo pide el entrante; queda anotado.
  - **AC15 y AC16**: ningún guion los cubría del todo. Se agregaron a `e2e-canales.mjs`: el envío con el mock caído (Instagram y Messenger) y que lo rechazado por firma no entra al hilo.
- *Gate con la 031 (antes de los E2E)*: `pnpm check:task` en verde. 103 archivos / 1.168 unitarias, cobertura de líneas 28.22% (sube desde 27.93%), líneas nuevas 102/120 (85.0%), build compilado.
- *Verde con la 031 (T008, T011, T019, T022)*, 2026-10-22: `pnpm test:e2e` 213/213, `e2e-canales` 86/86 (AC7, AC15 por Instagram y Messenger, AC16), `e2e-messenger` 48/48 (AC18: 2 partes de 2.000 bytes o menos), `e2e-ventana-social` 70/70 (AC4, AC5, AC17: 3 partes de 1.000 bytes o menos con el texto completo, AC19), `e2e-tiktok` 52/52 y `e2e-despacho` 14/14.
- *Gate final (T021)*: `pnpm check:task` en verde, con los mismos números. La primera corrida falló en lint por una copia temporal de `e2e-selftest.mjs` de HEAD que había en `scratch/031/base/` (ESLint revisa `scratch/` aunque git lo ignore); se borró la copia, sin tocar la configuración.
- *Seguridad (`pnpm check:security`, con Docker)*: secretos limpios en los commits de la rama. Dependencias: **aviso** de 31 vulnerabilidades de severidad alta o mayor (next, postcss, sharp, vite, vitest, entre otras), todas ya en `pnpm-lock.yaml` antes de la 031, que no agrega dependencias. Hoy solo avisa; **bloquea desde el 2026-11-04**.
- *T023*: `graphify update .` reconstruyó el grafo (4.572 nodos). `sendInstagramText` ya llama a `sendZernioMessage` y `sendViaZernio` ya no existe.
- *T039*: capturas en `scratch/031/capturas/` (escritorio 1440×900 y teléfono 390×844) sobre una base limpia `vocero_capturas` y `CHANNELS=whatsapp,instagram,messenger`: bandeja con los tres canales, respuesta larga de Instagram en 3 partes (590, 948 y 887 bytes), Messenger con «Solo puede contestar una persona» y Ajustes → Canales con las cuentas y el webhook activos. Guion: `scratch/031/capturas-031.mjs`. Falta la aprobación del dueño.
- *Verificaciones por revisión de código (Principio VII)*: AC21 a mitad de una respuesta (T019), ahora también con prueba unitaria.
