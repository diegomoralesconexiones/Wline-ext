import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SendError } from "@/server/inbox/send";
// Estático, como en bot-profile.test.ts: `vi.mock` se hoistea y la ruta nace
// con la BD, la llave y el envío falsos.
import { POST } from "@/app/api/bot/messages/route";

/**
 * Wline 031 · D8 — Desde la 2.0 contesta el cerebro por `/api/bot/messages`.
 * Un texto que no cabe en el canal sale en partes que sí caben, en orden, en
 * vez de rechazarse con 422 y dejar al cliente sin respuesta.
 */

const dbState = vi.hoisted(() => ({ queue: [] as unknown[][] }));
const envio = vi.hoisted(() => ({
  sendText: vi.fn(),
  guardar: vi.fn(),
}));

vi.mock("@/lib/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db")>();
  const builder: Record<string, unknown> = {};
  for (const m of ["select", "from", "where", "limit"]) {
    builder[m] = () => builder;
  }
  (builder as { then: unknown }).then = (resolve: (v: unknown) => void) =>
    resolve(dbState.queue.shift() ?? []);
  return { ...actual, getDb: () => builder };
});

vi.mock("@/server/bot/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/bot/auth")>();
  return { ...actual, requireBotKey: () => null, resolveInstanceOrg: async () => "org_1" };
});

vi.mock("@/server/inbox/send", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/inbox/send")>();
  return { ...actual, sendText: envio.sendText };
});

vi.mock("@/server/lab/sandbox", () => ({ guardarRespuestaDePrueba: envio.guardar }));

/** Unos 2.500 bytes en tres párrafos, con acentos y un emoji. */
const frase = (i: number) => `Frase número ${i} con acentos: cañón, pingüino y café ☕.`;
const parrafo = (desde: number) =>
  Array.from({ length: 14 }, (_, k) => frase(desde + k)).join(" ");
const LARGO = [parrafo(1), parrafo(15), parrafo(29)].join("\n\n");
const palabras = (t: string) => t.split(/\s+/).filter(Boolean);
const bytes = (t: string) => Buffer.byteLength(t);

function conversacion(channel: string, extra: Record<string, unknown> = {}) {
  dbState.queue.push([{ aiEnabled: true, handoffAt: null, isTest: false, channel, ...extra }]);
}

function pedir(text: string) {
  return POST(
    new Request("http://crm.test/api/bot/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId: "cv_1", text }),
    })
  );
}

/** Lo que recibió `sendText`, en orden. */
const enviados = () => envio.sendText.mock.calls.map(([input]) => (input as { text: string }).text);

beforeEach(() => {
  dbState.queue = [];
  let n = 0;
  envio.sendText.mockReset().mockImplementation(async () => ({ messageId: `msg_${++n}` }));
  envio.guardar.mockReset().mockImplementation(async () => ({ messageId: `msg_lab_${++n}` }));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/bot/messages parte lo que no cabe (D8)", () => {
  it("(preparación) el texto largo pasa de 2.000 bytes", () => {
    expect(bytes(LARGO)).toBeGreaterThan(2000);
  });

  it("Instagram: sale en 3 o más mensajes de 1.000 bytes o menos, en orden y completo", async () => {
    conversacion("instagram");
    const res = await pedir(LARGO);
    expect(res.status).toBe(200);
    const partes = enviados();
    expect(partes.length).toBeGreaterThanOrEqual(3);
    expect(partes.every((p) => bytes(p) <= 1000)).toBe(true);
    expect(palabras(partes.join(" "))).toEqual(palabras(LARGO));
    for (const [input] of envio.sendText.mock.calls) {
      expect(input).toMatchObject({ conversationId: "cv_1", organizationId: "org_1", aiGenerated: true });
    }
    const json = await res.json();
    expect(json.messageIds).toHaveLength(partes.length);
    expect(json.messageId).toBe(json.messageIds[0]);
  });

  it("Messenger: en partes de 2.000 bytes o menos", async () => {
    conversacion("messenger");
    const res = await pedir(LARGO);
    expect(res.status).toBe(200);
    const partes = enviados();
    expect(partes.length).toBeGreaterThanOrEqual(2);
    expect(partes.every((p) => bytes(p) <= 2000)).toBe(true);
    expect(palabras(partes.join(" "))).toEqual(palabras(LARGO));
  });

  it("lo que cabe sale entero, en un solo mensaje, como siempre", async () => {
    conversacion("whatsapp");
    const res = await pedir(LARGO);
    expect(res.status).toBe(200);
    expect(enviados()).toEqual([LARGO]);
    expect(await res.json()).toEqual({ messageId: "msg_1", messageIds: ["msg_1"] });
  });

  it("Laboratorio: guarda las mismas partes y no envía nada", async () => {
    // Más de lo que cabe en WhatsApp (4.096) y menos del tope del esquema (6.000).
    const muyLargo = [LARGO, LARGO].join("\n\n");
    expect(muyLargo.length).toBeGreaterThan(4096);
    expect(muyLargo.length).toBeLessThan(6000);
    conversacion("whatsapp", { isTest: true });
    const res = await pedir(muyLargo);
    expect(res.status).toBe(200);
    expect(envio.sendText).not.toHaveBeenCalled();
    const guardadas = envio.guardar.mock.calls.map(([input]) => (input as { text: string }).text);
    expect(guardadas.length).toBeGreaterThanOrEqual(2);
    expect(guardadas.every((t) => t.length <= 4096)).toBe(true);
    expect(palabras(guardadas.join(" "))).toEqual(palabras(muyLargo));
    const json = await res.json();
    expect(json.status).toBe("sent");
    expect(json.messageIds).toHaveLength(guardadas.length);
  });

  it("si la ventana se cierra a media respuesta, no manda lo que falta y responde 409", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    envio.sendText
      .mockReset()
      .mockResolvedValueOnce({ messageId: "msg_1" })
      .mockRejectedValueOnce(new SendError("window_closed", "La ventana se cerró"));
    conversacion("instagram");
    const res = await pedir(LARGO);
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("window_closed");
    expect(envio.sendText).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("salieron 1 de"));
    // El texto del cliente no va a los logs.
    expect(JSON.stringify(warn.mock.calls)).not.toContain("Frase número");
  });

  it("con la IA en pausa no sale ninguna parte", async () => {
    conversacion("instagram", { aiEnabled: false });
    const res = await pedir(LARGO);
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("ai_paused");
    expect(envio.sendText).not.toHaveBeenCalled();
  });
});
