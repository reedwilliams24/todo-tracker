import { useCallback, useEffect, useState } from "react";
import { parseStoredSort, type MaybePromise } from "../storage";
import type { TodoSort } from "../todos";

/** Platform storage for a single string preference (localStorage on web, AsyncStorage on mobile). */
export type PreferenceStorage = {
  load(): MaybePromise<string | null>;
  save(value: string): MaybePromise<void>;
};

/** Persisted sort preference. `storage` should be a stable reference. */
export function useSort(storage: PreferenceStorage) {
  const [sort, setSortState] = useState<TodoSort>("priority");

  useEffect(() => {
    let cancelled = false;
    Promise.resolve(storage.load()).then((raw) => {
      if (!cancelled) setSortState(parseStoredSort(raw));
    });
    return () => {
      cancelled = true;
    };
  }, [storage]);

  const setSort = useCallback(
    (next: TodoSort) => {
      setSortState(next);
      void storage.save(next);
    },
    [storage],
  );

  return [sort, setSort] as const;
}
