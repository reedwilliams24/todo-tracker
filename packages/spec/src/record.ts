import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { FEATURES } from "./cases";
import { runOp } from "./ops";
import { FIXTURES_DIR, toJson } from "./paths";

/** Renders spec/fixtures/<feature>.json from the case definitions and the current TS implementation. */
export function renderFixtures(): Map<string, string> {
  const files = new Map<string, string>();
  for (const feature of FEATURES) {
    const cases = feature.cases.map(({ name, op, given }) => ({ name, op, given, then: runOp(op, given) }));
    files.set(
      join(FIXTURES_DIR, `${feature.feature}.json`),
      toJson({ $schema: "../schema/fixture.schema.json", feature: feature.feature, spec: feature.spec, cases }),
    );
  }
  return files;
}

const isMain = process.argv[1]?.endsWith("record.ts");
if (isMain) {
  const check = process.argv.includes("--check");
  mkdirSync(FIXTURES_DIR, { recursive: true });
  let stale = 0;
  for (const [path, content] of renderFixtures()) {
    const current = existsSync(path) ? readFileSync(path, "utf8") : "";
    if (current === content) continue;
    stale++;
    if (check) console.error(`stale: ${path}`);
    else writeFileSync(path, content);
  }
  if (check && stale) {
    console.error("Fixtures are out of date. Run `pnpm spec:record` and review the diff.");
    process.exit(1);
  }
  console.log(check ? "fixtures up to date" : `wrote ${stale} fixture file(s)`);
}
