# Instagram y Messenger en producción (Wline-ext)

> One-pager de `idea-refine` (2026-10-21). Da origen a la spec 031. La
> referencia técnica está en [docs/zernio-meta-referencia.md](../zernio-meta-referencia.md).

## Problema

¿Cómo ponemos Instagram y Messenger por Zernio a recibir y contestar DMs reales
en `wline-ext.morales-tec.xyz`, con un solo deploy y sin repetir un error que
ya se «arregló» una vez?

## Dirección recomendada

El código de los dos canales ya existe (1.6.0). Lo que falta es corregir dos
fallas del núcleo y encenderlo. Se hacen tres cambios pequeños:

- Instagram usa el transporte compartido de Zernio (`sendZernioMessage`), que
  ya lee `data.messageId`. Hoy tiene su propia copia, que guarda un id inventado.
- `lastInboundAt` nunca retrocede. Zernio reintenta hasta 7 veces en unas 51 h,
  así que un mensaje viejo puede llegar después de uno nuevo.
- El mock de Zernio responde con la forma real de la API, para que las pruebas
  atrapen esta clase de error.

Wline-ext hoy corre la imagen de Kevin (`ghcr.io/kevinrivm/vocero-crm:1.6.0`),
así que el código de este repo no llega a producción por sí solo. **El fork
(`diegomoralesconexiones/Wline-ext`) es la fuente**: un tag publica su propia
imagen con `imagen.yml` y Coolify pasa a usarla. Las versiones nuevas de Kevin
se traen con *Sync fork* y se republican con su propio tag.

## Supuestos a validar

- [x] GitHub Actions está activo en el fork. *Confirmado por el dueño.*
- [x] `imagen.yml` puede publicar en GHCR desde el fork. *Declara
  `packages: write` y usa `GITHUB_TOKEN`.*
- [x] La imagen no lleva secretos y puede ser pública. *El Dockerfile solo fija
  variables inofensivas; los secretos van en Coolify.*
- [ ] El paquete de GHCR queda público después de la primera publicación.
  *Se marca en Package settings → Change visibility.*
- [ ] La cuenta de Instagram es profesional y la página de Facebook está
  conectada en Zernio con mensajería. *Se valida en Ajustes → Canales al
  guardar la conexión.*
- [ ] La llave de Zernio tiene acceso a la bandeja y a los webhooks. *Guardar
  la conexión ya la prueba.*
- [ ] `APP_BASE_URL` de Wline-ext es https pública. *Se ve en Canales → Estado;
  si no, sale `sin_https`.*
- [ ] El agente del CRM está configurado y no hay un cerebro externo desviando
  las respuestas. *Se valida con Ajustes → IA → «Probar conexión».*
- [ ] El agente responde en menos de 1.000 bytes en Instagram. *Se valida en el
  E2E y en el DM real.*
- [ ] Cambiar el mock no rompe los E2E de Messenger ni de TikTok. *Se valida
  con `pnpm test:e2e`.*

## Alcance mínimo

**Entra:**

- Los tres cambios de código, con sus pruebas.
- El tag `v1.6.0-wline.1`, la imagen pública en GHCR y Coolify apuntando a ella.
- `CHANNELS=whatsapp,instagram,messenger` en Coolify.
- La llave de Zernio guardada desde Ajustes: el CRM crea el webhook con su secreto.
- El evento de prueba de Zernio y, después, un DM real a Instagram y otro a
  Messenger desde las cuentas personales del dueño. Cada uno recibe respuesta
  del agente y una respuesta manual del operador.

**Queda fuera:** todo lo demás.

## No haremos (y por qué)

- **Meta directo:** requiere App Review; Zernio ya lo resuelve.
- **PR a Kevin:** el fork es la fuente. Queda como opcional para el futuro.
- **TikTok:** no es parte de la meta.
- **Adjuntos de salida, mensajes escritos desde la app nativa y acuses de
  entregado/leído:** son funciones nuevas, no son necesarias para «entra y se
  responde».
- **Hallazgos 1 (guardar antes del ACK) y 3 (llave de idempotencia):** necesitan
  diseño; van en una spec posterior.
- **Lista de despegue automatizada:** sirve cuando se repita por cliente, no
  para el primer despegue.
- **Crear el webhook a mano en el panel de Zernio:** quedaría sin secreto y la
  firma no protegería nada.

## Preguntas abiertas

- ¿A qué hora casi nadie le escribe al negocio? Esa es la ventana de despliegue.
