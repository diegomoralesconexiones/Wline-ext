# Contrato consumido: enviar un mensaje por Zernio

Vocero no publica ninguna interfaz nueva en la 031. Este archivo fija el
contrato **externo que consume** (la API de Zernio) y el que debe cumplir su
**mock** (D3), porque esa diferencia es la que dejó pasar el hallazgo 4.

Fuente: [Zernio · Send message](https://docs.zernio.com/messages/send-inbox-message),
consultada el 2026-10-21.

## Petición

```http
POST /v1/inbox/conversations/{conversationId}/messages
Authorization: Bearer <llave de Zernio>
Content-Type: application/json
Idempotency-Key: <opcional; fuera de alcance en la 031>
```

```json
{
  "accountId": "<id de la cuenta conectada>",
  "message": "<texto>",
  "messagingType": "MESSAGE_TAG",
  "messageTag": "HUMAN_AGENT"
}
```

- `conversationId` es opaco: se usa tal cual llegó en el webhook
  (`message.conversationId`), sin parsearlo.
- `messagingType` y `messageTag` solo van fuera de la ventana de 24 h, y solo
  cuando escribe una persona. En Instagram la única etiqueta válida es
  `HUMAN_AGENT`.

## Respuesta 200

```json
{
  "success": true,
  "data": {
    "messageId": "<id del mensaje en la plataforma>",
    "conversationId": "<id de la conversación en Zernio>"
  }
}
```

- **Vocero guarda `data.messageId`** como `wa_message_id` del saliente.
- Puede venir `warnings` (por ejemplo, `ignored_field` si se mandó `replyTo`
  en Instagram o Messenger). Vocero no usa `replyTo`.

## Errores

| Respuesta | Cómo lo traduce Vocero |
|---|---|
| 401 / llave inválida | `MetaApiError` con `isAuthError`: la conexión pasa a `reconnect_required`. |
| 4xx con `{ error }` | `MetaApiError` con el mensaje de Zernio: el operador lo ve tal cual. |
| 5xx o sin conexión | `meta_unavailable`: «… no está disponible en este momento». |

La traducción vive en `zernioFetch`
([zernio/index.ts](../../../src/server/zernio/index.ts)) y es la misma para
Messenger, TikTok y, desde D1, Instagram.

## Lo que debe cumplir el mock (D3)

`src/app/api/dev/zernio-mock/[...path]/route.ts` responde al envío
**exactamente** con la forma de arriba:

```json
{ "success": true, "data": { "messageId": "<id siguiente>", "conversationId": "<el del path>" } }
```

- Sin `message.id` ni `id` en la raíz. Si un transporte leyera esas formas
  viejas, la prueba de AC7 fallaría.
- Sigue guardando en `state.sent` lo que recibió: `conversationId`,
  `accountId`, `message`, `messagingType`, `messageTag`, `idempotencyKey` y
  `at`. De ahí leen los E2E para comprobar las partes de D8 y la etiqueta
  fuera de ventana.
- Sigue respetando `state.down`, que simula a Zernio caído (AC15).
