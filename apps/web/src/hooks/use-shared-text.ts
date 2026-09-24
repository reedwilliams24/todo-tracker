"use client";

import { useEffect } from "react";
import {
  draftsFromSharedText,
  sharedTextFromQuery,
  stripShareParams,
  type Todo,
  type TodoDraft,
} from "@todo/shared";

/** Adds todos from `?add=` / `?text=` once the list has hydrated, then cleans the URL. */
export function useSharedText(
  hydrated: boolean,
  todos: readonly Todo[],
  addMany: (drafts: TodoDraft[]) => unknown,
) {
  useEffect(() => {
    if (!hydrated) return;
    const texts = sharedTextFromQuery(window.location.search);
    if (texts.length === 0) return;
    const drafts = draftsFromSharedText(texts, todos);
    if (drafts.length > 0) addMany(drafts);
    const url = `${window.location.pathname}${stripShareParams(window.location.search)}${window.location.hash}`;
    window.history.replaceState(null, "", url);
  }, [hydrated, todos, addMany]);
}
