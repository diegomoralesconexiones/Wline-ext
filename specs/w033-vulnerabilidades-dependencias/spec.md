# Spec w033 — Dependencias sin vulnerabilidades altas

**Rama**: `chore/vulnerabilidades-dependencias` (parte de `chore/actualizar-2.5.1`) | **Fecha**: 2026-10-26 | **Estado**: en PR

## Contexto

La fila «Dependencias» de [CONSTRAINTS.md](../../CONSTRAINTS.md) pide nada de
severidad alta o mayor (CVSS 7.0 o más) según
`node scripts/check-security.mjs dependencias` (osv-scanner v2.0.0 sobre
`pnpm-lock.yaml`). Hoy avisa; bloquea la CI desde el 2026-11-04.

Con la 2.5.1 de Kevin ([w032](../w032-actualizar-2.5.1/spec.md)) el escaneo
daba 32 grupos altos sobre 653 paquetes. Kevin no tiene nada después de la
2.5.1, así que esperar su siguiente versión no llega a tiempo.

## Clasificación

«Producción» es lo que corre en la imagen: la traza de Next (`*.nft.json`) más
lo que Next y los bundles de `migrate`/`seed` empaquetan.

| Paquete@versión | Grupos | CVSS máx | Tipo | Dónde corre | Arreglo |
|---|---|---|---|---|---|
| next@15.5.27 | 2 | 9.5 (RCE en el optimizador de imágenes con SVG) | directa | producción | 15.5.28, dentro de `^15` |
| sharp@0.34.5 | 3 | 8.9 | transitiva (opcional de next) | producción | 0.35.5; next 15.5.28 ya acepta `^0.35.5` |
| drizzle-orm@0.38.4 | 1 | 7.5 (inyección SQL en identificadores) | directa | producción | 0.45.2. No explotable aquí: ningún identificador ni alias sale de datos de afuera |
| zod@3.25.76 | 1 | 8.2 (memoria con arrays grandes) | directa | producción | solo zod 4.6.6 |
| zod@4.4.3 | 1 | 8.2 | transitiva (better-auth) | producción | 4.6.6, dentro de su `^4.3.6` |
| nanoid@3.3.15 | 2 | 8.2 | transitiva (postcss) | build | 3.3.18 |
| postcss@8.4.31 y 8.5.16 | 3 | 7.5 | transitiva (next fija 8.4.31) y directa de desarrollo | build | 8.5.18 |
| source-map-js@1.2.1 | 1 | 8.7 | transitiva | build y pruebas | 1.2.2 |
| browserslist@4.28.5 | 2 | 7.5 | transitiva (autoprefixer) | build | 4.28.7 |
| brace-expansion@1.1.16 y 5.0.7 | 8 | 7.5 | transitiva (eslint) | lint | 1.1.20 y 5.0.11 |
| js-yaml@4.3.0 | 2 | 7.5 | transitiva (eslint) | lint | 4.3.2 |
| shell-quote@1.9.0 | 1 | 9.2 | transitiva (drizzle-kit 0.30 → gel) | CLI de migraciones | se va con drizzle-kit 0.31 |
| vitest@2.1.9 | 1 | 9.8 | directa de desarrollo | pruebas | 3.2.6 o 4.x |
| vite@5.4.21 | 2 | 8.2 | transitiva (vitest) | pruebas | 6.4.4 o más |
| tinypool@1.1.1 | 2 | 9.5 | transitiva (vitest 2 y 3) | pruebas | se va con vitest 4 |

## Decisión

Decidido el 2026-10-26 por @diegomoralesconexiones, entre tres caminos:
(a) subir versiones en el fork, (b) overrides acotados para las transitivas,
(c) excepciones en CONSTRAINTS.md. Se eligió **(a) + (b) completos, con zod 4**,
sin excepciones y sin tocar CONSTRAINTS.md.

| Cambio | Camino | Quita |
|---|---|---|
| next `^15.5.28` | a | next, y deja entrar sharp 0.35 |
| overrides en `pnpm-workspace.yaml` (postcss, sharp, zod 4 de better-auth, nanoid 3, source-map-js, browserslist, brace-expansion 1 y 5, js-yaml 4) | b | 24 de 32 junto con next |
| vitest `^4.1.12`, @vitest/coverage-v8 `4.1.12`, vite `^7.3.7` explícito | a | vitest, vite, tinypool |
| drizzle-orm `^0.45.4`, drizzle-kit `^0.31.11` | a | drizzle-orm, shell-quote |
| zod `^4.6.6` | a | zod 3 |

Por qué no (c): `check-security.mjs` no lee la tabla de excepciones (habría
que enseñarle), `floor-guard` marca la fila nueva a propósito, y el riesgo de
zod quedaba en producción. Medido antes de decidir, zod 4 pedía 11 errores de
tipos en 5 archivos y nada más.

## Cómo se conserva con cada versión de Kevin

`pnpm-lock.yaml` va a chocar en cada fusión de Kevin mientras su
`package.json` no traiga estas versiones. Se resuelve igual siempre:

1. En el conflicto de `package.json`, quedarse con la versión más alta de
   cada dependencia de esta tabla.
2. Tomar el lockfile de Kevin (`git checkout --theirs pnpm-lock.yaml`) y
   correr `pnpm install`: vuelve a aplicar los rangos y los overrides.
3. `node scripts/check-security.mjs dependencias` debe seguir sin nada alto.
4. Cuando el lockfile de Kevin ya traiga la versión de un override, esa línea
   sobra y se borra.

Un override también reescribe la dependencia directa del mismo nombre (zod,
postcss). Si `package.json` pide otro rango, `pnpm install` en local no se
queja, pero `--frozen-lockfile` en CI y en Docker falla con «specifiers in the
lockfile don't match». Por eso zod va en `^4.6.6`, igual que su override. Para
comprobarlo como en CI: copiar `package.json`, `pnpm-lock.yaml`,
`pnpm-workspace.yaml` y `.npmrc` a una carpeta vacía y correr
`pnpm install --frozen-lockfile --ignore-scripts`.

Si Kevin todavía usa zod 3 en código nuevo, `pnpm typecheck` lo marca
(típicamente `z.record` de un argumento).

## Criterios de aceptación

- **AC1** `node scripts/check-security.mjs dependencias`: nada de severidad
  alta o mayor.
- **AC2** Gate (`typecheck`, `lint`, `build`, `test`) y `pnpm check:task` en
  verde, con floor-guard limpio y la cobertura de líneas por encima del piso.
- **AC3** `pnpm db:generate` no produce migración nueva, y el migrador aplica
  las 26 migraciones en una base vacía y las vuelve a correr sin cambios.
- **AC4** `pnpm doctor` explica en español una variable que falta y una URL
  mal escrita, como antes (`tests/unit/doctor.test.ts` sin cambios).
- **AC5** Los E2E con mocks y el cerebro falso pasan contra la app viva.
