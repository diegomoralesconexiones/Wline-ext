import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MetaApiError } from "@/lib/meta/client";
import type { InstagramCredentials } from "@/server/instagram/credentials";
import { sendInstagramText } from "@/server/instagram/send";
import { ZERNIO_BASE } from "@/server/zernio";

/**
 * 031 · D1 — Instagram por Zernio habla con el mismo transporte que Messenger
 * y TikTok. La copia propia que tenía leía una respuesta que la API ya no da
 * (`message.id`) y guardaba un `zernio_<hora>` inventado en cada envío.
 */

const credenciales: InstagramCredentials = {
  id: "igc_1",
  organizationId: "org_1",
  source: "zernio",
  igUserId: "17841400000000000",
  accountRef: "acc-ig-1",
  username: "negocio.ig",
  webhookSecret: null,
  status: "connected",
  token: "sk_llave-de-prueba",
};

let respuesta: () => Response = () =>
  Response.json({ success: true, data: { messageId: "aWdfZAG1-real", conversationId: "zconv-1" } });
const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => respuesta());

const enviar = (over: Partial<Parameters<typeof sendInstagramText>[0]> = {}) =>
  sendInstagramText({
    credentials: credenciales,
    recipient: "igsid-cliente",
    threadRef: "zconv-1",
    text: "Hola, sí tenemos envíos",
    ...over,
  });

/** El cuerpo JSON de la única llamada a `fetch`. */
function cuerpoEnviado(): Record<string, unknown> {
  const init = fetchMock.mock.calls[0]?.[1];
  return JSON.parse(String(init?.body)) as Record<string, unknown>;
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockClear();
  respuesta = () =>
    Response.json({ success: true, data: { messageId: "aWdfZAG1-real", conversationId: "zconv-1" } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("031 · enviar por Instagram vía Zernio", () => {
  it("responde en la conversación de Zernio con la cuenta y el texto", async () => {
    await enviar();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${ZERNIO_BASE}/inbox/conversations/zconv-1/messages`);
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer sk_llave-de-prueba");
    expect(cuerpoEnviado()).toEqual({ accountId: "acc-ig-1", message: "Hola, sí tenemos envíos" });
  });

  it("fuera de la ventana, y solo si escribe una persona, va con la etiqueta HUMAN_AGENT", async () => {
    await enviar({ humanAgentTag: true });
    expect(cuerpoEnviado()).toMatchObject({ messagingType: "MESSAGE_TAG", messageTag: "HUMAN_AGENT" });

    fetchMock.mockClear();
    await enviar({ humanAgentTag: false });
    expect(cuerpoEnviado()).not.toHaveProperty("messagingType");
    expect(cuerpoEnviado()).not.toHaveProperty("messageTag");
  });

  it("devuelve el id real del mensaje, el `data.messageId` de Zernio", async () => {
    const res = await enviar();
    expect(res.platformMessageId).toBe("aWdfZAG1-real");
  });

  it("sin referencia de hilo falla con 400 y no llama a nadie", async () => {
    const err = await enviar({ threadRef: null }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MetaApiError);
    expect((err as MetaApiError).status).toBe(400);
    expect((err as MetaApiError).message).toContain("no tiene referencia de hilo en Zernio");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("una llave que Zernio rechaza (401) es un error de autenticación", async () => {
    respuesta = () => Response.json({ error: { message: "Invalid API key" } }, { status: 401 });
    const err = await enviar().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MetaApiError);
    expect((err as MetaApiError).isAuthError).toBe(true);
  });

  it("Zernio caído (503) no se confunde con una llave muerta", async () => {
    respuesta = () => Response.json({ error: { message: "Service unavailable" } }, { status: 503 });
    const err = await enviar().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MetaApiError);
    expect((err as MetaApiError).status).toBe(503);
    expect((err as MetaApiError).isAuthError).toBe(false);
  });
});
