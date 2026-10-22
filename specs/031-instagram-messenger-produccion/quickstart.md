# Quickstart: 031 — verificar y salir a producción

Cómo comprobar la 031 en local y cómo encenderla en Wline-ext. Cada paso dice
**quién** lo hace:

- **Claude**: quien implementa.
- **Dueño**: lo que solo puede hacer el dueño de las cuentas.

## 1. Local, con mocks (Claude)

`.env` de desarrollo con los mocks encendidos (ver
`specs/001-vocero-core/quickstart.md`):

```bash
WA_MOCK_ENABLED=true
CHANNELS=whatsapp,instagram,messenger,tiktok
META_GRAPH_BASE_URL=http://localhost:3000/api/dev/wa-mock/graph
OPENROUTER_BASE_URL=http://localhost:3000/api/dev/ai-mock
ZERNIO_BASE_URL=http://localhost:3000/api/dev/zernio-mock
```

Gate técnico:

```bash
pnpm typecheck && pnpm lint && pnpm build && pnpm test
```

Con la app viva (`pnpm dev`), los guiones:

```bash
pnpm test:e2e
```

```bash
node --env-file=.env scripts/e2e-canales.mjs
```

```bash
node --env-file=.env scripts/e2e-messenger.mjs
```

```bash
node --env-file=.env scripts/e2e-ventana-social.mjs
```

```bash
node --env-file=.env scripts/e2e-tiktok.mjs
```

```bash
node --env-file=.env scripts/e2e-despacho.mjs
```

**Lo que debe verse**:

- La afirmación de AC7 (id de Instagram = id del mock) **falla antes de D1**
  y pasa después.
- El evento tardío de AC4 no mueve `lastInboundAt`.
- El DM «respuesta larga» llega al mock de Zernio en varias partes de 1.000
  bytes o menos (AC17).
- Todo en verde.

## 2. Publicar la imagen propia

| Paso | Quién | Comprobación |
|---|---|---|
| PR de `feat/031-instagram-messenger-produccion` a `main` del fork, con CI e imagen en verde | Claude abre el PR; el dueño lo aprueba | Checks en verde |
| `git tag v1.6.0-wline.1 && git push origin v1.6.0-wline.1` sobre `main` | Claude, con permiso del dueño | El workflow *Imagen* termina en verde y publica |
| Hacer público el paquete: perfil de GitHub → *Packages* → `wline-ext` → *Package settings* → *Change visibility* → *Public* | Dueño | El paquete muestra «Public» |

## 3. Encender en Wline-ext

| Paso | Quién | Comprobación |
|---|---|---|
| En Coolify, la imagen de Wline-ext pasa a `ghcr.io/diegomoralesconexiones/wline-ext` con la etiqueta `1.6.0-wline.1` | Claude, con permiso del dueño (o el dueño en la UI) | — |
| Agregar la variable de ejecución `CHANNELS=whatsapp,instagram,messenger` | Igual | — |
| Redesplegar | Igual | `curl -s https://wline-ext.morales-tec.xyz/api/health` muestra el commit del tag, `commitVerified: true` y los tres canales (AC9) |
| Ajustes → IA → «Probar conexión» | Dueño (Claude puede guiarlo en el navegador) | Responde bien |
| Guardar la llave de Zernio en Ajustes → Instagram y Ajustes → Messenger. **Nunca** se escribe en el chat | Dueño | Ajustes → Canales: las dos cuentas sanas y el webhook con secreto, sin `sin_https` (AC10) |
| Mandar el evento de prueba de Zernio | Claude, con permiso del dueño | El log de webhooks de Zernio registra un 200 (AC11) |

**No crear el webhook en el panel de Zernio**: lo crea el CRM, con su secreto.

## 4. Prueba en vivo (Principio IX)

| Paso | Quién | Comprobación |
|---|---|---|
| Desde su Instagram personal, un DM a la cuenta del negocio | Dueño | Entra a la bandeja en segundos; el agente contesta y llega al teléfono (AC12) |
| Un operador responde a mano en esa conversación | Dueño o Claude en el navegador | Llega al teléfono |
| Desde su Facebook personal, un mensaje a la página | Dueño | Igual, por Messenger (AC13) |
| Un DM que pida una respuesta larga | Dueño | Llega en varias partes, sin silencio (AC17/AC18) |
| Un WhatsApp de ida y vuelta | Dueño | Sin cambios (AC14) |

Al terminar, Claude llena la sección «Prueba en vivo» de la spec: fecha,
commit, resultado de cada AC y cualquier desviación.

## Revertir

No hay migración, así que volver atrás es seguro:

- **Solo apagar redes**: quitar `instagram` y `messenger` de `CHANNELS` y
  redesplegar.
- **Volver a la imagen anterior**: `ghcr.io/kevinrivm/vocero-crm:1.6.0`. Es solo
  de emergencia, porque con ella vuelve el hallazgo 4 (D7).
