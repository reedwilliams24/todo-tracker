import { describe, expect, it } from "vitest";
import { dueReminders, planReminders, pruneDelivered, reminderAt } from "./reminders";
import { createTodo } from "./todos";

const now = new Date(2026, 4, 10, 8, 30); // local 08:30 on May 10

describe("reminders", () => {
  it("computes reminder instants from date-only due dates in local time", () => {
    const at = createTodo({ title: "a", dueDate: "2026-05-10", reminder: "at" });
    const hour = createTodo({ title: "b", dueDate: "2026-05-10", reminder: "1h" });
    const day = createTodo({ title: "c", dueDate: "2026-05-10", reminder: "1d" });
    expect(reminderAt(at)).toEqual(new Date(2026, 4, 10, 9, 0));
    expect(reminderAt(hour)).toEqual(new Date(2026, 4, 10, 8, 0));
    expect(reminderAt(day)).toEqual(new Date(2026, 4, 9, 9, 0));
    expect(reminderAt(createTodo({ title: "d", dueDate: "2026-05-10" }))).toBeUndefined();
    expect(reminderAt(createTodo({ title: "e", reminder: "at" }))).toBeUndefined();
  });

  it("plans only open todos with reminders and reports the ones that are due", () => {
    const hour = createTodo({ title: "Pay rent", dueDate: "2026-05-10", reminder: "1h" });
    const later = createTodo({ title: "Later", dueDate: "2026-05-10", reminder: "at" });
    const done = { ...createTodo({ title: "Done", dueDate: "2026-05-01", reminder: "at" }), completed: true };
    const plan = planReminders([hour, later, done]);
    expect(plan.map((r) => r.todoId)).toEqual([hour.id, later.id]);
    expect(plan[0]!.body).toBe("Due in 1 hour: Pay rent");

    const due = dueReminders([hour, later, done], new Set(), now);
    expect(due.map((r) => r.todoId)).toEqual([hour.id]);
    expect(dueReminders([hour, later], new Set([due[0]!.key]), now)).toEqual([]);
  });

  it("changes the key when the due date moves and prunes stale keys", () => {
    const todo = createTodo({ title: "x", dueDate: "2026-05-10", reminder: "at" });
    const [first] = planReminders([todo]);
    const moved = { ...todo, dueDate: "2026-05-11" };
    const [second] = planReminders([moved]);
    expect(second!.key).not.toBe(first!.key);
    expect(pruneDelivered(new Set([first!.key, second!.key]), [moved])).toEqual(new Set([second!.key]));
  });
});
