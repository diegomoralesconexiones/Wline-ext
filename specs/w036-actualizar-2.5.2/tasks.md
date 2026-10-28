# Tareas w036 — Wline-ext a Vocero 2.5.2

Spec: [spec.md](spec.md). **Preguntar antes** marca lo que toca algo fuera de
este repositorio o no se deshace solo.

## Fase 1 — Radiografía (hecha el 2026-10-28, sin tocar código)

- [x] T001 Remotos: `upstream` = `kevinrivm/vocero-crm` con push bloqueado (`DISABLE`); `git fetch upstream --tags --prune` trajo `v2.5.2`, `release/2.5.2` y `perf/lista-conversaciones-rapida`.
- [x] T002 Base común `2f983c9` (`v2.5.1`). Kevin +2 commits, fork +20. Ninguna rama sin fusionar en los dos remotos; sin PRs abiertos en el fork.
- [x] T003 Etiquetas: origin solo tiene las `-wline`; las de Kevin viven solo en local (riesgo 2).
- [x] T004 MCP de GitHub: release `v2.5.2` de Kevin (sin migraciones ni variables) y PRs abiertos de Kevin; #171 choca a futuro con la w033 (riesgo 5).

## Fase 2 — Diff y clasificación (hecha)

- [x] T005 19 archivos de Kevin: 16 seguros, 3 coinciden (`package.json`, `app-nav.tsx`, `atajos-globales.tsx`), hunks separados.
- [x] T006 58 archivos del fork asignados a D1/D3, D2, D8, w033, w035 y el piso; ninguno de la Bandeja que toque la 064.
- [x] T007 `git merge-tree --write-tree origin/main v2.5.2` sin conflictos; fusión en worktree desechable con `check:task` en verde.

## Fase 3 — Ejecución (2026-10-28)

Los comandos van en Git Bash desde `C:\Users\diego\GitHub\Wline-ext`.

- [x] T008 Traer lo último y re-ensayar. Sin novedades en los dos remotos; mismo árbol `b9edd21`. Si imprime algo más que un hash, Kevin publicó otra cosa: volver a la Fase 2 con el protocolo de la spec.

  ```bash
  git fetch origin --prune && git fetch upstream --tags --prune
  git merge-tree --write-tree --name-only origin/main v2.5.2
  ```

- [x] T009 Rama en un worktree limpio (la checkout del Dueño no se toca). Merge `3978079`: 19 archivos, `+595 −34`, árbol idéntico al del ensayo (AC1).

  ```bash
  git worktree add ../Wline-ext-2.5.2 -b chore/actualizar-2.5.2 origin/main
  cd ../Wline-ext-2.5.2
  git merge --no-ff v2.5.2 -m "merge: Vocero 2.5.2 (064, la Bandeja rápida)"
  git diff --stat origin/main...HEAD
  ```

  Esperado: 19 archivos, `+595 −34`, todos de la lista de la spec (AC1).

- [x] T010 Gate y piso (AC2). `check:task` en verde: `floor-guard` limpio juzgando contra `1fcfa16`; 126 archivos y 1.425 unitarias; cobertura 32,43 % (piso 27,93 %); build. `--frozen-lockfile` sin cambios.

  ```bash
  pnpm install --frozen-lockfile && pnpm check:task
  ```

- [x] T011 E2E con mocks y el cerebro falso (AC3). App de la rama con `next dev` en el 3260 (`--env-file=.env` del Dueño + un extra sin secretos), sobre una base **nueva y vacía** con un rol de prueba propio (borrados al terminar):

  | Guion | Resultado |
  |---|---|
  | `e2e-lista-compartida` (064) | 13/13 en base vacía: ráfaga de 10 mensajes = 3 peticiones (antes ~40), Ctrl+K = 0, fuera de la Bandeja = 2 |
  | `e2e-ventana-social` (D2, D8 en Instagram) | 72/72 |
  | `e2e-messenger` (D8 en Messenger) | 48/48 |
  | `e2e-canales` (D1/D3) | 86/86 |
  | `e2e-despacho` | 134/134 |
  | `e2e-tiktok` | 52/52 |
  | `e2e-selftest` | 284/284 (280 de la 2.5.1 + 4 de la Guía, w035) |

  Repetida al final de la tanda, la 064 da 10/13: las 3 de la insignia no pueden medir porque la cuenta ya tiene más de 99 no leídos y la insignia muestra `99+` (el guion hace `Number("99+")`). Las de peticiones vuelven a pasar (2, 0, 2).
- [x] T012 Estado de esta spec al día. `specs/README.md` es de Kevin y no lista las `w`: no se toca.
- [x] T013 **Preguntar antes** (el Dueño aprobó «hasta producción»). [PR #7](https://github.com/diegomoralesconexiones/Wline-ext/pull/7) con los 6 checks en verde, fusionado con merge commit `2a541f5` (no squash: el squash borra la ascendencia de Kevin y la próxima actualización vuelve a traer la 064). El árbol de `main` es idéntico al de la rama probada.

  ```bash
  git push -u origin chore/actualizar-2.5.2
  ```

- [x] T014 **Preguntar antes**. Etiqueta `v2.5.2-wline.1` sobre `2a541f5`, subida **por nombre**; en origin no hay `v2.5.2`. Nunca `git push --tags` ni `--follow-tags` (riesgo 2). Ojo: con el remoto `upstream`, `gh run list` sin `--repo` muestra las corridas de **Kevin**.

  ```bash
  git fetch origin && git tag -a v2.5.2-wline.1 origin/main -m "Wline-ext 2.5.2-wline.1: Vocero 2.5.2 con D1, D2, D8 y w035"
  git push origin v2.5.2-wline.1
  ```

  Verificar en *Imagen* que publica `wline-ext:2.5.2-wline.1` y que no hay `wline-ext:2.5.2` (AC4).

  AC4 en verde: el workflow de la etiqueta terminó bien y el registro tiene `2.5.2-wline.1` (`sha256:7b01632…`); no hay `2.5.2`, `2.5` ni `latest`. `gh api` no lista paquetes sin `read:packages`: se consulta `ghcr.io/v2/…/tags/list` con un token anónimo.

## Fase 4 — Producción (2026-10-28)

- [x] T015 **Preguntar antes**. Coolify: imagen `2.5.2-wline.1` en `Wline-ext` y **redespliegue** (`affjauxurv7bckaaedc19rzn`, 55 s; un reinicio no cambia la imagen). Nea no se toca.
- [ ] T016 `/api/health` en 200 con 2.5.2, «Quién responde» con Nea, la Bandeja abre y su contador cambia con un mensaje real (AC5). Si algo falla: imagen `2.5.1-wline.2` y redesplegar.
  - Hecho sin sesión: `/api/health` 200 con `2.5.2` y commit `2a541f5`; el log dice «migraciones aplicadas» y «despacho al cerebro activo → nea-wline-ext:8000»; `nea-wline` está `running:healthy`; `/login` responde.
  - Falta, con la sesión del Dueño: «Quién responde», la Bandeja y su contador con un mensaje real, y la respuesta de Nea.
- [ ] T017 Borrar el worktree: `Remove-Item -LiteralPath "\\?\C:\Users\diego\GitHub\Wline-ext-2.5.2" -Recurse -Force` y `git worktree prune` (`git worktree remove` falla con «Filename too long»).

## Lecciones

- Una instancia es un negocio: solo el **primer** registro queda dueño. Los guiones del fork entran como `e2e@vocero.test` y el de la 064 como `e2e-lista@vocero.test`; en una base vacía, el que corre primero se queda con la organización y los demás reciben 401. Correr primero los del fork y la 064 con `E2E_EMAIL=e2e@vocero.test E2E_PASSWORD=password-e2e-123`, o la 064 sola en su base.
- En la PC del Dueño, `localhost:5432` resuelve a `[::1]`, que es **otro** Postgres, no el contenedor `vocero-dev-postgres-1`. En las URLs de base, `127.0.0.1`.

## Después

- [ ] T018 Vigilar [kevinrivm/vocero-crm#171](https://github.com/kevinrivm/vocero-crm/pull/171): si Kevin lo fusiona, la próxima actualización choca en `package.json`, `pnpm-lock.yaml` y `pnpm-workspace.yaml` (protocolo de la spec).
- [ ] T019 Sigue pendiente la w032 T023: proponer D1, D2 y D3 a Kevin. Cada corrección que él acepte es un archivo menos que puede chocar.
