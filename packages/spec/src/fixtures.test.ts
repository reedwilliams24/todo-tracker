import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import { OPS, runOp } from "./ops";
import { FIXTURES_DIR, readJson, SPEC_DIR } from "./paths";
import { renderFixtures } from "./record";

type FixtureFile = { feature: string; cases: { name: string; op: string; given: Record<string, unknown>; then: unknown }[] };

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const schemaDir = join(SPEC_DIR, "schema");
for (const file of readdirSync(schemaDir)) ajv.addSchema(readJson(join(schemaDir, file)), file);
const validateFixture = ajv.getSchema("fixture.schema.json")!;
const validateTodo = ajv.getSchema("todo.schema.json")!;

const files = readdirSync(FIXTURES_DIR).filter((file) => file.endsWith(".json"));

describe("spec fixtures", () => {
  it("are up to date with packages/spec/src/cases.ts", () => {
    for (const [path, content] of renderFixtures()) expect(readFileSync(path, "utf8"), path).toBe(content);
  });

  it("only use known ops", () => {
    const ops = files.flatMap((file) => readJson<FixtureFile>(join(FIXTURES_DIR, file)).cases.map((c) => c.op));
    expect(ops.filter((op) => !(op in OPS))).toEqual([]);
  });
});

for (const file of files) {
  const fixture = readJson<FixtureFile>(join(FIXTURES_DIR, file));

  describe(`fixtures/${file}`, () => {
    it("matches fixture.schema.json", () => {
      expect(validateFixture(fixture), JSON.stringify(validateFixture.errors)).toBe(true);
    });

    it.each(fixture.cases.map((c) => [c.name, c] as const))("%s", (_name, c) => {
      expect(runOp(c.op, c.given)).toEqual(c.then);
    });
  });
}

describe("storage schema", () => {
  it("accepts every todo the fixtures produce", () => {
    const fixture = readJson<FixtureFile>(join(FIXTURES_DIR, "todo.json"));
    for (const c of fixture.cases.filter((c) => c.op === "createTodo" || c.op === "toggleTodo")) {
      expect(validateTodo(c.then), `${c.name}: ${JSON.stringify(validateTodo.errors)}`).toBe(true);
    }
  });
});
