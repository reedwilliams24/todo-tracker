import { appendFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { FIXTURES_DIR, readJson, SPEC_DIR } from "./paths";

/** Prints the web/iOS/Android parity matrix and fails if spec/platforms.json is out of sync with the spec. */
type Status = "pass" | "missing" | "n/a";
type Matrix = Record<string, Record<string, Status>>;
type Platforms = { platforms: string[]; fixtures: Matrix; scenarios: Matrix };

const config = readJson<Platforms>(join(SPEC_DIR, "platforms.json"));
const fixtureNames = readdirSync(FIXTURES_DIR)
  .filter((file) => file.endsWith(".json"))
  .map((file) => file.replace(/\.json$/, ""));
const scenarioNames = readJson<{ scenarios: { name: string }[] }>(join(SPEC_DIR, "scenarios/core.json")).scenarios.map(
  (s) => s.name,
);

const problems: string[] = [];
function checkRows(kind: string, matrix: Matrix, expected: string[]) {
  for (const name of expected) if (!matrix[name]) problems.push(`${kind} "${name}" has no row in platforms.json`);
  for (const [name, row] of Object.entries(matrix)) {
    if (!expected.includes(name)) problems.push(`${kind} "${name}" in platforms.json does not exist`);
    for (const platform of config.platforms) {
      if (!["pass", "missing", "n/a"].includes(row[platform] ?? "")) {
        problems.push(`${kind} "${name}" has no valid status for ${platform}`);
      }
    }
  }
}
checkRows("fixture", config.fixtures, fixtureNames);
checkRows("scenario", config.scenarios, scenarioNames);

const ICON: Record<Status, string> = { pass: "✅", missing: "❌", "n/a": "—" };
function table(title: string, matrix: Matrix): string {
  const header = `| ${title} | ${config.platforms.join(" | ")} |`;
  const divider = `| --- | ${config.platforms.map(() => ":---:").join(" | ")} |`;
  const rows = Object.entries(matrix).map(
    ([name, row]) => `| ${name} | ${config.platforms.map((p) => ICON[row[p] ?? "missing"]).join(" | ")} |`,
  );
  return [header, divider, ...rows].join("\n");
}

const summary = config.platforms
  .map((platform) => {
    const all = [...Object.values(config.fixtures), ...Object.values(config.scenarios)].filter((r) => r[platform] !== "n/a");
    return `${platform}: ${all.filter((r) => r[platform] === "pass").length}/${all.length}`;
  })
  .join(", ");

const report = `## Platform parity\n\n${summary}\n\n${table("Fixtures", config.fixtures)}\n\n${table("Scenarios", config.scenarios)}\n`;
console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
