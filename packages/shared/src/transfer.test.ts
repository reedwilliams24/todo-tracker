import { describe, expect, it } from "vitest";
import { createTodo } from "./todos";
import { applyImport, exportTodosCsv, exportTodosJson, parseImportJson } from "./transfer";

const a = createTodo({ title: "Buy milk", priority: "high", dueDate: "2026-01-02" });
const b = createTodo({ title: 'Say "hi", then leave', notes: "line1\nline2" });

describe("transfer", () => {
  it("round-trips JSON", () => {
    const result = parseImportJson(exportTodosJson([a, b]));
    expect(result.errors).toEqual([]);
    expect(result.todos).toEqual([a, b]);
  });

  it("accepts a bare array", () => {
    expect(parseImportJson(JSON.stringify([a])).todos).toEqual([a]);
  });

  it("escapes CSV cells", () => {
    const [header, ...rows] = exportTodosCsv([a, b]).split("\n");
    expect(header).toBe("id,title,completed,priority,dueDate,notes,createdAt,updatedAt");
    expect(rows.join("\n")).toContain(`${a.id},Buy milk,false,high,2026-01-02,,`);
    expect(rows.join("\n")).toContain(`"Say ""hi"", then leave"`);
    expect(rows.join("\n")).toContain(`"line1\nline2"`);
  });

  it("reports validation errors per item and keeps the valid ones", () => {
    const result = parseImportJson(
      JSON.stringify([
        a,
        { ...b, priority: "urgent" },
        { ...a, title: "dup" },
        { id: "x", title: "", completed: false, priority: "low", createdAt: a.createdAt },
        "nope",
      ]),
    );
    expect(result.todos).toEqual([a]);
    expect(result.errors).toEqual([
      `Item 2 (${b.id}): priority must be low, medium, or high`,
      `Item 3 (${a.id}): duplicate id`,
      "Item 4 (x): missing title",
      "Item 5: not an object",
    ]);
    expect(parseImportJson("{oops").errors).toEqual(["File is not valid JSON"]);
    expect(parseImportJson('{"todos": 3}').errors).toEqual(["Expected a list of todos"]);
  });

  it("merges by id or replaces", () => {
    const a2 = { ...a, title: "Buy oat milk" };
    const c = createTodo({ title: "New" });
    expect(applyImport([a, b], [a2, c], "merge")).toEqual([a2, b, c]);
    expect(applyImport([a, b], [c], "replace")).toEqual([c]);
  });
});
