# Research: 031 — Instagram y Messenger por Zernio en producción

Fase 0 de `speckit-plan`. Cada decisión resuelve una incógnita del contexto
técnico. Las fuentes externas están resumidas en
[docs/zernio-meta-referencia.md](../../docs/zernio-meta-referencia.md).

## R1 — Cómo se parte una respuesta larga del agente (D8, Q1 = A)

**Decisión**:

- **Un divisor puro, `splitToFit(channel, text): string[]`**, en
  `src/server/channels/capabilities.ts`, junto a `textFits`. Mide con
  `textFits`, así que respeta el límite que declare cada canal: bytes o
  caracteres.
- **Corte en cascada, llenando cada parte al máximo:**
  1. Por párrafos (líneas en blanco).
  2. Si un párrafo no cabe, por frases (después de `.`, `!`, `?` o `…` seguido
     de espacio).
  3. Si una frase no cabe, por palabras.
  4. Si una palabra no cabe, por puntos de código (`Array.from`), para no
     partir nunca un emoji ni una letra acentuada.
- **Cada parte se recorta** y las vacías se descartan. Dentro de una parte se
  conserva el separador original: línea en blanco entre párrafos, espacio entre
  frases o palabras.
- **Tope de 5 partes.** Si el texto necesitaría más, la quinta se corta en una
  palabra y termina en «…». Queda un `console.warn` con el id de la
  conversación, nunca con el texto.
- **Se usa en `deliverReply`** ([pipeline.ts:387](../../src/server/ai/pipeline.ts))
  a través de `replyParts(channel, text)`, también puro y en `capabilities.ts`,
  que junta los dos primeros pasos para poder probarlos sin base de datos:
  1. Calcula el texto final como lo haría `sendText`: `plainSocialText` si el
     canal es `plain`.
  2. Lo parte con `splitToFit`.
  3. Llama a `sendText` por cada parte, en orden y esperando cada una.
  4. El corte ocurre antes de separar el Laboratorio, así que `is_test` guarda
     las mismas partes (AC20).
- **Si una parte falla, se respetan las reglas de hoy:**
  - `window_closed` → traspaso por `ventana` y no salen las demás (AC21).
  - `message_limit` (TikTok) → se detiene y la IA sigue activa.
  - Cualquier otro error se relanza.

**Rationale**:

- El silencio es el peor fallo del agente (spec 029). Partir lo evita sin tocar
  el prompt ni el modelo.
- Medir **después** de `plainSocialText` evita contar marcas que luego
  desaparecen, y evita cortar a la mitad de una marca.
- El tope protege del envío en ráfaga: Meta limita por destinatario, y el
  Principio IX pide anti-ráfaga. Cinco partes de 1.000 bytes ya es más de lo
  que cabe en un chat.
- Como se mide con las capacidades del canal, el mismo código evita el
  silencio en WhatsApp (más de 4.096 caracteres) y en TikTok (más de 6.000),
  sin ramas por canal.

**Supuesto que se prueba**: `sendText` vuelve a aplicar `plainSocialText` a
cada parte, así que esa función debe ser idempotente: aplicarla dos veces da lo
mismo que una. Lo afirma una prueba unitaria. Si no lo fuera, `deliverReply`
pasa el texto ya limpio y `sendText` no lo vuelve a tocar.

**Alternativas evaluadas**:

- *Partir dentro de `sendText`.* Cambia lo que devuelve (un id por envío) para
  todos sus llamadores, incluido el operador. Además, el operador no debe
  partirse (ver «Fuera de alcance» de la spec).
- *Partir antes de `plainSocialText`.* Mediría marcas que luego desaparecen y
  podría dejar un `**` a cada lado de un corte.
- *Truncar sin partir.* El cliente pierde información sin saberlo.
- *Poner el tope en el prompt.* Un modelo no garantiza el largo; el silencio
  seguiría siendo posible.

## R2 — Ventana de despliegue (Q2)

**Decisión**: cualquier hora.

**Rationale**: los canales sociales aún no reciben mensajes y WhatsApp tiene
poco movimiento (respuesta del dueño, 2026-10-21). Además, un deploy no pierde
entregas de Zernio por estar caído, porque reintenta a los 10 s (R4). El único
riesgo es el del hallazgo 1, que queda fuera de alcance.

## R3 — Forma de la respuesta de envío de Zernio (D1, D3)

**Decisión**: el id del mensaje se lee de `data.messageId`.

**Rationale**: es la respuesta documentada de
`POST /v1/inbox/conversations/{conversationId}/messages`:
`{ success, data: { messageId, conversationId, … } }`. `data.messageId` es el
id en la plataforma, el mismo que los webhooks entregan como
`message.platformMessageId`. La bitácora de la 022 ya lo había confirmado contra
la API real ([bitácora:140](../../docs/bitacora-2.0.md)).

**Alternativas evaluadas**: mantener los dos transportes y corregir solo la
lectura del de Instagram. Se rechaza porque dos copias del mismo cliente son
dos sitios donde equivocarse, y eso es justo lo que pasó.

## R4 — Ventana de reintentos de Zernio (D2)

**Decisión**: tratar como normal que un mensaje llegue hasta unas 51 h tarde y
fuera de orden.

**Rationale**: Zernio hace hasta 7 intentos (inmediato, 10 s, 1 min 40 s,
16 min 40 s, 2 h 46 min, 24 h, 24 h) y después manda el evento a la cola de
mensajes muertos. Una reentrega manual conserva el id del evento. El comentario
de [zernio/index.ts:109](../../src/server/zernio/index.ts) habla de «hasta
24 h»: se corrige de paso, porque es justo el supuesto que D2 resuelve.

## R5 — `greatest` en PostgreSQL y dónde se prueba (D2)

**Decisión**:

- La actualización de la ingesta usa
  `sql\`greatest(${schema.conversation.lastInboundAt}, ${waTimestamp})\``, y lo
  mismo para `lastMessageAt`.
- Se prueba en `scripts/e2e-ventana-social.mjs`. Ese guion ya inyecta eventos de
  Zernio con `sentAt` en el pasado y lee `lastInboundAt` desde la bandeja.

**Rationale**: en PostgreSQL, `greatest` ignora los nulos y solo devuelve nulo
si todos los argumentos lo son. Una conversación recién creada toma la hora del
mensaje sin necesidad de `coalesce`. Es la misma consulta de hoy, sin lecturas
extra.

**Alternativas evaluadas**: leer la conversación y comparar en TypeScript. Son
dos viajes a la base y pueden competir dos ingestas a la vez; `greatest` en la
misma actualización es atómico.

## R6 — Cómo pedirle al ai-mock una respuesta larga (D8, AC17–AC19)

**Decisión**: una regla nueva en `src/server/dev/ai-mock.ts`. Si el mensaje del
cliente contiene «respuesta larga», el mock contesta un texto fijo de unos
2.500 bytes: tres párrafos con acentos y un emoji. El E2E manda ese DM por
Instagram y comprueba en el estado del mock de Zernio que llegaron varias
partes, cada una de 1.000 bytes o menos, en orden y con el texto completo. Otro
mensaje normal comprueba que sale en una sola parte (AC19).

**Rationale**: hoy el mock repite como mucho 80 caracteres del cliente
([ai-mock.ts:185](../../src/server/dev/ai-mock.ts)), así que nunca produce una
respuesta larga. El mock vive tras el gate de `dev-guard`: en producción
responde 404.

**Alternativas evaluadas**: probar D8 solo con unitarias. No demuestra el
camino real de `deliverReply` → `sendText` → transporte, que es donde hoy se
pierde la respuesta.

## R7 — Etiquetas de la imagen propia (D4)

**Decisión**: tag `v1.6.0-wline.1`. Según el comportamiento documentado de
`docker/metadata-action`, una versión preliminar solo produce la etiqueta
`{{version}}` (`1.6.0-wline.1`) y `sha-<commit>`, sin `1.6` ni `latest`.

**Riesgo**: el nombre de la imagen sale de `github.repository`
(`diegomoralesconexiones/Wline-ext`), que tiene una mayúscula, y Docker exige
minúsculas. `metadata-action` normaliza el nombre; se confirma en la primera
publicación. Si el build fallara por eso, se fija el nombre en minúsculas en
`imagen.yml`. Es un cambio de CI y se pregunta antes.

## R8 — Visibilidad del paquete (D4)

**Decisión**: el paquete se hace público una vez, después de la primera
publicación: *Package settings* → *Change visibility* → *Public*.

**Rationale**:

- El fork ya es público.
- El [Dockerfile](../../Dockerfile) solo fija `NODE_ENV`,
  `NEXT_TELEMETRY_DISABLED`, `SOURCE_COMMIT`, `MEDIA_DIR`, `PORT` y `HOSTNAME`.
- Los secretos son variables de ejecución en Coolify.
- Así Coolify descarga la imagen sin credenciales.

**Alternativas evaluadas**: dejarla privada y dar a Coolify un token con
`read:packages` y `docker login` en el servidor. Son más piezas, y el token
caduca y rompe el deploy sin avisar.

## R9 — Cómo llega el código a `main` del fork y cómo se revierte

**Decisión**:

- El trabajo vive en la rama `feat/031-instagram-messenger-produccion`. Entra a
  `main` del fork por PR, con `ci.yml` y el build de `imagen.yml` en verde.
- El tag se crea sobre ese `main`.
- **Para revertir**, en Coolify:
  - Se vuelve a `ghcr.io/kevinrivm/vocero-crm:1.6.0`.
  - O se quitan `instagram` y `messenger` de `CHANNELS`.

**Rationale**: no hay migración. D2 y D8 no cambian nada guardado, así que
volver a la imagen anterior es seguro. Con la imagen de Kevin vuelve el
hallazgo 4, y por eso esa vuelta es solo de emergencia (D7).
