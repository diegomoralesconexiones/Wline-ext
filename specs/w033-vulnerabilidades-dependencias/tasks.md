# Tareas w033 — Dependencias sin vulnerabilidades altas

Spec: [spec.md](spec.md). **Preguntar antes** marca lo que toca algo fuera de
este repositorio o no se deshace solo.

- [x] T001 Escanear `pnpm-lock.yaml` de la 2.5.1 y clasificar los 32 grupos: directa o transitiva, dónde corre, arreglo y si es compatible.
- [x] T002 Medir cada camino en experimentos que se revirtieron: next más overrides dejaba 7; más vitest 4, 2; más drizzle 0.45, 1; zod 4 pedía 11 errores de tipos en 5 archivos.
- [x] T003 **Preguntar antes**. Camino elegido por el **Dueño**: (a) + (b) completos, con zod 4, sin excepciones.
- [x] T004 next `^15.5.28` y los overrides de `pnpm-workspace.yaml`.
- [x] T005 vitest 4.1.12 con vite 7 explícito (sin él pnpm dejaba vite 5 como peer).
- [x] T006 drizzle-orm 0.45 y drizzle-kit 0.31: `db:generate` sin cambios; el migrador aplica las 26 migraciones en una base vacía y las vuelve a correr (AC3).
- [x] T007 zod 4: `z.record` con llave explícita en 4 rutas; `doctor` traduce `invalid_format` y decide «falta» con el valor, con sus pruebas intactas (AC4).
- [x] T008 Gate y `pnpm check:task` (AC2): 125 archivos y 1.417 unitarias en verde, floor-guard limpio contra v2.5.1, cobertura de líneas 32,24% (piso 27,93%), líneas nuevas del fork 91,4%.
- [x] T009 `node scripts/check-security.mjs dependencias` (AC1): nada de severidad alta o mayor.
- [x] T010 E2E con mocks y el cerebro falso, app en local con base nueva (AC5): `e2e-selftest` 280/280, `e2e-ficha-lead` 13/13, `e2e-canales` 86/86, `e2e-despacho` 134/134, `e2e-messenger` 48/48, `e2e-ventana-social` 72/72, `e2e-resultados` 71/71 y `e2e-calendario` 54/54.
- [ ] T011 **Preguntar antes**. Push de la rama y PR a `main` del fork. Va después del PR de la 2.5.1 (#3); el merge lo aprueba el **Dueño**.
