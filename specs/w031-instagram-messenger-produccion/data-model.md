# Data Model: 031 — Instagram y Messenger por Zernio en producción

**No hay migración.** Ninguna tabla ni columna cambia. Lo que cambia son las
reglas con que se escriben dos columnas y el id que se guarda en un caso.

## Conversación (`conversation`)

| Campo | Regla nueva | Antes |
|---|---|---|
| `last_inbound_at` | **Nunca retrocede** al ingerir un entrante: `greatest(last_inbound_at, hora del mensaje)` (D2). | Se sobrescribía con la hora del último entrante insertado, aunque fuera más viejo. |
| `last_message_at` | Igual al ingerir un entrante: `greatest(...)`. Un saliente la sigue poniendo en `now()`, que nunca es menor. | Igual que `last_inbound_at`. |
| `unread_count` | Sin cambio: cada entrante nuevo suma 1, aunque llegue tarde. | — |

**Invariante**: para una conversación, `last_inbound_at` es la hora del
entrante más reciente **por su propia hora**, no por la hora en que llegó. Lo
mismo vale para la ventana de 24 h, que se calcula desde esa columna
(`replyWindow`, [window.ts](../../src/server/inbox/window.ts)).

## Mensaje saliente (`message`, `direction = 'out'`)

| Caso | Regla nueva | Antes |
|---|---|---|
| Instagram por Zernio | `wa_message_id` = `data.messageId` de la respuesta de Zernio, el id real en la plataforma (D1). | `zernio_<hora>`, inventado. |
| Respuesta del agente que no cabe en el canal | **Una fila por parte** (D8): `ai_generated = true`, `origin = 'ai'`, `status = 'sent'` en los canales sin acuses. Se ordenan por `created_at`. | Ninguna fila: el envío fallaba y el turno terminaba sin respuesta. |

**Unicidad**: `wa_message_id` conserva su índice único. Con D1 deja de existir
la posibilidad remota de que dos envíos de Instagram en el mismo milisegundo
generaran el mismo `zernio_<hora>`.

**Datos existentes**: no se tocan. Wline-ext nunca tuvo Instagram encendido,
así que no hay filas con ids inventados que corregir.

## Lo que no cambia

- `contact`: la identidad sigue siendo `ig:<IGSID>` o `fb:<PSID>`, sin teléfono.
- `instagram_credentials`, `messenger_credentials`: el mismo cifrado (030) y el
  mismo secreto de webhook.
- El dedup de entrantes sigue siendo por `wa_message_id` (`ig_<id de Zernio>`,
  `fb_<id>`).
