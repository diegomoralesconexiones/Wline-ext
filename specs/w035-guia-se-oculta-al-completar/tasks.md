# Tareas w035 — La «Guía de inicio» sale del menú al completarse

Spec: [spec.md](spec.md). **Preguntar antes** marca lo que toca algo fuera de
este repositorio o no se deshace solo.

- [x] T001 **Preguntar antes**. El **Dueño** eligió para Ctrl+K la opción (b): también se oculta.
- [x] T002 Rojo → verde en `tests/unit/nav.test.ts`: falló por la razón esperada y pasó tras `canConfigure(role) && guidePending` en `src/lib/nav.ts` (el valor por defecto es `true`).
- [x] T003 El valor baja del servidor: `layout.tsx` (`await guideFirst(session)`) → `app-shell.tsx` → `app-nav.tsx` (lateral y riel) y `atajos-globales.tsx` (Ctrl+K).
- [x] **Checkpoint**:
  - Unitarias: 125 archivos y 1.418 pruebas en verde.
  - `typecheck` y `lint` sin errores en el código del repositorio. En esta máquina fallan solo por `scratch/031/` y `.claude/worktrees/`, ignorados por git y ajenos al cambio.
  - `build` en verde en un worktree limpio, con el diff aplicado.
- [x] T004 E2E en `scripts/e2e-selftest.mjs` (`guiaChecks`):
  - La afirmación vieja de L1732 se queda: floor-guard no deja quitarla.
  - Se agregan cuatro más que miran `href="/onboarding"` en el HTML de `/inbox`. Dos piden que esté: mientras falte algo, y completa con cerebro pero el agente apagado (AC3). Dos piden que no esté: bandeja manual (AC2) y encendida (AC1).
  - El guion `tests/e2e/us-guia-de-inicio.md` gana los pasos 9 a 11 y el 14.
- [x] T005 `pnpm check:task` en un worktree limpio, más `e2e-selftest` con mocks y el cerebro falso contra la base local reusada (AC4, AC5).
  - `check:task` en verde: floor-guard limpio, 1.418 unitarias, cobertura de líneas 32,23% (piso 27,93%) y build.
  - Líneas nuevas cubiertas por unitarias: 1 de 7, solo se informa. Las otras 6 son props de componentes y las cubre el E2E.
  - Guía de inicio: todo en verde, incluidas las 4 de w035. 273/284 en total.
  - Verificación independiente desde la UI (sesión aparte, sin AGENDA, 4 pasos): los 9 casos pasan. Incluyen encender desde la guía, que la oculta sin recargar; que vuelva al recargar tras romper WhatsApp; el teléfono, y el rol miembro. `check:task` en verde y la sección de la guía del E2E 36/36.
  - Los 11 fallos restantes (`window_closed` en envíos a BSUID, Argentina, imagen y ubicación, y un handoff) salen igual contra `main` con la misma base: vienen de reusar la base, no del cambio.
  - Contra `main`, las 2 de w035 que piden que la guía no esté fallan, como debe ser.
  - En el navegador, con la guía completa, ni el lateral ni el riel muestran la entrada, y Ctrl+K con «gu» responde «Nada coincide».
- [ ] T006 **Preguntar antes**. Commit en rama, PR a `main` del fork y deploy a `wline-ext.morales-tec.xyz`. Al final se ve en vivo que la entrada ya no está.
  - El **Dueño** aprobó el commit y el PR (2026-10-27).
  - El merge y el deploy siguen pendientes de su visto bueno.
