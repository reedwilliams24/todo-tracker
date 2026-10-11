import { advanceCursor, applyRemote, planPush, rollbackPush, type Todo, type TodoRow } from "../domain";

/** Rows per pull request (spec/server.md#pull). */
export const PULL_PAGE_SIZE = 500;

/** The backend calls sync needs (spec/server.md). */
export interface SyncServer {
  push(rows: TodoRow[]): Promise<TodoRow[]>;
  /** Rows with `server_seq > cursor`, ordered by `server_seq`, at most `limit`. */
  pull(cursor: number, limit: number): Promise<TodoRow[]>;
}

export interface CursorStore {
  load(): number;
  save(cursor: number): void;
}

/** The list the engine keeps in step: read the current todos, replace them without a new push. */
export interface TodoListHost {
  current(): Todo[];
  replace(todos: Todo[]): void;
}

/**
 * Keeps a signed-in list in step with the server (spec/features/sync.md). `edit` pushes each local change and
 * rolls it back if the push fails; `pull` and `applyRemote` bring in other devices' changes (REED-70 feeds
 * Realtime rows to `applyRemote`).
 */
export class SyncEngine {
  private readonly inFlight = new Map<number, Todo[]>();
  private readonly tombstoned = new Set<string>();
  private nextPush = 0;
  private pulling: Promise<void> | null = null;
  private pullAgain = false;
  private closed = false;

  constructor(
    private readonly server: SyncServer,
    private readonly userId: string,
    private readonly cursor: CursorStore,
    private readonly list: TodoListHost,
    private readonly onPushFailed: () => void,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** A local edit from `before` to `after` (already shown): shows the planned list and pushes it. */
  async edit(before: Todo[], after: Todo[]): Promise<void> {
    const plan = planPush(before, after, [...this.tombstoned], this.userId, this.now());
    if (plan.todos.some((todo, i) => todo !== after[i])) this.list.replace(plan.todos);
    if (plan.rows.length === 0) return;
    const ids = plan.rows.map((row) => row.id);
    const key = this.nextPush++;
    this.inFlight.set(
      key,
      plan.todos.filter((todo) => ids.includes(todo.id)),
    );
    try {
      const stored = await this.server.push(plan.rows);
      this.inFlight.delete(key);
      if (this.closed) return;
      for (const row of plan.rows) if (row.deleted_at !== null) this.tombstoned.add(row.id);
      this.list.replace(applyRemote(this.list.current(), this.pending(), stored, 0));
    } catch {
      this.inFlight.delete(key);
      if (this.closed) return;
      this.list.replace(rollbackPush(this.list.current(), before, ids));
      this.onPushFailed();
    }
  }

  /** Pulls every row past the cursor, a page at a time. Concurrent calls share one run (and repeat it once). */
  pull(): Promise<void> {
    if (this.pulling) {
      this.pullAgain = true;
      return this.pulling;
    }
    this.pulling = (async () => {
      try {
        do {
          this.pullAgain = false;
          await this.pullPages();
        } while (this.pullAgain && !this.closed);
      } finally {
        this.pulling = null;
      }
    })();
    return this.pulling;
  }

  /** Applies pulled or Realtime rows and advances the stored cursor. */
  applyRemote(rows: readonly TodoRow[]): void {
    if (this.closed || rows.length === 0) return;
    const cursor = this.cursor.load();
    this.list.replace(applyRemote(this.list.current(), this.pending(), rows, cursor));
    this.cursor.save(advanceCursor(cursor, rows));
  }

  /** Stops applying results (sign out, unmount). */
  close(): void {
    this.closed = true;
  }

  private async pullPages() {
    for (;;) {
      if (this.closed) return;
      const rows = await this.server.pull(this.cursor.load(), PULL_PAGE_SIZE);
      this.applyRemote(rows);
      if (rows.length < PULL_PAGE_SIZE) return;
    }
  }

  private pending(): Todo[] {
    return [...this.inFlight.values()].flat();
  }
}
