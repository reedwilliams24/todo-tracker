#!/usr/bin/env node
// Splits the Maestro flows into parallel CI jobs ("slices") and checks their JUnit reports afterwards.
//
//   node scripts/maestro-slices.mjs list <index> <total>      flows for one slice (0-based index, as in
//                                                              strategy.job-index), space-separated
//   node scripts/maestro-slices.mjs report <junit-dir> <title>  Markdown table of every slice's results;
//                                                              exits 1 unless every flow passed exactly once
//
// A flow belongs to the suite when it has the `spec` tag, the same rule as `maestro test --include-tags spec`,
// so a new flow lands in a slice with no list to edit. Slices are balanced by top-level step count, heaviest
// flow first. `report` reads one `<platform>-<slice>.xml` per slice.
import { appendFileSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const flowsDir = fileURLToPath(new URL("../spec/scenarios/maestro/", import.meta.url));
const TAG = "spec";

function specFlows() {
  return readdirSync(flowsDir)
    .filter((file) => file.endsWith(".yaml"))
    .sort()
    .map((file) => {
      const text = readFileSync(join(flowsDir, file), "utf8");
      const [header, body = ""] = text.split(/^---$/m);
      const lines = header.split("\n");
      const tagsAt = lines.findIndex((line) => /^tags:/.test(line));
      const tags = [];
      if (tagsAt >= 0) {
        const inline = lines[tagsAt].match(/^tags:\s*\[(.*)\]/);
        if (inline) tags.push(...inline[1].split(",").map(unquote));
        for (const line of lines.slice(tagsAt + 1)) {
          const item = line.match(/^\s+-\s*(.+)$/);
          if (!item) break;
          tags.push(unquote(item[1]));
        }
      }
      const name = header.match(/^name:\s*(.+)$/m);
      return {
        path: join(flowsDir, file),
        name: name ? unquote(name[1]) : file.replace(/\.yaml$/, ""),
        steps: body.split("\n").filter((line) => line.startsWith("- ")).length,
        tags,
      };
    })
    .filter((flow) => flow.tags.includes(TAG));
}

function unquote(value) {
  return value.trim().replace(/^(["'])(.*)\1$/, "$2");
}

function list(index, total) {
  if (!Number.isInteger(total) || total < 1 || !Number.isInteger(index) || index < 0 || index >= total) {
    throw new Error(`expected 0 <= index < total, got index=${index} total=${total}`);
  }
  const slices = Array.from({ length: total }, () => ({ steps: 0, flows: [] }));
  const byWeight = specFlows().sort((a, b) => b.steps - a.steps || a.name.localeCompare(b.name));
  for (const flow of byWeight) {
    const lightest = slices.reduce((min, slice) => (slice.steps < min.steps ? slice : min));
    lightest.steps += flow.steps;
    lightest.flows.push(flow);
  }
  const { flows } = slices[index];
  if (flows.length === 0) throw new Error(`slice ${index + 1}/${total} has no flows; use fewer slices`);
  console.log(flows.map((flow) => relative(process.cwd(), flow.path)).join(" "));
}

function report(dir, title) {
  const results = new Map(specFlows().map((flow) => [flow.name, []]));
  const files = existsSync(dir) ? readdirSync(dir).filter((file) => file.endsWith(".xml")) : [];
  for (const file of files.sort()) {
    const slice = file.match(/-(\d+)\.xml$/)?.[1] ?? file;
    const xml = readFileSync(join(dir, file), "utf8");
    for (const [, attrs, inner = ""] of xml.matchAll(/<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g)) {
      const attr = (key) => decode(attrs.match(new RegExp(`\\b${key}="([^"]*)"`))?.[1] ?? "");
      const failure = inner.match(/<(?:failure|error)\b[^>]*>([\s\S]*?)<\/(?:failure|error)>|<(?:failure|error)\b/);
      const status = attr("status");
      const passed = !failure && (status === "" || status === "SUCCESS" || status === "WARNING");
      const message = failure ? decode(failure[1] ?? "").trim() : passed ? "" : status;
      const name = attr("name");
      if (!results.has(name)) results.set(name, []);
      results.get(name).push({ slice, passed, message, seconds: Number(attr("time")) });
    }
  }

  const rows = [];
  let bad = 0;
  for (const [name, runs] of [...results].sort(([a], [b]) => a.localeCompare(b))) {
    const run = runs[0];
    let result = run?.passed ? "✅ passed" : `❌ failed: ${firstLine(run?.message) || "no message"}`;
    if (runs.length === 0) result = "❌ no result (its slice didn't finish or didn't run it)";
    if (runs.length > 1) result = `❌ ran ${runs.length} times (slices ${runs.map((r) => r.slice).join(", ")})`;
    if (runs.length !== 1 || !run.passed) bad++;
    if (runs.length > 0 && !(runs.length === 1 && run.passed)) {
      console.log(`::error title=Maestro ${name}::${result.replace(/^❌ /, "")}`);
    }
    rows.push(`| ${name} | ${run?.slice ?? "–"} | ${cell(result)} | ${run ? duration(run.seconds) : ""} |`);
  }
  const total = results.size;
  const heading = `${title}: ${bad === 0 ? `${total}/${total} flows passed` : `${bad} of ${total} flows failed or didn't run`}`;
  if (bad > 0) console.log(`::error title=${title}::${heading}`);
  const markdown = [
    `### ${heading}`,
    "",
    "| Flow | Slice | Result | Time |",
    "| ---- | ----- | ------ | ---- |",
    ...rows,
    "",
  ].join("\n");
  console.log(markdown);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown + "\n");
  process.exitCode = bad === 0 ? 0 : 1;
}

function decode(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&(lt|gt|quot|apos|amp);/g, (_, n) => ({ lt: "<", gt: ">", quot: '"', apos: "'", amp: "&" })[n]);
}

function firstLine(text = "") {
  const line = text.split("\n")[0].trim();
  return line.length > 160 ? `${line.slice(0, 157)}...` : line;
}

function cell(text) {
  return text.replace(/\|/g, "\\|");
}

function duration(seconds) {
  if (!Number.isFinite(seconds)) return "";
  const s = Math.round(seconds);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

const [command, ...args] = process.argv.slice(2);
if (command === "list" && args.length === 2) list(Number(args[0]), Number(args[1]));
else if (command === "report" && args.length === 2) report(args[0], args[1]);
else {
  console.error("usage: maestro-slices.mjs list <index> <total> | report <junit-dir> <title>");
  process.exitCode = 2;
}
