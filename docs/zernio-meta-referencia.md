# Referencia: Zernio y Meta para Instagram y Messenger

Resumen propio de la documentación oficial de Zernio y de Meta, en lo que le
importa a Vocero para operar Instagram y Messenger por Zernio. **No es una
copia**: la fuente de verdad son los enlaces de cada sección, y cualquier
discrepancia se resuelve a favor de ellos. Consultado el **2026-10-21**.

Zernio publica su documentación también en texto plano para agentes:
[docs.zernio.com/llms.txt](https://docs.zernio.com/llms.txt) (índice de todas
las páginas `.mdx`).

---

## 1. Zernio

### 1.1 Modelo

- Una llave de API ve las cuentas conectadas a los perfiles de esa cuenta de
  Zernio. El perfil es la frontera de tenant.
- Los webhooks son del usuario (máximo 50) y cada suscripción puede fijarse a
  `accountIds` y/o `profileIds`: solo recibe eventos de esas cuentas. Zernio
  sugiere usarlo para mandar cuentas de prueba a un endpoint de staging.
- Fuente: [Webhooks](https://docs.zernio.com/webhooks),
  [Create webhook](https://docs.zernio.com/webhooks/create-webhook-settings).

### 1.2 Webhooks: firma, deduplicación y reintentos

| Tema | Lo que dice Zernio |
|---|---|
| Firma | `X-Zernio-Signature` = HMAC-SHA256 en hex minúsculas del **cuerpo crudo**, con el secreto del endpoint. `X-Late-Signature` es el alias heredado con el mismo valor. Solo firma si el endpoint tiene `secret`. |
| Deduplicación | El `id` del evento (también en `X-Zernio-Event-Id`) es estable: igual en cada reintento y en cada reentrega manual. |
| Éxito | Un `2xx` en menos de **5 s**. Cualquier otra cosa programa el siguiente intento. |
| Reintentos | Hasta **7 intentos** con backoff exponencial: inmediato, 10 s, 1 min 40 s, 16 min 40 s, 2 h 46 min 40 s, 24 h, 24 h. Acumulado: unas **51 h**. Después, cola de mensajes muertos. |
| Reentrega manual | Reenvía el payload original, byte por byte, conservando el id del evento. Solo dentro de los 30 días de logs. |
| Auto-desactivación | Si el endpoint pasa 3 días sin una entrega exitosa **y** acumula 20 fallos terminales seguidos (o 3 días fallando), Zernio lo desactiva y avisa por correo. Se reactiva con `isActive: true`. |
| Prueba | `POST /v1/webhooks/test` manda un evento de muestra firmado como uno real, marcado `test: true`. |

Fuente: [Webhooks](https://docs.zernio.com/webhooks),
[Redeliver](https://docs.zernio.com/webhooks/redeliver-webhook-event),
[Test webhook](https://docs.zernio.com/webhooks/test-webhook).

### 1.3 Eventos de la bandeja

| Plataforma | Eventos |
|---|---|
| Instagram | `message.received`, `message.sent`, `message.edited`, `message.deleted`, `message.read` |
| Facebook (Messenger) | `message.received`, `message.sent`, `message.edited`, `message.delivered`, `message.read` |

Al conectar una cuenta, Zernio reimporta de Meta hasta **500 mensajes por
conversación** anteriores a la conexión. Llegan como leídos y **no disparan
webhooks**.

Las URLs de adjuntos de Instagram y Facebook expiran. Para tener una URL
estable hay un endpoint de resolución por mensaje y posición. Los webhooks no
traen esa URL lista: hay que armarla con `conversationId`,
`platformMessageId`, la posición y `accountId`.

Fuente: [Instagram · Inbox](https://docs.zernio.com/platforms/instagram/inbox),
[Facebook · Inbox](https://docs.zernio.com/platforms/facebook/inbox),
[Resolve attachment](https://docs.zernio.com/messages/get-message-attachment).

### 1.4 Enviar un mensaje

`POST /v1/inbox/conversations/{conversationId}/messages`, con `accountId` y
`message` en el cuerpo.

- **Fuera de la ventana de 24 h:** `messagingType: "MESSAGE_TAG"` más
  `messageTag`.
  - Instagram admite solo `HUMAN_AGENT`.
  - Facebook admite `CONFIRMED_EVENT_UPDATE`, `POST_PURCHASE_UPDATE`,
    `ACCOUNT_UPDATE` y `HUMAN_AGENT`.
- **Respuesta 200:** `{ success, data: { messageId, conversationId, … }, warnings? }`.
  - `data.messageId` es el id del mensaje **en la plataforma**, el mismo que
    los webhooks entregan como `message.platformMessageId`.
- `replyTo` (citar un mensaje) no existe en Instagram ni en Messenger. El envío
  sale sin cita y la respuesta trae un aviso `ignored_field`.
- **`Idempotency-Key`:**
  - Válida 24 h. Con la misma llave y el mismo cuerpo, Zernio repite la
    respuesta original (`Idempotent-Replayed: true`) en vez de enviar otra vez.
    Con otro cuerpo responde 422; si la primera petición sigue en curso, 409.
  - Solo guarda respuestas `2xx`. Ante un fallo ambiguo (5xx o timeout) la
    llave se libera, y reintentar a ciegas puede duplicar. Zernio recomienda
    revisar los mensajes de la conversación antes de reintentar.

Fuente: [Send message](https://docs.zernio.com/messages/send-inbox-message).

---

## 2. Meta: Instagram y Messenger

| Tema | Regla |
|---|---|
| Ventana estándar | 24 h desde el último mensaje de la persona. Dentro de ella se puede responder, incluso con contenido promocional. |
| `messaging_type` | `RESPONSE` (respuesta), `UPDATE` (proactivo dentro de la ventana), `MESSAGE_TAG` (fuera de la ventana, nunca promocional). |
| Etiqueta `HUMAN_AGENT` | Permite que **una persona** responda a mano hasta **7 días** después. Su uso permitido es el soporte humano que no se resolvió dentro de la ventana. En Instagram es la única etiqueta disponible. |
| Camino a un humano | Una experiencia puede empezar automatizada, pero debe permitir que la persona hable con un agente humano. |
| Texto en Instagram | UTF-8, **1.000 bytes** o menos. |
| Texto en Messenger | UTF-8, **menos de 2.000 caracteres**. |
| Hosts | Instagram con Instagram Login: `graph.instagram.com/{IG_ID}/messages`. Messenger: `graph.facebook.com/{PAGE_ID}/messages`. Ambos responden `{ recipient_id, message_id }`. |
| Acceso estándar | Una app propia con acceso estándar solo puede escribir a personas con rol en la app. Aplica solo a Meta directo, no a Zernio. |

Fuentes:
[Send API (Messenger)](https://developers.facebook.com/docs/messenger-platform/reference/send-api/),
[Política de Messenger e Instagram](https://developers.facebook.com/docs/messenger-platform/policy/policy-overview/),
[Instagram · Send a Message](https://developers.facebook.com/docs/messenger-platform/instagram/features/send-message/),
[Instagram API with Instagram Login · Messaging](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/messaging-api),
[Instagram Messaging · Overview](https://developers.facebook.com/docs/messenger-platform/instagram/).

---

## 3. Contraste con el código de Vocero

✅ coincide · ⚠️ coincide con matiz · ❌ no coincide

| Tema | Vocero | Estado |
|---|---|---|
| Firma de Zernio | HMAC-SHA256 hex del cuerpo crudo, acepta los dos encabezados ([zernio/index.ts:38](../src/server/zernio/index.ts)) | ✅ |
| Secreto en una conexión nueva | Si no hay ninguno, genera uno aleatorio y lo deja en Zernio y en todos los canales ([conexiones.ts:280](../src/server/zernio/conexiones.ts)) | ✅ |
| ACK en menos de 5 s | Responde 200 y procesa en `after()` (rutas de `/api/webhooks/ig` y `/messenger`) | ✅ |
| Deduplicación | Por el id del mensaje de Zernio, prefijado `ig_`/`fb_`, con índice único | ✅ |
| Ventana de reintentos | El comentario dice «backoff de hasta 24 h» ([zernio/index.ts:109](../src/server/zernio/index.ts)); en realidad son unas **51 h** acumuladas | ⚠️ Refuerza el hallazgo 2: un reintento tardío puede llegar después de que cierre la ventana |
| Respuesta de envío, Messenger | `sendZernioMessage` lee `data.messageId` ([zernio/index.ts:194](../src/server/zernio/index.ts)) | ✅ |
| Respuesta de envío, Instagram | `sendViaZernio` propio lee `message.id` o `id` y cae a `zernio_<hora>` ([instagram/send.ts:81](../src/server/instagram/send.ts)) | ❌ Hallazgo 4, confirmado por la documentación oficial |
| Mock de Zernio | Responde `{ message: { id } }`, la forma vieja ([zernio-mock](../src/app/api/dev/zernio-mock/%5B...path%5D/route.ts)) | ❌ Por eso las pruebas no detectan el hallazgo 4 |
| `Idempotency-Key` | `sendZernioMessage` la soporta; ningún llamador la pasa | ❌ Matiz: solo protege el caso «salió, pero se perdió la respuesta» |
| Etiqueta fuera de la ventana | `MESSAGE_TAG` + `HUMAN_AGENT` en los dos canales; la IA nunca la usa ([send.ts:114](../src/server/inbox/send.ts)) | ✅ Coincide con la política de Meta |
| Límite de texto, Instagram | 1.000 bytes | ✅ |
| Límite de texto, Messenger | 2.000 **bytes** frente a 2.000 caracteres | ⚠️ Más estricto que Meta: seguro, pero rechaza algunos textos largos con acentos que Meta aceptaría |
| Eventos que no son entrantes | Se ignoran (`message.received` + `incoming`) | ✅ Los acuses (`delivered`/`read`) existen en Zernio pero quedan fuera de alcance |
| Historial al conectar | Llega sin webhooks | ✅ Conectar no dispara al agente sobre mensajes viejos |
| Webhook desactivado | Si Wline-ext pasa 3 días sin responder, Zernio apaga el webhook | ⚠️ Revisarlo en Ajustes → Canales → Estado |

## 4. Qué cambia para la salida a producción

1. **El hallazgo 4 va primero.** Lo confirma la documentación oficial, y es la
   misma falla que la [bitácora](bitacora-2.0.md) dio por resuelta en la 022
   para Messenger.
2. **El mock debe responder como la API real** (`{ success, data: { messageId } }`),
   para que el E2E existente detecte esta clase de error.
3. **No hay que crear el webhook a mano en el panel de Zernio.** Al guardar la
   conexión, el CRM lo crea con su secreto. Uno creado a mano sin secreto
   dejaría la firma apagada ([dispatch.ts:86](../src/server/zernio/dispatch.ts)).
4. **Un deploy no pierde mensajes por estar caído.** Zernio reintenta a los
   10 s. El único riesgo es que el proceso muera entre el 200 y el guardado
   (hallazgo 1).
5. **Antes del primer DM real**, usar el evento de prueba de Zernio
   (`POST /v1/webhooks/test`) para validar la firma de punta a punta.
