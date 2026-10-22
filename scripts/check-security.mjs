#!/usr/bin/env node
/**
 * Chequeos externos de CONSTRAINTS.md con Docker: secretos (gitleaks) y
 * dependencias (osv-scanner). Las versiones de las imágenes están fijadas
 * aquí y en CONSTRAINTS.md; si cambian, cambian en los dos.
 *
 * Nunca imprime un secreto: solo la regla, el archivo y la línea.
 *
 * Uso: node scripts/check-security.mjs [secretos|dependencias] [--base <ref>]
 *      (sin argumento corre los dos; base por defecto origin/main)
 * Salida: 0 bien (o aviso) · 1 hallazgo y ya bloquea · 2 no pudo correr
 *         (por ejemplo, sin Docker). Un 2 nunca se lee como 0.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const GITLEAKS = "ghcr.io/gitleaks/gitleaks:v8.30.1";
const OSV = "ghcr.io/google/osv-scanner:v2.0.0";

const args = process.argv.slice(2);
const base = (() => {
  const i = args.indexOf("--base");
  return i > -1 ? args[i + 1] : "origin/main";
})();
const cuales = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--base");
const corre = (c) => cuales.length === 0 || cuales.includes(c);

const constraints = existsSync("CONSTRAINTS.md") ? readFileSync("CONSTRAINTS.md", "utf8") : "";
const desde = constraints.match(/bloquean desde:\*\*\s*(\d{4}-\d{2}-\d{2})/)?.[1];
const bloquea = desde ? new Date() >= new Date(desde + "T00:00:00Z") : true;

const docker = (dockerArgs) =>
  spawnSync("docker", dockerArgs, { encoding: "utf8", maxBuffer: 1 << 28 });
if (docker(["version", "--format", "{{.Server.Version}}"]).status !== 0) {
  console.error("check-security: Docker no responde. En local enciende Docker Desktop; en CI corre en restricciones.yml.");
  process.exit(2);
}
const repo = process.cwd();

let fallos = 0;
const hallazgo = (msg) => {
  if (bloquea) {
    console.error("check-security: " + msg);
    fallos++;
  } else console.warn(`check-security: AVISO — ${msg} (bloquea desde ${desde})`);
};

if (corre("secretos")) {
  // Solo los commits de esta rama: el historial heredado no es de este cambio.
  let rango;
  try {
    const mb = execFileSync("git", ["merge-base", base, "HEAD"], { encoding: "utf8" }).trim();
    rango = `${mb}..HEAD`;
  } catch {
    console.error("check-security: no hay merge base contra " + base);
    process.exit(2);
  }
  const r = docker([
    "run", "--rm", "-v", `${repo}:/repo`, "--entrypoint", "sh", GITLEAKS, "-c",
    `git config --global --add safe.directory /repo && gitleaks git /repo --redact --no-banner --log-opts="${rango}" --report-format json --report-path /tmp/r.json >/dev/null 2>&1; echo "EXIT=$?"; cat /tmp/r.json 2>/dev/null`,
  ]);
  const out = r.stdout ?? "";
  const exit = Number(out.match(/EXIT=(\d+)/)?.[1] ?? NaN);
  if (!Number.isFinite(exit) || (exit !== 0 && exit !== 1)) {
    console.error("check-security: gitleaks no pudo correr");
    process.exit(2);
  }
  const lista = exit === 1 ? JSON.parse(out.slice(out.indexOf("["))) : [];
  if (lista.length === 0) console.log(`check-security: secretos — limpio (${rango})`);
  else {
    for (const f of lista) console.error(`  [${f.RuleID}] ${f.File}:${f.StartLine}`);
    hallazgo(`${lista.length} posible(s) secreto(s) en los commits de esta rama`);
  }
}

if (corre("dependencias")) {
  const r = docker(["run", "--rm", "-v", `${repo}:/src`, OSV, "scan", "source", "--lockfile", "/src/pnpm-lock.yaml", "--format", "json"]);
  let datos;
  try {
    datos = JSON.parse(r.stdout);
  } catch {
    console.error("check-security: osv-scanner no pudo correr: " + (r.stderr ?? "").split("\n")[0]);
    process.exit(2);
  }
  // Severidad máxima CVSS por grupo de vulnerabilidades: alta es 7.0 o más.
  const altas = [];
  for (const res of datos.results ?? []) {
    for (const p of res.packages ?? []) {
      for (const g of p.groups ?? []) {
        if (Number(g.max_severity ?? 0) >= 7) altas.push(`${p.package.name}@${p.package.version} ${g.ids.join(",")} (${g.max_severity})`);
      }
    }
  }
  if (altas.length === 0) console.log("check-security: dependencias — nada de severidad alta o mayor");
  else {
    for (const a of altas) console.error("  " + a);
    hallazgo(`${altas.length} vulnerabilidad(es) de severidad alta o mayor en las dependencias`);
  }
}

process.exit(fallos > 0 ? 1 : 0);
