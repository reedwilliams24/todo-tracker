import { describe, expect, it } from "vitest";
import { addSubtask, removeSubtask, subtaskProgress, toggleSubtask } from "./subtasks";
import { createTodo } from "./todos";

describe("subtasks", () => {
  it("adds trimmed subtasks and reports progress", () => {
    let todo = createTodo({ title: "Trip" });
    expect(subtaskProgress(todo)).toEqual({ done: 0, total: 0 });
    todo = addSubtask(todo, "  Book flight ");
    todo = addSubtask(todo, "   ");
    expect(todo.subtasks?.map((s) => s.title)).toEqual(["Book flight"]);
    expect(subtaskProgress(todo)).toEqual({ done: 0, total: 1 });
  });

  it("completes the parent when the last subtask is done and reopens it when unchecked", () => {
    let todo = addSubtask(addSubtask(createTodo({ title: "Trip" }), "a"), "b");
    const [a, b] = todo.subtasks!;
    todo = toggleSubtask(todo, a!.id);
    expect(todo.completed).toBe(false);
    todo = toggleSubtask(todo, b!.id);
    expect(todo.completed).toBe(true);
    expect(subtaskProgress(todo)).toEqual({ done: 2, total: 2 });
    todo = toggleSubtask(todo, a!.id);
    expect(todo.completed).toBe(false);
  });

  it("can leave the parent alone and ignores unknown ids", () => {
    let todo = addSubtask(createTodo({ title: "Trip" }), "a");
    const same = toggleSubtask(todo, "nope");
    expect(same).toBe(todo);
    todo = toggleSubtask(todo, todo.subtasks![0]!.id, false);
    expect(todo.completed).toBe(false);
    expect(todo.subtasks![0]!.completed).toBe(true);
  });

  it("removes subtasks and drops the empty list", () => {
    let todo = addSubtask(createTodo({ title: "Trip" }), "a");
    const id = todo.subtasks![0]!.id;
    expect(removeSubtask(todo, "nope")).toBe(todo);
    todo = removeSubtask(todo, id);
    expect(todo.subtasks).toBeUndefined();
  });
});
