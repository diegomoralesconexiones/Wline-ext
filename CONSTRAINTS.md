# Constraints

Last reviewed: 2026-10-26 por @diegomoralesconexiones (acordado con
`constraint-driven-development`).

El piso de calidad de este repositorio, con números y con el comando que da
cada veredicto. **Complementa** la Definición de Hecho de la constitución
(Principios V y IX) y no la reemplaza: el gate técnico y el E2E de
comportamiento siguen mandando.

Una fila con número y sin comando es una aspiración, no una restricción.

## Piso (bloquea siempre)

Lo revisa `node scripts/floor-guard.mjs` sobre el diff contra `origin/main`.

- Sin supresiones nuevas: `@ts-ignore`, `@ts-nocheck`, `@ts-expect-error`, `eslint-disable`, `istanbul ignore`, `c8 ignore`, `v8 ignore`, `nosemgrep`, `gitleaks:allow`.
- Sin trabajo sin terminar: «not implemented», un `catch {}` vacío que no dice por qué, o un `TODO` sin responsable (se escribe `TODO(nombre)`, Principio VII).
- Sin pruebas más fáciles: ni `.skip`, `.only` o `.todo`, ni borrar un archivo de prueba, ni quitar un `expect`, `assert` u `ok(` de una unitaria o un guion E2E que sigue existiendo.
- Sin secretos en el código: Principio I.
- Este archivo no se afloja para que un cambio pase: subir un umbral es silencioso, bajarlo o quitarlo es una violación.
- Bloqueo de las dimensiones nuevas: **bloquean desde:** 2026-11-04

La fecha da dos semanas de aviso para ajustar falsos positivos sin parar el
trabajo. Mover la fecha más tarde también lo detecta la guardia.

### Versiones de Kevin

Decidido el 2026-10-26 por @diegomoralesconexiones, al traer la 2.5.1.

Si la rama trae una versión de Kevin que `main` no tiene, el piso juzga contra
esa versión y no contra `main`. Es la misma idea que la fila de secretos: el
código de Kevin no es de este cambio, y medirlo como propio da violaciones que
el fork no puede arreglar sin divergir. Así, en una actualización, cuenta solo
lo propio del fork, incluidas la resolución de conflictos y cualquier cambio
que se haga encima.

- Una versión de Kevin es una etiqueta `vX.Y.Z` de
  `https://github.com/kevinrivm/vocero-crm`, leída de ahí con `git ls-remote`,
  con el mismo commit. Una etiqueta local o puesta a mano no cuenta.
- Si la rama trae varias, manda la más nueva.
- Si el repositorio de Kevin no contesta, se juzga contra `main`, que es lo
  más estricto.
- Lo aplican `floor-guard`, `coverage-check` (líneas nuevas) y
  `check-security` (rango de secretos), con `scripts/lib/base-del-piso.mjs`.
  Cada uno imprime contra qué base juzgó.

## Con número (se hace cumplir)

| Dimensión | Regla | Lo verifica | Corre en | Si falla |
|-----------|-------|-------------|----------|----------|
| Tipos | Cero errores | `pnpm typecheck` | cada tarea, CI (`ci.yml`) | bloquea |
| Lint | Cero errores con nuestra config | `pnpm lint` | cada tarea, CI (`ci.yml`) | bloquea |
| Piso | Cero violaciones en el diff | `node scripts/floor-guard.mjs` | cada tarea, CI (`restricciones.yml`) | bloquea |
| Unitarias | Todas en verde | `vitest run --coverage` | cada tarea, CI (`ci.yml`, `restricciones.yml`) | bloquea |
| Build | Compila | `pnpm build` | cada tarea, CI (`ci.yml`) | bloquea |
| Comportamiento | Los E2E de la historia en verde, camino infeliz incluido | `pnpm test:e2e` y los guiones `scripts/e2e-*.mjs` de la historia, con la app viva y los mocks | al cerrar cada historia, antes del PR | bloquea |
| Cobertura total | No puede bajar del valor registrado abajo, con 0.5 pp de tolerancia | `node scripts/coverage-check.mjs` | cada tarea, CI (`restricciones.yml`) | avisa; bloquea desde la fecha del piso |
| Secretos | Ningún secreto en los commits de la rama | `node scripts/check-security.mjs secretos` (gitleaks v8.30.1, `--redact`) | CI (`restricciones.yml`); en local, con Docker | avisa; bloquea desde la fecha del piso |
| Dependencias | Nada de severidad alta o mayor (CVSS 7.0 o más) | `node scripts/check-security.mjs dependencias` (osv-scanner v2.0.0 sobre `pnpm-lock.yaml`) | CI (`restricciones.yml`); en local, con Docker | avisa; bloquea desde la fecha del piso |

Por qué cada número:

- **Tolerancia de 0.5 pp en la cobertura.** Absorbe la deriva cuando un archivo
  ajeno al cambio mueve el total. Más que eso ya es una caída real.
- **CVSS 7.0.** Es el corte de severidad «alta». Por debajo hay sobre todo
  ruido que no tiene arreglo en el día.
- **Secretos solo en los commits de la rama.** El historial heredado de Kevin
  no es de este cambio y no se puede reescribir.
- **Chequeos externos.** gitleaks y osv-scanner juzgan con reglas y una base de
  vulnerabilidades de afuera; el resto lo juzgan las pruebas del propio
  proyecto.
- **Comportamiento.** No tiene un número aparte: es la regla de la
  constitución (V y IX), escrita aquí para que quede junto al resto.

## Medido, aún sin hacer cumplir

| Métrica | Hoy | Dirección |
|---------|-----|-----------|
| Cobertura total de líneas (unitarias) | al menos 27.93% | no puede bajar más de 0.5 pp |
| Cobertura de las líneas nuevas | se informa en cada corrida de `coverage-check` | sin umbral (decisión del dueño, 2026-10-21) |
| `eslint-disable` existentes en `src/` | como máximo 6, todos `no-img-element` y justificados | no puede subir |
| `catch {}` vacíos existentes en `scripts/` | como máximo 22, limpieza de guiones E2E | no puede subir |

Medido el 2026-10-21 en la rama `feat/031-instagram-messenger-produccion`:
101 archivos y 1.145 unitarias en verde. La cobertura cuenta solo las unitarias;
los E2E no suman. Cuando el número mejore, se sube aquí en un commit aparte.

## Rutas fuera de la guardia

`floor-guard` no mira lo que dice `.constraintsignore`:

| Ruta | Motivo |
|------|--------|
| `.claude/skills/**` | Skills de terceros copiadas al repo; no son código del proyecto. |
| `scripts/floor-guard.mjs` | Contiene los mismos patrones que busca. |

Agregar una ruta ahí es aflojar el piso: se decide aquí, con motivo, nunca en
el mismo commit que el cambio que fallaba.

## Excepciones

| ID | Regla | Ruta | Motivo | Responsable | Vence |
|----|-------|------|--------|-------------|-------|

Ninguna. Una excepción nueva lleva responsable y vence en 90 días como máximo.

## Dónde corre cada cosa

| Momento | Comando | Qué corre |
|---------|---------|-----------|
| Al terminar cada tarea | `pnpm check:task` | typecheck, lint, piso, unitarias con cobertura, trinquete y build (sin límite de tiempo, decisión del dueño) |
| Al cerrar cada historia y antes del PR | `pnpm test:e2e` y los guiones de la historia | comportamiento, con la app viva y los mocks |
| Completo en local | `pnpm check:full` | `check:task` + secretos + dependencias (requiere Docker Desktop encendido) |
| CI, en cada PR y en `main` | `ci.yml` (de Kevin) y `restricciones.yml` (del fork) | todo lo anterior salvo los E2E |

`restricciones.yml` vive aparte de `ci.yml` para que *Sync fork* con el repo
de Kevin no choque. Los scripts de `package.json` son atajos que deben
coincidir con esta tabla: si se desalinean, manda este archivo.
