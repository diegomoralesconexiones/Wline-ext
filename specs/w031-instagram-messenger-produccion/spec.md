# Feature Specification: Instagram y Messenger por Zernio en producción (Wline-ext)

**Feature Branch**: `feat/031-instagram-messenger-produccion`

**Created**: 2026-10-21

**Status**: Escrita antes del código. Q1 y Q2 resueltas por el dueño el
2026-10-21; plan en [plan.md](plan.md). Sin código todavía.

**Input**:

- El análisis de la integración por Zernio (grafo de graphify, nota de 70/100).
- La intención confirmada con `interview-me`.
- El one-pager [docs/ideas/instagram-messenger-produccion.md](../../docs/ideas/instagram-messenger-produccion.md).
- La referencia [docs/zernio-meta-referencia.md](../../docs/zernio-meta-referencia.md), contrastada con la documentación oficial de Zernio y de Meta el 2026-10-21.

**Carril**: ligero (Principio VI). No hay migración ni cambia ningún contrato
publicado (`/api/bot/*`, webhooks, SSE). El mock de Zernio es superficie de
desarrollo y en producción responde 404. Como hay pasos de despliegue que
ordenar, las tareas se escriben igual con `planning-and-task-breakdown`.

## Objetivo

> Como dueño de Wline-ext quiero que los DMs de Instagram y los mensajes de la
> página de Facebook entren a la bandeja y se respondan, tanto por el agente
> como por un operador, para atender ahí a quienes escriben por redes.

**Éxito**: un DM real de Instagram y un mensaje real a la página entran a la
bandeja de `wline-ext.morales-tec.xyz`; el agente del CRM contesta solo y un
operador puede responder a mano (Historia 4).

## El problema

1. **El código existe, pero está apagado y no es el nuestro.** Wline-ext corre
   la imagen `ghcr.io/kevinrivm/vocero-crm:1.6.0`. Su `/api/health` reporta
   `channels: ["whatsapp"]`: falta la bandera `CHANNELS`. Además, nada de lo que
   cambie este fork llega a producción mientras la app use la imagen de Kevin.
2. **Instagram por Zernio guarda un id inventado en cada envío.**
   `sendViaZernio` ([instagram/send.ts:46](../../src/server/instagram/send.ts))
   es una copia propia del transporte que lee `message.id` o `id`. La API real
   responde `{ success, data: { messageId } }`, así que siempre termina en
   `zernio_<hora>`. La 022 corrigió esto en `sendZernioMessage` para Messenger y
   TikTok ([bitácora:140](../../docs/bitacora-2.0.md)), pero Instagram nunca usó
   ese transporte. Las pruebas no lo ven porque el mock sigue respondiendo la
   forma vieja ([zernio-mock:154](../../src/app/api/dev/zernio-mock/%5B...path%5D/route.ts)).
3. **La hora de la conversación puede retroceder.** Cada mensaje entrante que
   no es duplicado sobrescribe `lastInboundAt` y `lastMessageAt` con su propia
   hora ([inbox/ingest.ts:510](../../src/server/inbox/ingest.ts)). Zernio
   reintenta hasta 7 veces durante unas 51 h. Si la primera entrega de un mensaje
   falla y su reintento llega después de uno más nuevo, la ventana de 24 h se
   acorta y la conversación baja en la lista.

## Decisiones

- **D1 — Un solo transporte de Zernio.** Instagram envía con
  `sendZernioMessage`, igual que Messenger
  ([messenger/send.ts:55](../../src/server/messenger/send.ts)).
  - Se borran `sendViaZernio` y la constante `ZERNIO_BASE` duplicada de
    `instagram/send.ts`. `fetchJson` se queda porque lo usa el camino de Meta
    directo.
  - El error sin referencia de hilo (400) y la traducción de un 401 a
    `reconnect_required` se mantienen: `sendZernioMessage` lanza el mismo
    `MetaApiError`.
- **D2 — La hora de la conversación nunca retrocede.** En la ingesta,
  `lastInboundAt` y `lastMessageAt` pasan a `greatest(<columna>, <hora del
  mensaje>)`. En PostgreSQL `greatest` ignora los nulos, así que una
  conversación nueva toma la hora del mensaje.
  - El mensaje tardío entra igual al hilo, ordenado por su propia hora, y
    `unreadCount` suma como hoy.
  - Vale para todos los canales, WhatsApp incluido: el núcleo es compartido y
    los webhooks de Meta tampoco garantizan orden.
- **D3 — El mock responde como la API real.** El envío del mock de Zernio
  devuelve `{ success: true, data: { messageId, conversationId } }`, sin la
  forma vieja. Así, cualquier transporte que lea otra forma falla en las pruebas
  y no en producción.
- **D4 — Imagen propia desde el fork.**
  - El tag `v1.6.0-wline.1` dispara [imagen.yml](../../.github/workflows/imagen.yml),
    que publica `ghcr.io/diegomoralesconexiones/wline-ext:1.6.0-wline.1`. Al ser
    una versión preliminar, no genera `latest` ni `1.6`.
  - El paquete se marca público una vez. No lleva secretos: el
    [Dockerfile](../../Dockerfile) solo fija variables inofensivas.
  - En Coolify, Wline-ext cambia la imagen y la etiqueta.
  - `package.json` no cambia de versión. El build se identifica por el `commit`
    que reporta `/api/health`, que la imagen hornea (`SOURCE_COMMIT`).
- **D5 — Encendido sin tocar el webhook a mano.**
  - `CHANNELS=whatsapp,instagram,messenger` va en Coolify como variable de
    ejecución.
  - La llave de Zernio la guarda el dueño desde Ajustes. Al guardarla, el CRM
    crea el webhook con un secreto aleatorio
    ([conexiones.ts:280](../../src/server/zernio/conexiones.ts)).
  - El webhook nunca se crea en el panel de Zernio: quedaría sin secreto y la
    firma no protegería nada
    ([dispatch.ts:86](../../src/server/zernio/dispatch.ts)).
- **D6 — Local primero, después en vivo (Principio IX).**
  1. Gate técnico y E2E con mocks en verde.
  2. Despliegue en la hora de menos tráfico.
  3. Evento de prueba de Zernio (`POST /v1/webhooks/test`).
  4. DMs reales desde las cuentas personales del dueño, nunca a terceros.
- **D7 — Mantener el fork.** Mientras Wline-ext use la imagen propia, no se
  vuelve a la de Kevin salvo que su versión incluya D1–D3 y D8. Para traer una
  versión nueva de Kevin: *Sync fork*, gate verde y tag `v<versión>-wline.<n>`.
- **D8 — Las respuestas largas del agente se parten (Q1 = A).** Si el texto de
  la IA no cabe en el límite del canal, se envía en varios mensajes que sí
  caben, en orden, cortando primero por párrafos, después por frases y después
  por palabras.
  - Se mide el texto final, ya sin marcas de formato en los canales `plain`.
  - El límite es el que declara el canal en `CHANNEL_CAPABILITIES`: bytes en
    Instagram y Messenger, caracteres en WhatsApp y TikTok. Por eso el mismo
    arreglo evita también el silencio en esos canales.
  - Lo que escribe una persona no se parte: el operador ve el error de largo
    como hoy.
  - Detalle de diseño en [research.md](research.md) (R1).

## Alcance

**Entra**:

- D1 en `src/server/instagram/send.ts`.
- D2 en `src/server/inbox/ingest.ts`.
- D3 en `src/app/api/dev/zernio-mock/[...path]/route.ts`.
- D8 en `src/server/channels/capabilities.ts` (el divisor, puro) y
  `src/server/ai/pipeline.ts` (`deliverReply` lo usa).
- Las pruebas que demuestran D1–D3 y D8 (ver «Estrategia de pruebas»).
- La publicación de la imagen (D4), la configuración de Coolify y Zernio (D5) y
  la prueba en vivo (D6), registrada al final de esta spec.

**Fuera de alcance a propósito**:

| Qué | Por qué no |
|---|---|
| Meta directo (app propia) | Requiere App Review; Zernio ya lo resuelve. |
| PR a Kevin | El fork es la fuente (D7). Queda opcional para el futuro. |
| TikTok | No es parte de la meta. Sigue funcionando igual y su E2E debe quedar verde. |
| Adjuntos de salida, mensajes escritos desde la app nativa, acuses de entregado/leído | Son funciones nuevas; «entra y se responde» no las necesita. |
| Guardar el webhook antes de responder 200 (hallazgo 1) | Requiere diseño; va en una spec posterior. |
| `Idempotency-Key` en los envíos (hallazgo 3) | Según Zernio, la llave solo cubre «salió, pero se perdió la respuesta», y el id de Vocero nace después del envío. Requiere diseño. |
| Lista de despegue automatizada | Sirve cuando se repita por cliente, no para el primer despegue. |
| Cambiar el prompt o el nombre «asistente de WhatsApp» en redes | Es cosmético y no está en la meta. El largo de las respuestas lo resuelve D8. |
| Partir lo que escribe el operador | Una persona puede acortar su texto; el error de largo ya se lo dice. |

## Comportamiento observable

### Historia 1 — Instagram por Zernio guarda el id real (P1)

- **AC1** Al enviar texto por Instagram vía Zernio, sea el operador o el
  agente, el mensaje saliente guarda como id de plataforma el `data.messageId`
  que respondió Zernio, nunca `zernio_<hora>`.
- **AC2** El envío lleva `accountId` y el `conversationId` del hilo. Fuera de la
  ventana de 24 h, y solo si escribe una persona, lleva además `MESSAGE_TAG` +
  `HUMAN_AGENT`. Es lo mismo que hoy.
- **AC3** Una conversación sin referencia de hilo falla con el mismo error de
  hoy («no tiene referencia de hilo en Zernio»). Un 401 de Zernio sigue
  marcando la conexión como `reconnect_required`.

### Historia 2 — La hora de la conversación no retrocede (P1)

- **AC4** Si llega un mensaje entrante con una hora anterior a la del último ya
  registrado (un reintento tardío que no es duplicado), aparece en el hilo en
  su lugar cronológico. `lastInboundAt` y `lastMessageAt` de la conversación
  no cambian.
- **AC5** Un mensaje con hora posterior los avanza como hoy, en todos los
  canales.

### Historia 3 — Las pruebas ven la forma real de Zernio (P1)

- **AC6** El mock responde al envío
  `{ success: true, data: { messageId, conversationId } }`.
- **AC7** Al menos un E2E afirma que el id guardado de un envío de Instagram por
  Zernio es el `messageId` del mock. Esa afirmación debe **fallar con el código
  de hoy** y pasar con D1: es la prueba de que detecta el hallazgo.
- **AC8** `pnpm test:e2e`, `e2e-canales`, `e2e-messenger`, `e2e-tiktok`,
  `e2e-ventana-social` y `e2e-despacho` quedan en verde.

### Historia 4 — Encendido en producción (P1)

- **AC9** Tras desplegar, `https://wline-ext.morales-tec.xyz/api/health`
  reporta el commit del tag, `commitVerified: true` y `channels` con
  `whatsapp`, `instagram` y `messenger`.
- **AC10** Al guardar la llave de Zernio, Ajustes → Canales muestra sanas la
  cuenta de Instagram y la página, y el webhook apuntando a esta instancia con
  secreto. No aparece `sin_https`, `sin_conexiones` ni `zernio_unavailable`.
- **AC11** El evento de prueba de Zernio llega firmado y Wline-ext responde
  200, visible en el log de webhooks de Zernio.
- **AC12** Un DM real desde la cuenta personal del dueño a la cuenta de
  Instagram del negocio aparece en la bandeja en segundos, y el agente contesta
  solo; la respuesta llega al teléfono. Después, una respuesta escrita a mano
  por un operador también llega.
- **AC13** Lo mismo con un mensaje a la página de Facebook por Messenger.
- **AC14** WhatsApp sigue entrando y saliendo igual: un mensaje real de ida y
  vuelta.

### Historia 5 — Una respuesta larga del agente llega igual (P1)

- **AC17** Si el agente produce para Instagram un texto de más de 1.000 bytes,
  el cliente recibe varios mensajes de 1.000 bytes o menos cada uno, en orden.
  Juntos contienen el texto completo, y cada corte cae en un párrafo, una frase
  o, como último recurso, una palabra.
- **AC18** Lo mismo en Messenger con su límite de 2.000.
- **AC19** Una respuesta que cabe sale en un solo mensaje, como hoy.
- **AC20** En una conversación del Laboratorio (`is_test`), la respuesta larga
  queda guardada en las mismas partes, sin tocar ninguna API.

### Camino infeliz

- **AC15** Si Zernio no responde al enviar, el operador ve «Instagram (o
  Messenger) no está disponible en este momento» y nada se cuelga. Se verifica
  con el mock caído.
- **AC16** Una entrega con firma inválida responde 401 y no entra nada.
- **AC21** Si una de las partes de una respuesta larga falla porque la ventana
  se cerró, la conversación pasa a una persona como hoy (`ventana`) y no se
  mandan las partes restantes.

## Comandos

Gate técnico (el piso de la Definición de Hecho):

```bash
pnpm typecheck && pnpm lint && pnpm build && pnpm test
```

E2E con la app viva y los mocks encendidos (`WA_MOCK_ENABLED=true`,
`META_GRAPH_BASE_URL` → wa-mock, `OPENROUTER_BASE_URL` → ai-mock,
`ZERNIO_BASE_URL` → zernio-mock):

```bash
pnpm test:e2e
```

```bash
node --env-file=.env scripts/e2e-canales.mjs
```

```bash
node --env-file=.env scripts/e2e-messenger.mjs
```

Publicar la imagen (después del gate y los E2E en verde, desde `main`):

```bash
git tag v1.6.0-wline.1 && git push origin v1.6.0-wline.1
```

Verificar producción:

```bash
curl -s https://wline-ext.morales-tec.xyz/api/health
```

## Dónde vive el cambio

```
src/server/instagram/send.ts                    → D1 (transporte único)
src/server/inbox/ingest.ts                      → D2 (greatest en la ingesta)
src/app/api/dev/zernio-mock/[...path]/route.ts  → D3 (forma real)
src/server/channels/capabilities.ts             → D8 (divisor puro)
src/server/ai/pipeline.ts                       → D8 (deliverReply parte la respuesta)
src/server/dev/ai-mock.ts                       → D8 (disparador de respuesta larga, solo desarrollo)
tests/unit/                                     → unitarias de D1 y D8
scripts/e2e-*.mjs                               → afirmaciones de AC4, AC7
.github/workflows/imagen.yml                    → sin cambios; lo dispara el tag
Coolify (fuera del repo)                        → imagen, etiqueta, CHANNELS
```

## Estilo

Se escribe igual que el código de alrededor: comentarios en español que
explican el porqué y un solo módulo por frontera. D1 deja Instagram con la
misma forma que Messenger:

```ts
export async function sendInstagramText(input: { … }): Promise<InstagramSendResult> {
  // 031: un solo transporte de Zernio para todos los canales. La copia que
  // vivía aquí leía una respuesta que la API ya no da y guardaba un id
  // inventado en cada envío.
  if (input.credentials.source === "zernio") {
    return sendZernioMessage({
      token: input.credentials.token,
      accountId: input.credentials.accountRef,
      conversationId: input.threadRef,
      text: input.text,
      humanAgentTag: input.humanAgentTag,
    });
  }
  return sendViaMeta(input);
}
```

## Estrategia de pruebas

| Nivel | Qué prueba | Dónde |
|---|---|---|
| Unitaria (Vitest) | D1: con el `fetch` simulado, un envío de Instagram por Zernio devuelve el `data.messageId`, manda `accountId` y la etiqueta fuera de ventana, y sin hilo falla igual que hoy | `tests/unit/` |
| Unitaria (Vitest) | D8: el divisor respeta el límite del canal, corta en párrafo → frase → palabra, no parte emojis, no deja partes vacías y devuelve una sola parte si cabe | `tests/unit/` |
| E2E (mocks) | D2: dos eventos de Zernio fuera de orden; la conversación conserva la hora del más nuevo (AC4/AC5) | `e2e-ventana-social`, que ya inyecta eventos con `sentAt` (plan, R5) |
| E2E (mocks) | D8: una respuesta larga del agente en Instagram llega en partes al mock de Zernio (AC17–AC19) | `e2e-ventana-social` o `e2e-canales` (plan, R6) |
| E2E (mocks) | D1 + D3: el id guardado de Instagram es el del mock (AC7); el mock caído degrada sin colgarse (AC15) | `e2e-canales` o `e2e-messenger` |
| Regresión | Todos los E2E de canales y despacho en verde (AC8) | `pnpm test:e2e` y los guiones nombrados |
| En vivo | Historia 4 | Producción, con las cuentas del dueño |

Primero se escribe la prueba que falla y después el arreglo
(`test-driven-development`).

En la prueba en vivo, mandar el DM desde las cuentas personales del dueño es
lo único que no pueden hacer las herramientas (Principio IX). Lo demás lo
verifica quien implementa: el healthcheck, Ajustes → Canales en el navegador
con la sesión del dueño, el log de webhooks y la bandeja.

## Límites

- **Siempre**:
  - Correr el gate técnico y los E2E antes del tag.
  - Crear el tag solo desde un `main` en verde.
  - Escribir la prueba que falla antes del arreglo.
  - Respetar el sandbox: las conversaciones `is_test` nunca tocan la API real.
- **Preguntar antes**:
  - Crear o empujar el tag.
  - Cambiar la imagen, la etiqueta o `CHANNELS` en Coolify, o redesplegar.
  - Cambiar la visibilidad del paquete.
  - Mandar el evento de prueba de Zernio.
  - Tocar cualquier archivo fuera de «Dónde vive el cambio».
- **Nunca**:
  - Escribir la llave de Zernio o cualquier secreto en el chat, logs, commits
    o en esta spec. La guarda el dueño desde Ajustes.
  - Crear el webhook a mano en el panel de Zernio.
  - Tocar las otras apps de Coolify (`wline-app`, `nea`).
  - Volver a la imagen de Kevin sin D1–D3 y D8.
  - Escribir a terceros durante la prueba.

## Criterios de éxito

La feature está Hecha cuando se cumplen todos estos puntos:

1. Gate técnico en verde.
2. AC1–AC8 y AC15–AC21 verificados con mocks.
3. Imagen `1.6.0-wline.1` publicada y desplegada en Wline-ext.
4. AC9–AC14 verificados en producción y registrados en «Prueba en vivo».

## Requisitos no funcionales

- D2 no agrega consultas: es la misma actualización, con `greatest`.
- La imagen se construye en GitHub Actions; ningún build corre en el VPS.

## Constitution Check

| Principio | Evaluación |
|---|---|
| I · Seguridad | La llave de Zernio la guarda el dueño y queda cifrada como hoy. El webhook nace con secreto (D5). No sale ningún secreto a logs ni respuestas. La imagen pública no lleva secretos (D4). |
| II · Soberanía | Zernio ya es un conector opcional detrás de `CHANNELS` (ADR-001). No hay dependencias nuevas. |
| III · Multi-tenancy | No se toca `scoped()` ni el reparto por organización; D2 actualiza la misma fila de siempre. |
| IV · Idempotencia | El dedup por id de mensaje no cambia. D2 vuelve monotónica la hora de la conversación, que hoy no lo es. |
| V · Hecho | Gate técnico, unitarias de D1 y E2E de D2/D3 con la prueba que falla primero (AC7). |
| VI · Specs | Carril ligero, declarado arriba; tareas con `planning-and-task-breakdown`. |
| VII · Trazabilidad | Los supuestos sin confirmar están en «Preguntas abiertas» y en el one-pager. |
| VIII · Foco | Atender conversaciones de UN negocio por más canales; no agrega superficie nueva. |
| IX · En vivo | Local primero (D6) y después producción con las cuentas del dueño. El único paso delegado es mandar el DM, marcado arriba. |
| Contratos públicos | Ninguno cambia. |
| Sandbox | Sin cambios: `prepareSend` sigue cortando las conversaciones `is_test` antes de cualquier transporte. |

Sin violaciones.

## Preguntas resueltas

- **Q1 — Respuestas largas del agente → A (partir), resuelta el 2026-10-21.**
  Hoy, si el agente escribe más de 1.000 bytes en Instagram (o más de 2.000 en
  Messenger), el envío falla ([send.ts:698](../../src/server/inbox/send.ts)) y
  el turno termina sin respuesta, porque `deliverReply` relanza el error
  ([pipeline.ts:416](../../src/server/ai/pipeline.ts)). El prompt pide
  «mensajes breves», pero no fija un tope. Se resuelve con D8.
- **Q2 — Ventana de despliegue → cualquier hora, resuelta el 2026-10-21.**
  Los canales sociales aún no reciben mensajes y WhatsApp tiene poco
  movimiento.

## Prueba en vivo

*Se llena al ejecutar D6: fecha, commit, resultado de AC9–AC14 y cualquier
desviación.*
