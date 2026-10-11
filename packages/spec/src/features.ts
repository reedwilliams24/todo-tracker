import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Feature, Ops } from "./types";

/**
 * Loads every features/<feature>.ts. A new feature adds a file there instead of editing a
 * shared list, so feature PRs don't conflict with each other.
 */
type FeatureModule = { feature: Feature; ops: Ops };

const dir = join(dirname(fileURLToPath(import.meta.url)), "features");
const files = readdirSync(dir)
  .filter((file) => file.endsWith(".ts"))
  .sort();
const modules = await Promise.all(
  files.map(async (file) => ({ file, module: (await import(pathToFileURL(join(dir, file)).href)) as FeatureModule })),
);

export const FEATURES: Feature[] = [];
export const OPS: Ops = {};
for (const { file, module } of modules) {
  const name = file.replace(/\.ts$/, "");
  if (module.feature.feature !== name) throw new Error(`features/${file} must export feature "${name}"`);
  FEATURES.push(module.feature);
  for (const [op, impl] of Object.entries(module.ops)) {
    if (OPS[op]) throw new Error(`op "${op}" is defined twice (features/${file})`);
    OPS[op] = impl;
  }
}
