# Implementation Plan: Instagram y Messenger por Zernio en producción (Wline-ext)

**Branch**: `feat/031-instagram-messenger-produccion` | **Date**: 2026-10-21 | **Spec**: [spec.md](spec.md)

**Input**: [specs/w031-instagram-messenger-produccion/spec.md](spec.md), con Q1 y Q2 resueltas.

## Summary

Encender Instagram y Messenger por Zernio en `wline-ext.morales-tec.xyz`, de
modo que un DM real entre a la bandeja, el agente conteste solo y un operador
pueda responder. Hacen falta cuatro cambios pequeños de código:

- **D1**: Instagram usa el transporte compartido de Zernio.
- **D2**: la hora de la conversación nunca retrocede.
- **D3**: el mock de Zernio responde con la forma real.
- **D8**: las respuestas largas del agente se parten.

Después viene el despliegue desde el fork: imagen propia publicada con
`imagen.yml` (D4), Coolify y Zernio configurados (D5), y la prueba en vivo con
las cuentas del dueño (D6). Las decisiones de diseño están en
[research.md](research.md).

## Technical Context

**Language/Version**: TypeScript estricto (`strict` + `noUncheckedIndexedAccess`), Node 22.

**Primary Dependencies**: Next.js 15 (App Router) + React 19, Drizzle ORM, Zod. Sin dependencias nuevas.

**Storage**: PostgreSQL. **Sin migración**: D2 cambia una actualización existente ([data-model.md](data-model.md)).

**Testing**: Vitest (`tests/unit/`) y guiones E2E en Node contra la app viva con mocks (`scripts/e2e-*.mjs`, `pnpm test:e2e`).

**Target Platform**: contenedor Linux amd64 en Coolify (`dockerimage`), imagen en GHCR publicada por GitHub Actions.

**Project Type**: web-service monolito (Next.js con API y UI en el mismo proceso).

**Performance Goals**: no cambian. El webhook sigue respondiendo en menos de 5 s (límite de Zernio). D2 no agrega consultas.

**Constraints**:
- Instagram: 1.000 bytes por mensaje; Messenger: menos de 2.000 caracteres (el código usa 2.000 bytes, que es más estricto).
- Ventana de 24 h, con `HUMAN_AGENT` hasta 7 días solo para personas.
- Como máximo 5 partes por respuesta del agente (R1).

**Scale/Scope**: una instancia, un negocio, dos cuentas sociales nuevas. Unos diez archivos entre código y pruebas, más configuración fuera del repo.

## Constitution Check

*Gate antes de la Fase 0, revisado de nuevo después del diseño.*

| Principio | Antes del diseño | Después del diseño |
|---|---|---|
| I · Seguridad | La llave de Zernio la guarda el dueño, cifrada como hoy; el webhook nace con secreto. | ✅ La imagen pública no lleva secretos (R8). El `warn` del tope de partes registra el id de la conversación, no el texto (R1). |
| II · Soberanía | Zernio sigue siendo un conector opcional tras `CHANNELS`. | ✅ Sin dependencias nuevas. |
| III · Multi-tenancy | No se toca `scoped()`. | ✅ D2 actualiza la misma fila por su id; D8 envía por la misma conversación. |
| IV · Idempotencia | El dedup no cambia. | ✅ D2 vuelve monotónica la hora de la conversación. |
| V · Hecho | Gate técnico, unitarias y E2E. | ✅ Hay una prueba que falla primero (AC7) y E2E para D2 y D8 (R5, R6). |
| VI · Specs | Carril ligero. | ✅ Sigue en carril ligero: el diseño no agregó migración ni contrato público. |
| VII · Trazabilidad | Q1 y Q2 resueltas y escritas. | ✅ Los riesgos abiertos (R7) están en este plan. |
| VIII · Foco | Atender conversaciones de un negocio por más canales. | ✅ |
| IX · En vivo | Local primero, después producción. | ✅ [quickstart.md](quickstart.md) dice quién hace cada paso; lo único delegado es mandar los DMs. |
| Sandbox | `is_test` nunca toca la API. | ✅ D8 parte antes de separar el Laboratorio y guarda las partes sin enviar (AC20). |

**Resultado**: sin violaciones. No hace falta *Complexity Tracking*.

## Project Structure

### Documentation (this feature)

```text
specs/w031-instagram-messenger-produccion/
├── spec.md                         # Comportamiento y criterios de aceptación
├── plan.md                         # Este archivo
├── research.md                     # Fase 0: R1–R9
├── data-model.md                   # Fase 1: reglas nuevas, sin migración
├── quickstart.md                   # Fase 1: verificación local y salida a producción
├── contracts/
│   └── zernio-enviar-mensaje.md    # Contrato consumido y el del mock
└── tasks.md                        # Fase 2 (speckit-tasks), aún no creado
```

### Source Code (repository root)

```text
src/
├── server/
│   ├── instagram/send.ts          # D1: Zernio vía sendZernioMessage; Meta directo sin cambios
│   ├── inbox/ingest.ts            # D2: greatest(...) en lastInboundAt y lastMessageAt
│   ├── channels/capabilities.ts   # D8: splitToFit y replyParts (puros)
│   ├── ai/pipeline.ts             # D8: deliverReply envía por partes
│   ├── zernio/index.ts            # R4: corregir el comentario de «hasta 24 h»
│   └── dev/ai-mock.ts             # D8: disparador «respuesta larga» (solo desarrollo)
└── app/api/dev/zernio-mock/[...path]/route.ts   # D3: forma real de la respuesta

tests/unit/                        # D1 (envío Instagram por Zernio), D8 (splitToFit, idempotencia de plainSocialText)

scripts/
├── e2e-ventana-social.mjs         # D2 (eventos fuera de orden) y D8 (respuesta larga en partes)
└── e2e-canales.mjs                # D1 + D3: el id guardado es el del mock (AC7, prueba que falla primero)
```

**Structure Decision**: se mantiene la estructura del monolito. Cada cambio va
en el módulo que ya es dueño de esa responsabilidad, sin módulos nuevos: el
transporte en `server/instagram`, la ingesta en `server/inbox`, las reglas por
canal en `server/channels` y el turno del agente en `server/ai`.

## Orden de implementación

Primero la prueba que falla y después el arreglo (`test-driven-development`).
Cada fase termina con un punto de control antes de seguir.

### Fase A — Código (rama `feat/031-…`)

1. **D3 + AC7, la prueba primero.**
   - El mock pasa a responder la forma real.
   - En `e2e-canales` se agrega la afirmación «el id guardado de Instagram es el
     `messageId` del mock».
   - *Control*: la afirmación **falla** con el código de hoy, y los guiones de
     Messenger y TikTok siguen en verde, porque ya leen `data.messageId`.
2. **D1.**
   - `sendInstagramText` delega en `sendZernioMessage`.
   - Unitarias del envío: `accountId`, etiqueta fuera de ventana, error sin
     hilo, 401 → `reconnect_required`.
   - *Control*: AC7 pasa y las unitarias quedan en verde.
3. **D2.**
   - En `e2e-ventana-social`, un evento con `sentAt` viejo después de uno
     nuevo.
   - *Control*: falla con el código de hoy; después se aplica `greatest` y pasa
     (AC4, AC5).
4. **D8.**
   - Unitarias de `splitToFit`: límites, cascada, emojis, sin partes vacías,
     tope de 5. Unitaria de la idempotencia de `plainSocialText`.
   - Se implementan el divisor y su uso en `deliverReply`.
   - Disparador en el ai-mock y E2E del DM «respuesta larga».
   - *Control*: AC17–AC21 en verde.
5. **Cierre de la fase.**
   - Comentario de R4 corregido.
   - Gate técnico completo y todos los guiones E2E (AC8, AC15, AC16).
   - *Control*: todo en verde, y `graphify update .` para refrescar el grafo.

### Fase B — Publicación (fork)

6. PR a `main` del fork con CI e imagen en verde. **Lo aprueba el dueño.**
7. Tag `v1.6.0-wline.1` sobre `main` (**se pregunta antes**). *Control*: el
   workflow publica. Si falla por el nombre en mayúsculas, ver R7.
8. El dueño hace público el paquete (R8).

### Fase C — Encendido y prueba en vivo (Wline-ext)

9. Coolify: imagen y etiqueta nuevas, y `CHANNELS`. Redesplegar (**se pregunta
   antes**). *Control*: AC9.
10. El dueño prueba la IA y guarda la llave de Zernio. *Control*: AC10.
11. Evento de prueba de Zernio (**se pregunta antes**). *Control*: AC11.
12. DMs reales del dueño. *Control*: AC12, AC13, AC14, y AC17/AC18 en vivo.
13. Se llena «Prueba en vivo» en la spec.

**En paralelo**: los pasos 1–4 tocan archivos distintos, pero cada uno se
apoya en el control del anterior (el mock de D3 lo usan D1 y D8), así que se
hacen en orden. La Fase B empieza solo con la Fase A en verde.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| El nombre de la imagen tiene mayúscula (`Wline-ext`) | `metadata-action` normaliza; si no, se fija en minúsculas en `imagen.yml`, preguntando antes (R7). |
| El paquete nace privado y Coolify no puede descargarlo | El dueño lo hace público (R8). Se comprueba antes de tocar Coolify. |
| La cuenta de Instagram no es profesional o la llave no tiene acceso a la bandeja | Al guardar, Ajustes → Canales lo dice (AC10). Se corrige en Zernio antes de seguir. |
| Wline-ext tiene un cerebro externo configurado y el agente no contesta | Paso 10: «Probar conexión» y `/api/agent/brain-status` antes de los DMs. |
| `plainSocialText` no es idempotente | La prueba unitaria lo detecta; si falla, `deliverReply` pasa el texto ya limpio (R1). |
| Algo falla en producción | Revertir sin migración (R9, [quickstart.md](quickstart.md#revertir)). |

## Complexity Tracking

Sin violaciones de la constitución: no aplica.
