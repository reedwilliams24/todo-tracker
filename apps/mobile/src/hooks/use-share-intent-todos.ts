import { useEffect } from "react";
import { useShareIntent } from "expo-share-intent";
import { draftsFromSharedText, type Todo, type TodoDraft } from "@todo/shared";

/** Turns text shared into the app (share sheet) into todos once the list has hydrated. */
export function useShareIntentTodos(
  hydrated: boolean,
  todos: readonly Todo[],
  addMany: (drafts: TodoDraft[]) => unknown,
) {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();

  useEffect(() => {
    if (!hydrated || !hasShareIntent) return;
    const texts = [shareIntent.meta?.title, shareIntent.text].filter(
      (value): value is string => typeof value === "string",
    );
    const drafts = draftsFromSharedText(texts, todos);
    if (drafts.length > 0) addMany(drafts);
    resetShareIntent();
  }, [hydrated, hasShareIntent, shareIntent, todos, addMany, resetShareIntent]);
}
