import { appendFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { FIXTURES_DIR, loadScenarios, readJson } from "./paths";

/**
 * Prints the web/iOS/Android parity matrix. Each fixture file and each scenario file carries its
 * own `status`, so there is no shared matrix file for feature PRs to conflict on.
 */
type Status = "pass" | "missing" | "n/a";
type Matrix = Record<string, Record<string, Status | undefined>>;
const PLATFORMS = ["web", "ios", "android"] as const;

const problems: string[] = [];
const fixtures: Matrix = {};
for (const file of readdirSync(FIXTURES_DIR).filter((f) => f.endsWith(".json")).sort()) {
  fixtures[file.replace(/\.json$/, "")] = readJson<{ status?: Matrix[string] }>(join(FIXTURES_DIR, file)).status ?? {};
}
const scenarios: Matrix = {};
for (const scenario of loadScenarios()) {
  if (`${scenario.name}.json` !== scenario.file) problems.push(`scenarios/core/${scenario.file} must be named ${scenario.name}.json`);
  scenarios[scenario.name] = (scenario.status ?? {}) as Matrix[string];
}

function checkRows(kind: string, matrix: Matrix) {
  for (const [name, row] of Object.entries(matrix)) {
    for (const platform of PLATFORMS) {
      if (!["pass", "missing", "n/a"].includes(row[platform] ?? "")) {
        problems.push(`${kind} "${name}" has no valid status for ${platform}`);
      }
    }
  }
}
checkRows("fixture", fixtures);
checkRows("scenario", scenarios);

const ICON: Record<Status, string> = { pass: "✅", missing: "❌", "n/a": "—" };
function table(title: string, matrix: Matrix): string {
  const header = `| ${title} | ${PLATFORMS.join(" | ")} |`;
  const divider = `| --- | ${PLATFORMS.map(() => ":---:").join(" | ")} |`;
  const rows = Object.entries(matrix).map(
    ([name, row]) => `| ${name} | ${PLATFORMS.map((p) => ICON[row[p] ?? "missing"]).join(" | ")} |`,
  );
  return [header, divider, ...rows].join("\n");
}

const summary = PLATFORMS.map((platform) => {
  const all = [...Object.values(fixtures), ...Object.values(scenarios)].filter((r) => r[platform] !== "n/a");
  return `${platform}: ${all.filter((r) => r[platform] === "pass").length}/${all.length}`;
}).join(", ");

const report = `## Platform parity\n\n${summary}\n\n${table("Fixtures", fixtures)}\n\n${table("Scenarios", scenarios)}\n`;
console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
