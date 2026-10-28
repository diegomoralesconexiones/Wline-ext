# Spec w035 — La «Guía de inicio» sale del menú cuando ya no hay nada que hacer

**Rama**: `fix/guia-se-oculta-al-completar` | **Fecha**: 2026-10-27 | **Estado**: en PR

## Contexto

En `wline-ext.morales-tec.xyz` la guía está 4 de 4, con la etiqueta
«¡Completo!», y dice «Asistente UNO ya está contestando». Aun así
«Guía de inicio» sigue en el menú lateral y en el riel. Se ve igual que cuando
faltaban pasos.

Causa: `appNavGroups` ([src/lib/nav.ts:70](../../src/lib/nav.ts)) pone la entrada
con una sola condición, `canConfigure(role)`. La regla que sí sabe si la guía
tiene algo pendiente ya existe: `guideFirst`
([src/server/onboarding/guide.ts:145](../../src/server/onboarding/guide.ts)).
Hoy solo decide a dónde manda `/`.

Mapa (graphify, profundidad 1):

```
layout.tsx (servidor) ──role, agenda──► AppShell ──► AppNav ──► appNavGroups ──► menú lateral + Riel
                                              └────► AtajosGlobales ──► BarraDeComandos (Ctrl+K) ──► appNavGroups
page.tsx «/» ──► guideFirst ──► guideStatus ──► onboardingStatus (BD + /health del cerebro)
```

`nav.ts` y `guide.ts` no se tocan en el grafo. El puente natural es el layout:
ya baja `agenda` por prop por la misma razón (el nav es de cliente y no
decide solo).

## Regla

La entrada «Guía de inicio» aparece **solo mientras `guideFirst(session)` sea
verdadero**. Es la misma función que decide si `/` lleva a la guía, así que el
menú y la raíz no pueden contradecirse.

| Estado | `/` manda a | ¿Entrada en el menú? |
|---|---|---|
| Miembro del equipo | `/inbox` | No (como hoy) |
| Falta un paso obligatorio | `/onboarding` | Sí |
| Completa, cerebro conectado, agente apagado | `/onboarding` | Sí: falta encender |
| Completa, cerebro conectado, agente encendido | `/inbox` | **No** (el caso de hoy) |
| Completa sin cerebro (bandeja manual) | `/inbox` | No |
| Después se cae WhatsApp o rechazan la llave de IA | `/onboarding` | Vuelve sola |
| El cerebro deja de contestar con el agente encendido | `/inbox` | No: el paso es opcional y el aviso sale por `brain-status` |

`/onboarding` sigue vivo por URL. El E2E ya afirma que con todo encendido «la
guía sigue disponible».

## Decisión

Cinco archivos de código, unas diez líneas:

1. `src/lib/nav.ts`: `appNavGroups` recibe `guidePending?: boolean`, con
   `true` por defecto. La condición pasa a ser `canConfigure(role) && guidePending`.
   Si alguien no pasa el valor, se queda el comportamiento de hoy.
2. `src/app/(app)/layout.tsx`: `guidePending={await guideFirst(session)}` hacia
   `AppShell`. No hace falta `try/catch`. `fetchBrainHealth` no lanza: atrapa y
   devuelve `reachable: false`. Y si la base falla, `getBranding` ya tumbó el
   layout antes.
3. `src/components/app-shell.tsx`: pasa la prop a `AppNav`.
4. `src/components/app-nav.tsx`: `appNavGroups({ agenda, role, guidePending })`
   (L168). El `Riel` recibe los mismos `groups`, así que un cambio cubre los
   dos menús.
5. **Ctrl+K** (`atajos-globales.tsx`): decisión del **Dueño**, opción (b).
   También sale de ahí: la prop baja a `AtajosGlobales` y a
   `BarraDeComandos`. Se descartó la opción (a), que la dejaba en Ctrl+K como
   salida para revisar un paso. Con la guía completa, `/onboarding` solo se
   abre por URL.

No se toca: `guide.ts` (la regla ya existe), la pantalla `/onboarding`,
`/api/onboarding/status` ni `onboarding-client.tsx`.

## Costo y riesgos

- **Latencia del layout.** Para dueño y admin, el layout suma
  `onboardingStatus`: unas 6 consultas a la base y el `/health` del cerebro.
  Ese `/health` tiene caché de 15 s, tiempo límite de 2 s y comparte la
  llamada en vuelo (`BRAIN_HEALTH_TTL_MS`, `BRAIN_HEALTH_TIMEOUT_MS`). El
  layout solo se vuelve a pintar con carga completa o `router.refresh()`, no al
  navegar. `/` ya paga ese costo en cada entrada. Si pesa, se corre en paralelo
  con `avisoIaDe`. Un miembro no paga nada: `guideFirst` corta antes por rol.
- **Cuándo cambia.** Al pulsar «Encender» en la guía se hace `router.refresh()`
  (`onboarding-client.tsx:63`): la entrada desaparece en el acto. Al encender
  desde `/agent` desaparece en la siguiente carga. Si algo se rompe después,
  vuelve en la siguiente carga, no en vivo.
- **Fork de Kevin.** Toca cuatro archivos que vienen de él. El diff chico es a
  propósito: la próxima versión de Kevin entra con poco conflicto.

## Criterios de aceptación

- **AC1** Dueño con la guía completa y el agente encendido: el HTML de `/inbox`
  no trae `href="/onboarding"`, y Ctrl+K no ofrece «Guía de inicio».
- **AC2** Bandeja manual (completa, sin cerebro): igual que AC1.
- **AC3** Con un paso pendiente, o completa con cerebro y agente apagado, la
  entrada sigue en el menú.
- **AC4** `/onboarding` sigue cargando por URL con todo listo.
- **AC5** Gate (`typecheck`, `lint`, `build`, `test`), `pnpm check:task` y
  `e2e-selftest` con mocks en verde.
