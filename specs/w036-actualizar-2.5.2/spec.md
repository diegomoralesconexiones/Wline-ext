# Spec w036 — Wline-ext a Vocero 2.5.2 (la Bandeja rápida)

**Rama**: `chore/actualizar-2.5.2` | **Fecha**: 2026-10-28 | **Estado**: En producción con `2.5.2-wline.1` ([PR #7](https://github.com/diegomoralesconexiones/Wline-ext/pull/7)); falta la prueba con un mensaje real (T016)

Plan maestro de la fusión de `kevinrivm/vocero-crm` (upstream) en
`diegomoralesconexiones/Wline-ext` (origin). Todo lo de abajo se midió con
`git` contra los dos remotos y con el MCP de GitHub el 2026-10-28, sin tocar
`main` ni la checkout del Dueño. Precedente: [w032](../w032-actualizar-2.5.1/spec.md).

## Radiografía

| | upstream (Kevin) | origin (fork) |
|---|---|---|
| Punta | `1fcfa16` = `v2.5.2` (2026-10-27) | `0688c5b` = PR #6, imagen `2.5.1-wline.2` en producción |
| Encima de la base | 2 commits: `a1b8ad8` perf(064) y `52da8cc` release 2.5.2 | 20 commits propios (w031, w032, w033, w035, piso) |
| Archivos tocados | 19 (+595 / −34) | 58 |
| Ramas sin fusionar | ninguna | ninguna; sin PRs abiertos |
| Etiquetas | `v2.5.2` nueva; vive **solo en local**, origin no la tiene | `v2.5.1-wline.1`, `v2.5.1-wline.2` (y `v1.6.0-wline.1`, `respaldo-pre-031`) |

**Base común**: `2f983c9`, el merge de la `v2.5.1` (2026-10-25). Lo que el fork
trae de Kevin es exactamente la 2.5.1; no hay commits de Kevin a medias.

**Qué es la 2.5.2** (CHANGELOG y release de Kevin): solo la 064. Sin
migraciones, sin variables nuevas, Nea no cambia.

- La vista previa del último mensaje filtra por `organization_id` y usa
  `message_org_conv_idx` (de ~750 ms a ~2 ms con 40 000 mensajes).
- Una ráfaga de eventos recarga la lista una vez (`unaALaVez`, 300 ms); la
  Bandeja publica su lista y el contador del menú y Ctrl+K la reusan
  (`src/lib/lista-compartida.ts`).
- Las dos consultas de mensajes del Laboratorio pasan por `scoped()`.

## Clasificación de archivos

### Seguros — solo Kevin (16): entran tal cual

| Área | Archivos |
|---|---|
| Bandeja (064) | `src/lib/lista-compartida.ts` (nuevo) · `src/components/inbox/inbox-client.tsx` · `src/server/inbox/queries.ts` |
| Laboratorio | `src/server/lab/runner.ts` |
| Pruebas | `tests/unit/lista-compartida-064.test.ts` · `scripts/e2e-lista-compartida.mjs` · `tests/e2e/us-lista-compartida.md` (nuevos) |
| Release | `CHANGELOG.md` · `README.md` · `INSTALL-IA.md` · `docker-compose.yml` · `fly.toml` · `railway.toml` · `render.yaml` |
| Specs | `specs/064-lista-conversaciones-rapida/spec.md` · `specs/README.md` |

El fork no toca ningún archivo de `src/server/inbox/` que toque Kevin: su D2
vive en `ingest.ts`, la 064 en `queries.ts`.

### Coinciden — los dos lados (3): se funden solos

| Archivo | Kevin | Fork | Por qué no chocan |
|---|---|---|---|
| `package.json` | `version` 2.5.2 y script `test:e2e:lista` | scripts `check:*` y dependencias de la w033 (next 15.5.28, zod 4, drizzle 0.45, vitest 4) | Hunks separados. Kevin no cambia dependencias, así que `pnpm-lock.yaml` (solo del fork) sigue valiendo. |
| `src/components/app-nav.tsx` | contador desde la lista compartida (líneas 1–20, 99–175) | prop `guidePending` de la w035 (66–92, 168) | Regiones distintas y lógicas independientes. |
| `src/components/atajos-globales.tsx` | `listaVigente()` en el `useEffect` de la barra | prop `guidePending` hasta `appNavGroups` | Ídem. |

### Exclusivos del fork: se conservan intactos

| Corrección | Archivos |
|---|---|
| D1/D3 Instagram guarda el id real | `src/server/instagram/send.ts` · `src/server/zernio/index.ts` · `src/app/api/dev/zernio-mock/…` · `tests/unit/instagram-send.test.ts` · `scripts/e2e-canales.mjs` |
| D2 La hora no retrocede | `src/server/inbox/ingest.ts` · `scripts/e2e-ventana-social.mjs` |
| D8 Respuestas largas en partes | `src/app/api/bot/messages/route.ts` · `src/server/channels/capabilities.ts` · `docs/openapi.json` · `scripts/lib/cerebro-falso.mjs` · `scripts/e2e-messenger.mjs` · `tests/unit/{bot-messages-partes,split-to-fit,social-text}.test.ts` |
| w033 Dependencias (zod 4) | `package.json` · `pnpm-lock.yaml` · `pnpm-workspace.yaml` · `z.record(z.string(), …)` en `bot/ficha`, `contacts/[id]`, `dev/wa-mock/*`, `doctor/checks.ts` |
| w035 Guía de inicio sale del menú | `src/lib/nav.ts` · `src/components/app-shell.tsx` · `src/app/(app)/layout.tsx` · `tests/unit/nav.test.ts` · `scripts/e2e-selftest.mjs` |
| Piso de calidad | `CONSTRAINTS.md` · `scripts/{floor-guard,coverage-check,check-security}.mjs` · `scripts/lib/base-del-piso.mjs` · `vitest.config.ts` · `.constraintsignore` |

## Ensayo de fusión

- `git merge-tree --write-tree origin/main v2.5.2` → un solo árbol
  (`b9edd21`), **0 conflictos**; git funde solo los 3 archivos que coinciden.
- Fusión real en un worktree desechable del scratchpad (`--detach`, sin rama,
  borrado después): `pnpm install --frozen-lockfile` sin cambios en el lockfile
  y `pnpm check:task` en verde. Typecheck y lint limpios; `floor-guard: base
  1fcfa16 (la rama trae v2.5.2 de Kevin…) · limpio`; 126 archivos y 1.425
  unitarias (antes 125 y 1.417; la diferencia es la de la 064); cobertura
  32,43 % (piso 27,93 %); build en 44 s.
- En la rama real (merge `3978079`, mismo árbol `b9edd21`) se repitió todo y
  se corrieron los E2E: ver [tasks.md](tasks.md) T010 y T011.

## Riesgos que git no ve

1. **Código de Kevin escrito para dependencias más viejas.** La 064 se escribió
   contra zod 3, vitest 2, drizzle 0.38 y next 15.1; el fork corre zod 4,
   vitest 4, drizzle 0.45 y next 15.5. `lista-compartida.ts` no usa zod; la
   unitaria usa `vi.fn`, `useFakeTimers` y `advanceTimersByTimeAsync` (siguen
   en vitest 4); `runner.ts` usa `scoped()`, que ya existe. Lo prueba el gate
   del ensayo.
2. **La etiqueta `v2.5.2` de Kevin no puede llegar a origin.** `imagen.yml`
   publica con `type=semver` en cualquier `v*`: un `git push --tags` (o
   `--follow-tags`) publicaría `ghcr.io/diegomoralesconexiones/wline-ext:2.5.2`,
   `2.5` y `latest` con el código de Kevin **sin D1, D2 ni D8**. Solo se sube la
   etiqueta propia, por nombre. `2.5.2-wline.1` es prerelease en semver: no
   mueve `latest`.
3. **El mock de WhatsApp.** El e2e nuevo de Kevin escribe a
   `/api/dev/wa-mock/inbound`, que el fork cambió (w033). El cambio es solo la
   sintaxis de `z.record` en zod 4; los campos que manda el e2e
   (`phoneNumberId`, `from`, `name`, `text`) no cambian.
4. **El piso juzga contra la 2.5.2.** La regla «Versiones de Kevin»
   (CONSTRAINTS.md) hace que `floor-guard` mida contra la versión de Kevin que
   trae la rama, no contra `main`. Con un *cherry-pick* la rama no trae la
   versión y el código de Kevin contaría como propio.
5. **Choque futuro, no de la 2.5.2.** El PR abierto
   [kevinrivm/vocero-crm#171](https://github.com/kevinrivm/vocero-crm/pull/171)
   (de revudev) sube next, drizzle y zod a las mismas versiones que la w033 y
   toca `package.json`, `pnpm-lock.yaml` y `pnpm-workspace.yaml`. Si Kevin lo
   fusiona, la actualización siguiente choca en el lockfile: se resuelve con el
   protocolo de abajo, nunca a mano.

## Decisiones

| Tema | Decisión |
|---|---|
| Estrategia | `git merge --no-ff v2.5.2` en una rama, como en la w032. |
| Rebase del fork sobre Kevin | **No.** Reescribe 20 commits ya publicados en `main` y deja huérfanas las etiquetas `v2.5.1-wline.*` de producción; exige `push --force` a `main`. |
| *Cherry-pick* de `a1b8ad8` | **No.** Funde igual de limpio, pero la base común se queda en 2.5.1: la próxima versión de Kevin vuelve a traer la 064 como si fuera nueva, se pierde el release (versión, CHANGELOG) y el piso mide el código de Kevin como propio (riesgo 4). |
| Dónde se trabaja | Worktree limpio, no la checkout del Dueño: allí `scratch/` y `.claude/worktrees/` rompen `tsc`, y `specs/w032` tiene cambios sin commit que no son de esta tarea. |
| Etiqueta e imagen | `v2.5.2-wline.1` → `ghcr.io/diegomoralesconexiones/wline-ext:2.5.2-wline.1`. |
| Despliegue | Redesplegar con esa imagen; sin migraciones ni variables. Nea no se toca. |

## Protocolo de resolución (si al ejecutar aparece un conflicto)

Si Kevin publica algo más antes de ejecutar, el paso 2 de
[tasks.md](tasks.md) lo detecta. Reglas:

- `package.json`: `version` la de Kevin; scripts, la unión; cada dependencia,
  la versión **mayor** de los dos lados.
- `pnpm-lock.yaml`: nunca a mano. Tomar el del fork
  (`git checkout --ours pnpm-lock.yaml`) y regenerarlo con `pnpm install`.
- `app-nav.tsx`, `atajos-globales.tsx`, `nav.ts`: quedan las dos cosas, la prop
  `guidePending` (w035) y lo que traiga Kevin.
- D1, D2, D8: gana el fork, salvo que Kevin haya corregido lo mismo (la
  propuesta pendiente w032 T023); entonces gana Kevin y se borra lo del fork en
  un commit aparte.
- Código de Kevin con API de zod 3 (`z.record(valor)` de un argumento,
  `.errors`, etc.): se adapta a zod 4 en un commit `fix(deps)` aparte, no dentro
  del merge.
- Archivos que Kevin borre y el fork haya tocado: se borran (como `pipeline.ts`
  en la w032) y lo del fork se re-ubica.

## Criterios de aceptación

- **AC1** La rama funde `v2.5.2` sin marcas de conflicto, y
  `git diff main...HEAD --stat` lista solo los 19 archivos de Kevin.
- **AC2** Gate en verde (`typecheck`, `lint`, `build`, `test`) y `pnpm check:task`.
- **AC3** `pnpm test:e2e:lista` (064) y los e2e del fork (`e2e-ventana-social`,
  `e2e-messenger`, `e2e-canales`, `e2e-despacho`, `e2e-selftest`) pasan contra la
  app real con mocks y el cerebro falso.
- **AC4** Se publica `wline-ext:2.5.2-wline.1`; no existe `wline-ext:2.5.2` y
  `latest` no se movió.
- **AC5** En producción, `/api/health` dice 2.5.2, la Bandeja abre rápido, el
  contador del menú cambia con un mensaje real y Nea sigue contestando.

## Volver atrás (producción)

Imagen `2.5.1-wline.2` y redesplegar. La 2.5.2 no trae migraciones: no hace
falta restaurar la base.
