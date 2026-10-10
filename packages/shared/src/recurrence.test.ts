import { describe, expect, it } from "vitest";
import { toggleInList } from "./list";
import { nextOccurrence, scheduleNext } from "./recurrence";
import { createTodo } from "./todos";

describe("nextOccurrence", () => {
  it("adds a day or a week across month and year boundaries", () => {
    expect(nextOccurrence("2026-01-31", "daily")).toBe("2026-02-01");
    expect(nextOccurrence("2026-12-31", "daily")).toBe("2027-01-01");
    expect(nextOccurrence("2026-02-26", "weekly")).toBe("2026-03-05");
  });

  it("clamps monthly to the end of shorter months", () => {
    expect(nextOccurrence("2026-01-31", "monthly")).toBe("2026-02-28");
    expect(nextOccurrence("2028-01-31", "monthly")).toBe("2028-02-29");
    expect(nextOccurrence("2026-03-31", "monthly")).toBe("2026-04-30");
    expect(nextOccurrence("2026-12-15", "monthly")).toBe("2027-01-15");
  });

  it("is unaffected by DST transitions", () => {
    expect(nextOccurrence("2026-03-07", "daily")).toBe("2026-03-08");
    expect(nextOccurrence("2026-10-31", "daily")).toBe("2026-11-01");
    expect(nextOccurrence("2026-03-01", "weekly")).toBe("2026-03-08");
  });
});

describe("recurring completion", () => {
  it("schedules the next occurrence when a recurring todo is completed", () => {
    const now = new Date("2026-05-10T12:00:00Z");
    const todo = createTodo({ title: "Water plants", recurrence: "weekly", dueDate: "2026-05-09" }, now);
    const other = createTodo({ title: "Other" }, now);
    const result = toggleInList([todo, other], todo.id, now);
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({ id: todo.id, completed: true });
    expect(result[1]).toMatchObject({
      title: "Water plants",
      recurrence: "weekly",
      dueDate: "2026-05-16",
      completed: false,
    });
    expect(result[1]!.id).not.toBe(todo.id);
    expect(result[2]).toBe(other);
  });

  it("does not schedule when un-completing or for non-recurring todos", () => {
    const now = new Date("2026-05-10T12:00:00Z");
    const done = { ...createTodo({ title: "Gym", recurrence: "daily" }, now), completed: true };
    expect(toggleInList([done], done.id, now)).toHaveLength(1);
    const plain = createTodo({ title: "Once" }, now);
    expect(toggleInList([plain], plain.id, now)).toHaveLength(1);
    expect(scheduleNext(plain)).toBeUndefined();
  });

  it("falls back to today when a recurring todo has no due date", () => {
    const now = new Date("2026-05-10T12:00:00Z");
    const todo = createTodo({ title: "Gym", recurrence: "daily" }, now);
    expect(scheduleNext(todo, now)?.dueDate).toBe("2026-05-11");
  });
});
