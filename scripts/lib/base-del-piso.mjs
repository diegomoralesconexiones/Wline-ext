/**
 * La base contra la que el piso juzga una rama (CONSTRAINTS.md, «Versiones de
 * Kevin»). La usan floor-guard, coverage-check y check-security.
 *
 * Normalmente es el merge base con `base` (origin/main). Si la rama trae una
 * versión de Kevin que la base no tiene, el código de esa versión no es de
 * este cambio: se juzga contra la versión más nueva que trae, y así solo
 * cuenta lo propio del fork.
 *
 * Una «versión de Kevin» es una etiqueta vX.Y.Z publicada en su repositorio,
 * leída de ahí con `git ls-remote`, no de las etiquetas locales: una etiqueta
 * puesta a mano sobre un commit propio no esconde nada. Si el repositorio de
 * Kevin no contesta, se queda el merge base de siempre, que es lo más
 * estricto.
 */
import { execFileSync } from "node:child_process";

export const REPO_DE_KEVIN = "https://github.com/kevinrivm/vocero-crm";

const git = (args) =>
  execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 28 });

/** ¿`a` es ancestro de `b`? */
function esAncestro(a, b) {
  try {
    git(["merge-base", "--is-ancestor", a, b]);
    return true;
  } catch {
    // Sale 1 si no lo es y 128 si el commit no está en este clon: los dos son «no».
    return false;
  }
}

const version = (tag) => tag.slice(1).split(".").map(Number);
const masNueva = (a, b) => {
  const [x, y] = [version(a), version(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i] ? a : b;
  return a;
};

/** Las etiquetas vX.Y.Z de Kevin con su commit, o null si no contesta. */
function versionesDeKevin() {
  let salida;
  try {
    salida = execFileSync("git", ["ls-remote", "--tags", REPO_DE_KEVIN], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 30_000,
    });
  } catch (err) {
    console.error(`base-del-piso: el repositorio de Kevin no contestó (${err.code ?? err.status ?? "error"})`);
    return null;
  }
  // Una etiqueta anotada sale dos veces: la etiqueta y, con ^{}, su commit.
  const commits = new Map();
  for (const linea of salida.split("\n")) {
    const m = linea.match(/^([0-9a-f]{40})\trefs\/tags\/(v\d+\.\d+\.\d+)(\^\{\})?$/);
    if (!m) continue;
    const [, sha, tag, pelada] = m;
    if (pelada || !commits.has(tag)) commits.set(tag, sha);
  }
  return commits;
}

/**
 * @param {string} base  la rama contra la que se compara (p. ej. origin/main)
 * @returns {{ commit: string, motivo: string } | null}  null sin merge base
 */
export function baseDelPiso(base) {
  let mergeBase;
  try {
    mergeBase = git(["merge-base", base, "HEAD"]).trim();
  } catch (err) {
    console.error(`base-del-piso: no hay merge base contra ${base} (${err.status ?? "error"})`);
    return null;
  }
  const normal = { commit: mergeBase, motivo: `merge base con ${base}` };

  const kevin = versionesDeKevin();
  if (!kevin) return normal;
  let traida = null;
  for (const [tag, sha] of kevin) {
    if (esAncestro(sha, "HEAD") && !esAncestro(sha, base)) {
      traida = traida ? masNueva(traida, tag) : tag;
    }
  }
  if (!traida) return normal;
  return { commit: kevin.get(traida), motivo: `la rama trae ${traida} de Kevin: se juzga solo lo propio del fork` };
}
