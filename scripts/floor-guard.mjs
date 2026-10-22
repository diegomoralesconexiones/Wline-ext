#!/usr/bin/env node
/**
 * Guardia del piso de CONSTRAINTS.md, sobre el diff contra la base.
 *
 * Adaptado de la referencia de la skill constraint-driven-development
 * (.claude/skills/constraint-driven-development/references/floor-guard.md):
 * mismo contrato, patrones de este repo. Detecta las cinco jugadas que bajan
 * el listón para llegar a verde: una supresión nueva, una prueba que se volvió
 * más fácil, trabajo sin terminar, una excepción nueva y una regla de
 * CONSTRAINTS.md aflojada o borrada.
 *
 * Uso: node scripts/floor-guard.mjs [--base <ref>]   (por defecto origin/main)
 * Salida: 0 limpio · 1 al menos una violación (bloquea) · 2 no pudo correr.
 * Un 2 nunca se lee como 0.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const base = (() => {
  const i = process.argv.indexOf("--base");
  return i > -1 ? process.argv[i + 1] : "origin/main";
})();

// `git diff --no-index` sale con 1 siempre que los lados difieren (lo normal
// en un archivo nuevo), así que esa salida se conserva. Cualquier otro fallo
// es null, y null nunca cuenta como limpio.
const git = (args, { diffExit = false } = {}) => {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 28 });
  } catch (e) {
    return diffExit && e.status === 1 && typeof e.stdout === "string" ? e.stdout : null;
  }
};
const bail = (msg) => {
  console.error("floor-guard: " + msg);
  process.exit(2);
};

const top = git(["rev-parse", "--show-toplevel"])?.trim();
if (!top) bail("no estoy dentro de un repositorio git");
process.chdir(top);

const mergeBase = git(["merge-base", base, "HEAD"])?.trim();
if (!mergeBase) bail("no hay merge base contra " + base);

// Rutas que la guardia no mira (una por línea, con * y **). Una excepción
// legítima queda como archivo versionado, no como regla aflojada.
const ignoreGlobs = existsSync(".constraintsignore")
  ? readFileSync(".constraintsignore", "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"))
  : [];
const globToRe = (g) =>
  new RegExp(
    "^" +
      g
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*\*/g, "\u0000")
        .replace(/\*/g, "[^/]*")
        .replace(/\u0000/g, ".*") +
      "$"
  );
const ignored = ignoreGlobs.map(globToRe);
const isIgnored = (f) => ignored.some((re) => re.test(f));

// Diff unificado más los archivos sin seguimiento (git diff solo no los ve).
const tracked = git(["diff", "--unified=0", mergeBase, "--"]);
if (tracked === null) bail("no se pudo hacer diff contra " + mergeBase);
const untrackedFiles = git(["ls-files", "--others", "--exclude-standard"]);
if (untrackedFiles === null) bail("no se pudieron listar los archivos sin seguimiento");
const untracked = untrackedFiles
  .split("\n")
  .filter(Boolean)
  .filter((f) => !isIgnored(f))
  .map((f) => {
    const d = git(["diff", "--no-index", "--unified=0", "/dev/null", f], { diffExit: true });
    if (d === null) bail("no se pudo hacer diff del archivo nuevo " + f);
    return d;
  })
  .join("\n");
const diff = tracked + "\n" + untracked;

// `---` y `+++` solo son cabeceras entre la línea `diff` de un archivo y su
// primer `@@`; dentro de un trozo todo es contenido.
const added = [];
const removed = [];
const deleted = [];
const pathOf = (s) => s.replace(/^[ab]\//, "");
let file = "";
let oldFile = "";
let inHeader = false;
for (const line of diff.split("\n")) {
  if (line.startsWith("diff ")) inHeader = true;
  else if (line.startsWith("@@")) inHeader = false;
  else if (inHeader) {
    if (line.startsWith("--- ")) oldFile = pathOf(line.slice(4));
    else if (line.startsWith("+++ ")) {
      const newFile = pathOf(line.slice(4));
      file = newFile === "/dev/null" ? oldFile : newFile;
      if (newFile === "/dev/null") deleted.push(file);
    }
  } else if (line.startsWith("+")) added.push({ file, text: line.slice(1) });
  else if (line.startsWith("-")) removed.push({ file, text: line.slice(1) });
}

const findings = [];
const flag = (rule, f, text) => findings.push({ rule, file: f, text: text.trim().slice(0, 120) });
const isCode = (f) => /\.(ts|tsx|js|mjs|cjs)$/.test(f);
// Las pruebas de este repo: unitarias de Vitest y guiones E2E.
const isTest = (f) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(f) || /^scripts\/e2e-.*\.mjs$/.test(f);
const isConstraints = (f) => /(^|\/)CONSTRAINTS\.md$/.test(f);

// 1. Un chequeo silenciado.
const SUPPRESSIONS =
  /@ts-ignore|@ts-nocheck|@ts-expect-error|eslint-disable|biome-ignore|istanbul ignore|c8 ignore|v8 ignore|nosemgrep|gitleaks:allow|Stryker disable/;
// 4. Trabajo sin terminar. Un TODO vale solo con responsable, `TODO(nombre)`
// (constitución, Principio VII). Un catch vacío tiene que decir por qué.
const STUBS = /[Nn]ot implemented|[Nn]o implementado|catch\s*\(\s*\w*\s*\)\s*\{\s*\}|catch\s*\{\s*\}|\bTODO\b(?!\()/;
// 2. Una prueba que se volvió más fácil.
const SKIPS = /\b(it|test|describe)\.(skip|todo|only)\b|\bxit\(|\bxdescribe\(/;

for (const { file: f, text } of added) {
  if (isIgnored(f)) continue;
  if (isCode(f)) {
    if (SUPPRESSIONS.test(text)) flag("chequeo-silenciado", f, text);
    if (STUBS.test(text)) flag("trabajo-sin-terminar", f, text);
    if (isTest(f) && SKIPS.test(text)) flag("prueba-mas-facil", f, text);
  }
  if (isConstraints(f) && /^\| *(W|E)\d+ *\|/.test(text)) flag("excepcion-nueva", f, text);
}

// 2b. Un archivo de prueba borrado, o una afirmación quitada de uno que sigue.
for (const f of deleted) if (isTest(f) && !isIgnored(f)) flag("prueba-borrada", f, "archivo borrado");
for (const { file: f, text } of removed) {
  if (isTest(f) && !deleted.includes(f) && !isIgnored(f) && /\b(expect|assert|ok)\s*\(/.test(text)) {
    flag("afirmacion-quitada", f, text);
  }
}

// 1b/2c. Una regla de CONSTRAINTS.md aflojada o borrada. Cada número lleva la
// dirección que dicen las palabras alrededor: un mínimo se afloja bajando, un
// máximo subiendo; si no se lee la dirección, se avisa ante cualquier cambio.
const ruleKey = (t) => {
  const s = t.trim();
  if (s.startsWith("|")) return s.split("|").map((c) => c.trim()).filter(Boolean)[0] ?? "";
  if (/^[-*] /.test(s)) return s.slice(2).split(":")[0].trim();
  return null;
};
const isException = (t) => /^\| *(W|E)\d+ *\|/.test(t.trim());
const MIN_BEFORE = /(>=|>|≥|al menos|como mínimo|mínimo|at least|minimum|\bmin\b)\s*$/;
const MAX_BEFORE = /(<=|<|≤|como máximo|a lo sumo|máximo|menos de|at most|maximum|\bmax\b|under|below)\s*$/;
const MIN_AFTER = /^\s*\S*\s*(o más|no puede bajar|must not fall|or more)/;
const MAX_AFTER = /^\s*\S*\s*(o menos|no puede subir|no puede crecer|must not grow|or less)/;
const thresholds = (t) => {
  const out = [];
  const re = /\d+(?:[.,]\d+)?/g;
  let m;
  while ((m = re.exec(t))) {
    const before = t.slice(Math.max(0, m.index - 24), m.index).toLowerCase();
    const after = t.slice(m.index + m[0].length, m.index + m[0].length + 40).toLowerCase();
    const dir =
      MIN_BEFORE.test(before) || MIN_AFTER.test(after)
        ? "min"
        : MAX_BEFORE.test(before) || MAX_AFTER.test(after)
          ? "max"
          : null;
    out.push({ n: Number(m[0].replace(",", ".")), dir });
  }
  return out;
};
const removedRules = removed.filter((l) => isConstraints(l.file) && ruleKey(l.text) !== null);
const addedRules = added.filter((l) => isConstraints(l.file) && ruleKey(l.text) !== null);
for (const r of removedRules) {
  const a = addedRules.find((x) => ruleKey(x.text) === ruleKey(r.text));
  if (!a) {
    if (!isException(r.text)) flag("regla-borrada", r.file, r.text);
    continue;
  }
  const before = thresholds(r.text);
  const after = thresholds(a.text);
  let verdict = null;
  for (const dir of ["min", "max", null]) {
    const was = before.filter((x) => x.dir === dir);
    const now = after.filter((x) => x.dir === dir);
    was.forEach((b, i) => {
      const n = now[i];
      if (verdict) return;
      if (!n) verdict = "umbral-borrado";
      else if (n.n === b.n) return;
      else if (dir === "min" ? n.n < b.n : dir === "max" ? n.n > b.n : true) {
        verdict = dir ? "umbral-aflojado" : "umbral-cambiado";
      }
    });
  }
  if (verdict) flag(verdict, r.file, r.text + "  ->  " + a.text);
}

if (findings.length === 0) {
  console.log("floor-guard: limpio");
  process.exit(0);
}
console.error(`floor-guard: ${findings.length} violación(es) del piso:`);
for (const f of findings) console.error(`  [${f.rule}] ${f.file}: ${f.text}`);
console.error(
  "\nCada una baja el listón. Arregla el código o pásalo por una excepción con responsable y fecha en CONSTRAINTS.md."
);
process.exit(1);
