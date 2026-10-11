import { OPS } from "./features";
import type { Given } from "./types";

export { OPS };

const NEW_ID = /^new-\d+$/;

function collectIds(value: unknown, into: Set<string>) {
  if (Array.isArray(value)) value.forEach((item) => collectIds(item, into));
  else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (key === "id" && typeof child === "string") into.add(child);
      else collectIds(child, into);
    }
  }
}

/**
 * Makes an op result comparable across languages: drops undefined/null-valued
 * object keys (JSON round-trip) and renames ids that did not exist in `given`
 * to new-1, new-2, … in order of first appearance.
 */
export function normalize(given: Given, result: unknown): unknown {
  const known = new Set<string>();
  collectIds(given, known);
  const renamed = new Map<string, string>();
  const json = JSON.stringify(result ?? null, (key, value) => {
    if (key === "id" && typeof value === "string" && !known.has(value) && !NEW_ID.test(value)) {
      if (!renamed.has(value)) renamed.set(value, `new-${renamed.size + 1}`);
      return renamed.get(value);
    }
    return value;
  });
  return JSON.parse(json);
}

export function runOp(op: string, given: Given): unknown {
  const impl = OPS[op];
  if (!impl) throw new Error(`Unknown op "${op}"`);
  return normalize(given, impl(structuredClone(given)));
}
