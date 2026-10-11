import { createTranslator, en, formatMessage, resolveLocale, type MessageKey } from "web/domain";
import type { Feature, Ops } from "../types";

export const feature: Feature = {
  feature: "localization",
  spec: "features/localization.md",
  status: { web: "pass", ios: "pass", android: "pass" },
  cases: [
    { name: "messages: the English catalog", op: "messages", given: {} },
    ...(
      [
        ["exact tag", ["en"], undefined],
        ["region falls back to its language", ["en-US"], undefined],
        ["first supported tag wins", ["fr-CA", "en-GB"], undefined],
        ["underscore separator", ["EN_us"], undefined],
        ["unsupported falls back to English", ["fr", "de-DE"], undefined],
        ["empty list falls back to English", [], undefined],
        ["blank tags are skipped", ["", "en"], undefined],
        ["exact match beats language match", ["pt-BR"], ["en", "pt", "pt-BR"]],
        ["language match against a regional catalog", ["pt-PT"], ["en", "pt-BR"]],
        ["matching is case-insensitive", ["DE"], ["en", "de"]],
      ] as const
    ).map(([label, preferred, supported]) => ({
      name: `resolveLocale: ${label}`,
      op: "resolveLocale",
      given: supported ? { preferred, supported } : { preferred },
    })),
    ...(
      [
        ["plain text", "Add", {}],
        ["named parameter", "Delete {title}", { title: "Buy milk" }],
        ["missing parameter stays literal", "Delete {title}", {}],
        ["number parameter", "Page {n}", { n: 3 }],
        ["plural one", "{count, plural, one {# task} other {# tasks}} remaining", { count: 1 }],
        ["plural other", "{count, plural, one {# task} other {# tasks}} remaining", { count: 2 }],
        ["plural zero is other in English", "{count, plural, one {# task} other {# tasks}} remaining", { count: 0 }],
        ["# uses grouping separators", "{count, plural, one {# task} other {# tasks}}", { count: 1234567 }],
        ["exact match beats category", "{count, plural, =0 {Nothing left} one {# left} other {# left}}", { count: 0 }],
        ["missing count is 0", "{count, plural, one {# todo} other {# todos}}", {}],
        ["string count", "{count, plural, one {# todo} other {# todos}}", { count: "1" }],
        ["missing branch falls back to other", "{count, plural, =5 {five} other {#}}", { count: 1 }],
        ["parameters inside a branch", "Added {count, plural, one {{first}} other {# todos}}", { count: 1, first: "Buy milk" }],
        ["two plurals", "{a, plural, one {# cat} other {# cats}} and {b, plural, one {# dog} other {# dogs}}", { a: 1, b: 3 }],
      ] as const
    ).map(([label, message, params]) => ({
      name: `formatMessage: ${label}`,
      op: "formatMessage",
      given: { locale: "en", message, params },
    })),
    ...(
      [
        ["list.remaining", { count: 0 }],
        ["list.remaining", { count: 1 }],
        ["list.remaining", { count: 2 }],
        ["list.emptyFiltered", { filter: "completed" }],
        ["item.delete", { title: "Buy milk" }],
        ["voice.added", { count: 1, first: "Buy milk" }],
        ["voice.added", { count: 3, first: "Buy milk" }],
        ["priority.high", {}],
      ] as const
    ).map(([key, params]) => ({
      name: `translate: ${key} ${JSON.stringify(params)}`,
      op: "translate",
      given: { locale: "en", key, params },
    })),
    {
      name: "translate: unsupported locale formats as English",
      op: "translate",
      given: { locale: "fr", key: "list.remaining", params: { count: 1 } },
    },
    { name: "translate: unknown key renders as the key", op: "translate", given: { locale: "en", key: "nope.missing", params: {} } },
  ],
};

export const ops: Ops = {
  messages: () => en,
  resolveLocale: (g) => resolveLocale(g.preferred, g.supported),
  formatMessage: (g) => formatMessage(g.locale, g.message, g.params),
  translate: (g) => createTranslator(g.locale)(g.key as MessageKey, g.params),
};
