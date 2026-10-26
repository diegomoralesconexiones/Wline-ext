# Tareas w032 — Wline-ext a Vocero 2.5.1 con Nea propio

Spec: [spec.md](spec.md). **Preguntar antes** marca lo que toca algo fuera de
este repositorio o no se deshace solo.

## Fase 1 — CRM a 2.5.1 (rama `chore/actualizar-2.5.1`)

- [x] T001 Remoto `upstream` a `kevinrivm/vocero-crm` con push bloqueado; ensayo de fusión con 2.0.0 y 2.5.1 (4 conflictos en ambos).
- [x] T002 Fusionar `v2.5.1` y resolver: `pipeline.ts` y `handoff-ack.test.ts` se borran (036); `ai-mock.ts` queda como el de Kevin; `e2e-ventana-social.mjs` junta la prueba de D2 con la del cerebro.
- [x] T003 D8 en `src/app/api/bot/messages/route.ts` con `replyParts`; `messageIds` en la respuesta y en `docs/openapi.json` (AC2–AC5).
- [x] T004 `tests/unit/bot-messages-partes.test.ts`: en rojo con la ruta de Kevin, en verde con D8.
- [x] T005 Cerebro falso con `RESPUESTA_LARGA`; `e2e-ventana-social` (AC17) y `e2e-messenger` (AC18) contra él.
- [x] T006 Renombrar la spec 031 del fork a `w031-instagram-messenger-produccion`.
- [x] T007 Gate: `pnpm typecheck && pnpm lint && pnpm build && pnpm test` y `pnpm check:task` (AC1). 125 archivos y 1.417 unitarias en verde; cobertura 31,04% (piso 27,93%), líneas nuevas del fork 88,9%.
- [x] T008 E2E con mocks y el cerebro falso, app 2.5.1 en local (AC6): `e2e-ventana-social` 72/72, `e2e-messenger` 48/48, `e2e-canales` 86/86, `e2e-despacho` 134/134, `e2e-tiktok` 52/52 y `e2e-selftest` 280/280.
- [x] T008b Regla «Versiones de Kevin» en CONSTRAINTS.md (decisión del **Dueño**): con una versión de Kevin en la rama, el piso juzga contra ella. `floor-guard` contra `main` daba 101 violaciones, todas de Kevin.
- [ ] T009 **Preguntar antes**. Push de la rama y PR a `main` del fork, con CI en verde. El merge lo aprueba el **Dueño**.
- [ ] T010 **Preguntar antes**. Etiqueta `v2.5.1-wline.1`; verificar que *Imagen* publica `ghcr.io/diegomoralesconexiones/wline-ext:2.5.1-wline.1`.

## Fase 2 — Nea propio (`nea-wline-ext`)

- [x] T011 Repo público con Nea 2.0.2 (`main` = `v2.0.2`), remoto `upstream` con push bloqueado, clonado en `C:\Users\diego\GitHub\nea-wline-ext`.
- [ ] T012 Confirmar que su CI corre en el repo nuevo (al subir `main` no aparecía ninguna corrida).
- [ ] T013 **Preguntar antes**. Etiqueta `v2.0.2-wline-ext.1`; verificar la imagen `ghcr.io/diegomoralesconexiones/nea-wline-ext:2.0.2-wline-ext.1` y que se baja sin credenciales.

## Fase 3 — Staging en Coolify

- [ ] T014 **Dueño**: dominio de staging y su DNS.
- [ ] T015 **Preguntar antes**. Entorno «staging» en el proyecto wline-ext: Postgres vacía (nunca una copia de producción), CRM `2.5.1-wline.1`, Nea con `DATABASE_SCHEMA=nea`, `CRM_BASE_URL` interna, sin `LLM_API_KEY`.
- [ ] T016 Variables del CRM: `BOT_API_KEY`, `BRAIN_DISPATCH_URL=http://<nea>:8000/vocero/dispatch`, `BRAIN_HEALTH_URL`. Los secretos los pega el **Dueño**.
- [ ] T017 **Dueño**: número de prueba de Meta en Configuración → WhatsApp y llave de IA.
- [ ] T018 Encender el agente y la herramienta «etapa»; probar contestar, mover de etapa, pasar a humano, respuesta larga y una corrida del Laboratorio (AC7).

## Fase 4 — Producción

- [ ] T019 **Preguntar antes**. Respaldo de `wline-ext-db`.
- [ ] T020 **Preguntar antes**. Nea en el proyecto wline-ext, sin dominio público, misma base, esquema `nea`.
- [ ] T021 Variables del CRM (`BOT_API_KEY`, `BRAIN_DISPATCH_URL`, `BRAIN_HEALTH_URL`); imagen `2.5.1-wline.1` y **redespliegue** (un reinicio no carga variables). Las migraciones 0021–0025 corren solas.
- [ ] T022 Encender el agente y la herramienta «etapa»; verificar `/api/health`, «Quién responde» y un mensaje real por canal (AC8).

## Después

- [ ] T023 Proponer D1, D2 y D3 a `kevinrivm/vocero-crm` como PR.
- [ ] T024 Afinar el estilo de Nea en `nea-wline-ext` con conversaciones reales.
