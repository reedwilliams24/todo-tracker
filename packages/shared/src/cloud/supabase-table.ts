import type { TodoRow, TodoTable } from "./index";

/** Shape of a PostgREST response; shared has no SDK dependency. */
export type QueryResult<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>;

/** The three queries an app wires to its Supabase client (see the `lib/supabase` file in each app). */
export type TodoQueries = {
  list(userId: string): QueryResult<TodoRow[]>;
  upsert(rows: TodoRow[]): QueryResult<unknown>;
  remove(userId: string, ids: string[]): QueryResult<unknown>;
};

/** Supabase `Database` generic matching supabase/migrations. */
export type Database = {
  public: {
    Tables: {
      todos: {
        Row: TodoRow;
        Insert: TodoRow;
        Update: Partial<TodoRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

async function unwrap<T>(result: QueryResult<T>): Promise<T | null> {
  const { data, error } = await result;
  if (error) throw new Error(error.message);
  return data;
}

export function supabaseTodoTable(queries: TodoQueries): TodoTable {
  return {
    list: async (userId) => (await unwrap(queries.list(userId))) ?? [],
    upsert: async (rows) => void (await unwrap(queries.upsert(rows))),
    remove: async (userId, ids) => void (await unwrap(queries.remove(userId, ids))),
  };
}
