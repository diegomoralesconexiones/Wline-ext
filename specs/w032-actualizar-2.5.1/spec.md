# Spec w032 — Wline-ext a Vocero 2.5.1 con Nea propio

**Rama**: `chore/actualizar-2.5.1` | **Fecha**: 2026-10-26 | **Estado**: Fase 1 en curso

Las specs propias del fork llevan el prefijo `w` para no chocar con la
numeración de vocero-crm (la 031 de Kevin es `031-nea-por-despacho`).

## Contexto

- Producción (Coolify, proyecto wline-ext) corre
  `ghcr.io/diegomoralesconexiones/wline-ext:1.6.0-wline.1`: Vocero 1.6.0 más
  la [w031](../w031-instagram-messenger-produccion/spec.md). Contesta el agente
  incluido; no hay `BOT_API_KEY` ni `BRAIN_DISPATCH_URL`.
- Canales en uso: WhatsApp, Instagram y Messenger. Funciones del agente que
  importan: mover de etapa y pasar a humano.
- Kevin publicó la 2.5.1 (2026-10-25). Desde la 2.0 el CRM no trae agente:
  contesta un cerebro aparte por el despacho (Nea). Ver
  [docs/migrar-a-2.0.md](../../docs/migrar-a-2.0.md).

## Objetivo

Wline-ext en 2.5.1, con las correcciones de la w031 conservadas y un Nea propio
contestando en los tres canales, probado en staging antes de producción.

## Decisiones

| Tema | Decisión |
|---|---|
| Versión destino | 2.5.1 (los mismos 4 conflictos que la 2.0.0). |
| Cerebro | Nea propio en [`diegomoralesconexiones/nea-wline-ext`](https://github.com/diegomoralesconexiones/nea-wline-ext), público, copia de `kevinrivm/nea-agent` 2.0.2 con remoto `upstream`. GitHub no permite un segundo fork de nea-agent en la cuenta. |
| Estilo de Nea | Se acepta y se afina con el perfil, el conocimiento y sus variables. |
| Pruebas | Staging en Coolify con base vacía y el número de prueba de Meta. |
| Corte | Puede haber minutos sin respuesta; no se escalona. |
| D8 | En el CRM, en `POST /api/bot/messages`, para cualquier cerebro. |

## Las correcciones de la w031 en la 2.5.1

| Corrección | En la 2.5.1 de Kevin | Aquí |
|---|---|---|
| D1/D3 Instagram guarda el id real | Sin corregir | Entra con la fusión |
| D2 La hora no retrocede | Sin corregir | Entra con la fusión |
| D8 Respuestas largas en partes | Sin corregir; `pipeline.ts` ya no existe | Re-ubicada en `/api/bot/messages` |

## Criterios de aceptación

- **AC1** La rama fusiona `v2.5.1` sin marcas de conflicto, y el gate
  (`typecheck`, `lint`, `build`, `test`) está en verde.
- **AC2** Un texto del cerebro que no cabe en el canal sale en partes que
  caben (1.000 bytes en Instagram, 2.000 en Messenger, 4.096 caracteres en
  WhatsApp), en orden y completo; lo que cabe sale en un solo mensaje.
- **AC3** `POST /api/bot/messages` responde `messageId` (la primera parte) y
  `messageIds` (todas); el contrato `docs/openapi.json` lo declara.
- **AC4** En el Laboratorio se guardan las mismas partes, sin envío.
- **AC5** Si una parte falla, las que faltan no se mandan y se responde el
  error de esa parte; el log no lleva el texto del cliente.
- **AC6** Los e2e de la w031 (D1/D3, D2, D8 en Instagram y Messenger) pasan
  contra la app real con el cerebro falso.
- **AC7** En staging, Nea contesta por WhatsApp, mueve de etapa, pasa a
  humano y una respuesta larga llega completa.
- **AC8** En producción, `/api/health` sano, «Quién responde» con Nea y un
  mensaje real por canal contestado.

## Volver atrás (producción)

1. Quitar `BRAIN_DISPATCH_URL` del CRM: la 1.6 también despacha si la ve, y
   Nea 2.0 no funciona contra la 1.6.
2. Imagen `1.6.0-wline.1` y redesplegar.
3. Restaurar el respaldo de la base.
