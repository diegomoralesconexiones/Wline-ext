import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // El tsconfig dice `jsx: "preserve"` porque de JSX se encarga Next. Vitest
  // no es Next: sin esto compila el JSX al runtime clásico (`React.
  // createElement` sin importar React) y un componente no se puede dibujar
  // en una prueba (ver tests/unit/switch.test.ts).
  esbuild: { jsx: "automatic" },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    // Solo con `--coverage` (CONSTRAINTS.md): `pnpm test` sigue igual de
    // rápido. `json-summary` es lo que compara el trinquete; `lcovonly`, lo
    // que se cruza con el diff para la cobertura de las líneas nuevas. No
    // `lcov`: su informe HTML trae JavaScript que ESLint acaba revisando.
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      reporter: ["text-summary", "json-summary", "lcovonly"],
      reportsDirectory: "coverage",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
});
