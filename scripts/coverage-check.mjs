#!/usr/bin/env node
/**
 * Trinquete de cobertura de CONSTRAINTS.md, sobre lo que ya escribió
 * `vitest run --coverage`: no corre las pruebas otra vez.
 *
 * - Cobertura total de líneas: no puede bajar más que la tolerancia respecto
 *   al valor registrado en CONSTRAINTS.md. Avisa hasta la fecha de «bloquean
 *   desde» y después bloquea.
 * - Cobertura de las líneas nuevas: se mide (lcov × git diff) y se informa,
 *   sin umbral (CONSTRAINTS.md, «Medido, aún sin hacer cumplir»).
 *
 * Uso: node scripts/coverage-check.mjs [--base <ref>]   (por defecto origin/main)
 * Salida: 0 bien (o aviso) · 1 bajó la cobertura y ya bloquea · 2 no pudo correr.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const base = (() => {
  const i = process.argv.indexOf("--base");
  return i > -1 ? process.argv[i + 1] : "origin/main";
})();
const bail = (msg) => {
  console.error("coverage-check: " + msg);
  process.exit(2);
};

if (!existsSync("CONSTRAINTS.md")) bail("no encuentro CONSTRAINTS.md");
const constraints = readFileSync("CONSTRAINTS.md", "utf8");
const fila = constraints.split("\n").find((l) => /^\|\s*Cobertura total de líneas/.test(l));
const registrado = Number(fila?.match(/(\d+(?:\.\d+)?)\s*%/)?.[1]);
const tolerancia = Number(fila?.match(/(\d+(?:\.\d+)?)\s*pp/)?.[1] ?? "0.5");
if (!Number.isFinite(registrado)) bail("no encuentro la fila «Cobertura total de líneas» con su % en CONSTRAINTS.md");
const desde = constraints.match(/bloquean desde:\*\*\s*(\d{4}-\d{2}-\d{2})/)?.[1];
const bloquea = desde ? new Date() >= new Date(desde + "T00:00:00Z") : true;

const resumen = "coverage/coverage-summary.json";
if (!existsSync(resumen)) bail(`no existe ${resumen}: corre antes \`vitest run --coverage\``);
const hoy = JSON.parse(readFileSync(resumen, "utf8")).total.lines.pct;

console.log(`coverage-check: líneas ${hoy}% (registrado ${registrado}%, tolerancia ${tolerancia} pp)`);

// Líneas nuevas: las añadidas en src/ según el diff, cruzadas con lcov.
const diff = (() => {
  try {
    const mb = execFileSync("git", ["merge-base", base, "HEAD"], { encoding: "utf8" }).trim();
    return execFileSync("git", ["diff", "--unified=0", mb, "--", "src"], { encoding: "utf8", maxBuffer: 1 << 28 });
  } catch {
    return null; // sin merge base no hay líneas nuevas que medir; el total sí cuenta
  }
})();
if (diff !== null && existsSync("coverage/lcov.info")) {
  const nuevas = new Map();
  let file = "";
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ ")) file = line.slice(4).replace(/^b\//, "");
    const m = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (m && file !== "/dev/null") {
      const desdeLinea = Number(m[1]);
      const cuantas = m[2] === undefined ? 1 : Number(m[2]);
      const set = nuevas.get(file) ?? new Set();
      for (let i = 0; i < cuantas; i++) set.add(desdeLinea + i);
      nuevas.set(file, set);
    }
  }
  let medibles = 0;
  let cubiertas = 0;
  let actual = "";
  for (const line of readFileSync("coverage/lcov.info", "utf8").split("\n")) {
    if (line.startsWith("SF:")) {
      actual = line.slice(3).replace(/\\/g, "/");
      const i = actual.indexOf("/src/");
      actual = i > -1 ? actual.slice(i + 1) : actual;
    } else if (line.startsWith("DA:")) {
      const [n, hits] = line.slice(3).split(",").map(Number);
      if (nuevas.get(actual)?.has(n)) {
        medibles++;
        if (hits > 0) cubiertas++;
      }
    }
  }
  console.log(
    medibles === 0
      ? "coverage-check: líneas nuevas — ninguna línea ejecutable nueva en src/"
      : `coverage-check: líneas nuevas — ${cubiertas}/${medibles} cubiertas (${((cubiertas / medibles) * 100).toFixed(1)}%), solo se informa`
  );
}

if (hoy + tolerancia < registrado) {
  const msg = `la cobertura total bajó de ${registrado}% a ${hoy}%: agrega pruebas a lo que cambiaste`;
  if (bloquea) {
    console.error("coverage-check: " + msg);
    process.exit(1);
  }
  console.warn(`coverage-check: AVISO — ${msg} (bloquea desde ${desde})`);
}
process.exit(0);
