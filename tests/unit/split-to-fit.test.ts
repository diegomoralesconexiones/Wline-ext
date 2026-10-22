import { describe, expect, it } from "vitest";
import { plainSocialText } from "@/lib/social-text";
import {
  MAX_REPLY_PARTS,
  replyParts,
  splitToFit,
  textFits,
} from "@/server/channels/capabilities";

/**
 * 031 · D8 — Una respuesta del agente que no cabe en el canal se manda en
 * varias partes que sí caben, en vez de quedarse callado (R1).
 */

const bytes = (t: string) => Buffer.byteLength(t, "utf8");
const palabras = (partes: string[]) => partes.join(" ").split(/\s+/).filter(Boolean);

/** Un párrafo de ~620 bytes: catorce frases con acentos. */
const parrafo = (n: number) =>
  Array.from({ length: 14 }, (_, i) => `Párrafo ${n}, frase ${i + 1}: envíos y garantías.`).join(" ");

describe("031 · splitToFit", () => {
  it("un texto que cabe sale en una sola parte, tal cual", () => {
    expect(splitToFit("instagram", "Hola, ¿cómo estás? 😀")).toEqual(["Hola, ¿cómo estás? 😀"]);
    expect(splitToFit("instagram", "a".repeat(1000))).toEqual(["a".repeat(1000)]);
  });

  it("más de 1.000 bytes con párrafos se corta en los párrafos", () => {
    const [p1, p2, p3] = [parrafo(1), parrafo(2), parrafo(3)];
    expect(bytes(p1) + bytes(p2)).toBeGreaterThan(1000);
    expect(splitToFit("instagram", `${p1}\n\n${p2}\n\n${p3}`)).toEqual([p1, p2, p3]);
  });

  it("un párrafo que no cabe se corta en frases, llenando cada parte", () => {
    const texto = Array.from({ length: 30 }, (_, i) => `Frase número ${i + 1}, con acentos: sí.`).join(" ");
    const partes = splitToFit("instagram", texto);
    expect(partes.length).toBeGreaterThan(1);
    expect(partes.every((p) => /[.!?…]$/.test(p))).toBe(true);
    expect(partes.join(" ")).toBe(texto);
    // La primera parte no admitía ni una frase más.
    const siguiente = partes[1]!.split(/(?<=\.)\s/)[0]!;
    expect(bytes(`${partes[0]} ${siguiente}`)).toBeGreaterThan(1000);
  });

  it("una frase que no cabe se corta en palabras, sin partir ninguna", () => {
    const texto = Array.from({ length: 300 }, (_, i) => `palabra${i}`).join(" ");
    const partes = splitToFit("instagram", texto);
    expect(partes.length).toBeGreaterThan(1);
    expect(palabras(partes)).toEqual(texto.split(" "));
  });

  it("una palabra que no cabe se corta en puntos de código, sin partir un emoji", () => {
    const texto = "😀".repeat(400);
    const partes = splitToFit("instagram", texto);
    expect(partes.map((p) => Array.from(p).length)).toEqual([250, 150]);
    expect(partes.every((p) => Array.from(p).every((c) => c === "😀"))).toBe(true);
    expect(partes.join("")).toBe(texto);
  });

  it("no deja partes vacías ni con espacios sobrantes, y cada una cabe", () => {
    const texto = `\n\n  ${parrafo(1)}\n\n\n\n${parrafo(2)}   \n \n${parrafo(3)}  \n`;
    const partes = splitToFit("instagram", texto);
    expect(partes).toHaveLength(3);
    for (const p of partes) {
      expect(p).not.toBe("");
      expect(p).toBe(p.trim());
      expect(textFits("instagram", p)).toBe(true);
    }
    expect(palabras(partes)).toEqual(texto.split(/\s+/).filter(Boolean));
  });

  it(`como mucho ${MAX_REPLY_PARTS} partes; la última termina en «…»`, () => {
    const parrafos = Array.from({ length: 12 }, (_, i) => parrafo(i + 1));
    const partes = splitToFit("instagram", parrafos.join("\n\n"));
    expect(partes).toHaveLength(MAX_REPLY_PARTS);
    expect(partes.slice(0, MAX_REPLY_PARTS - 1)).toEqual(parrafos.slice(0, MAX_REPLY_PARTS - 1));
    expect(partes.at(-1)!.endsWith("…")).toBe(true);
    expect(partes.every((p) => textFits("instagram", p))).toBe(true);
  });

  it("Messenger corta en 2.000 bytes y junta los párrafos que caben", () => {
    const [p1, p2, p3, p4] = [parrafo(1), parrafo(2), parrafo(3), parrafo(4)];
    const partes = splitToFit("messenger", [p1, p2, p3, p4].join("\n\n"));
    expect(partes).toEqual([`${p1}\n\n${p2}\n\n${p3}`, p4]);
    expect(partes.every((p) => bytes(p) <= 2000)).toBe(true);
  });

  it("WhatsApp mide en caracteres (4.096), no en bytes", () => {
    expect(splitToFit("whatsapp", "😀".repeat(4096))).toHaveLength(1);
    expect(splitToFit("whatsapp", "a".repeat(4097))).toEqual(["a".repeat(4096), "a"]);
  });
});

describe("031 · replyParts", () => {
  it("en los canales sin formato quita las marcas antes de medir y partir", () => {
    const conFormato = Array.from(
      { length: 40 },
      (_, i) => `**Paso ${i + 1}:** revisa el _catálogo_ y elige.`
    ).join(" ");
    const partes = replyParts("instagram", conFormato);
    expect(partes).toEqual(splitToFit("instagram", plainSocialText(conFormato)));
    expect(partes.length).toBeGreaterThan(1);
    expect(partes.some((p) => /[*_]/.test(p))).toBe(false);
  });

  it("en WhatsApp el formato se queda: lo dibuja el canal", () => {
    expect(replyParts("whatsapp", "*hola* _ahí_")).toEqual(["*hola* _ahí_"]);
  });

  it("lo que sale ya está limpio: limpiarlo otra vez al enviar no lo hace crecer", () => {
    // Un corte puede dejar al inicio de una parte un «- » que en el texto
    // completo iba a media línea. Al enviar, sendText limpia cada parte y lo
    // volvería viñeta (dos bytes más): la parte medida ya no cabría.
    let lista = "- clavo";
    while (bytes(`${lista} clavo.`) <= 1000) lista += " clavo";
    lista = `${lista}${"s".repeat(1000 - bytes(`${lista}.`))}.`;
    const texto = `${"Una frase de relleno. ".repeat(20).trim()} ${lista}`;
    expect(plainSocialText(texto)).toBe(texto);

    const partes = replyParts("instagram", texto);
    for (const p of partes) {
      expect(plainSocialText(p)).toBe(p);
      expect(textFits("instagram", p)).toBe(true);
    }
  });
});
