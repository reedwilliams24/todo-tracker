import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
export const SPEC_DIR = join(ROOT, "spec");
export const FIXTURES_DIR = join(SPEC_DIR, "fixtures");
export const SCENARIOS_DIR = join(SPEC_DIR, "scenarios", "core");

export function readJson<T = unknown>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function toJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export type ScenarioStatus = { web: string; ios: string; android: string };
export type Scenario = { name: string; status: ScenarioStatus; steps: (Record<string, unknown> & { do?: string; expect?: string })[] };

/** spec/scenarios/core/<name>.json, one file per scenario, in file-name order. */
export function loadScenarios(): (Scenario & { file: string })[] {
  return readdirSync(SCENARIOS_DIR)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => ({ ...readJson<Scenario>(join(SCENARIOS_DIR, file)), file }));
}
