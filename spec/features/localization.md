# Localized UI copy

Fixtures: [`../fixtures/localization.json`](../fixtures/localization.json). Catalog: [`../i18n/en.json`](../i18n/en.json).

Every user-visible string (titles, labels, placeholders, accessibility labels, empty states, counts, undo/voice copy) comes from a message catalog keyed like `list.remaining`. Components never hard-code copy. Only English ships today; other languages and RTL are out of scope (REED-24).

## Rules

- **Catalog** (`messages`): `spec/i18n/en.json` is the source of truth. `pnpm spec:generate` writes it to `apps/web/src/domain/i18n/en.ts`, `apps/android/core/.../Messages.kt` and `apps/ios/TodoCore/Sources/TodoCore/Messages.swift`; `pnpm spec:check` fails if they drift. Keys starting with `$` are comments.
- **Locale resolution** (`resolveLocale(preferred, supported = catalog locales)`): walk the user's preferred BCP 47 tags in order (web: `navigator.languages`; iOS: `Locale.preferredLanguages`; Android: the configuration's locale list). Skip blank tags. A case-insensitive exact match wins; otherwise match on the language subtag (split on `-` or `_`). The first preferred tag that matches anything wins. Nothing matches → `en`.
- **Interpolation** (`formatMessage`): `{name}` is replaced by the parameter's string form; an unknown `{name}` stays literal.
- **Plurals**: `{name, plural, =N {…} one {…} other {…}}`. An exact `=N` branch beats the plural category; a missing category falls back to `other`. Branches may contain `{params}` and nested braces. `#` inside a branch is the count formatted with the locale's grouping (`1,234,567` in English). A missing count is `0`; a numeric string is parsed. English categories: `one` when the count is exactly 1, otherwise `other`.
- **Translate** (`translate(locale, key, params)`): look up `key` in the locale's catalog, falling back to English; an unknown key renders as the key itself. An unsupported locale formats as English.
- Test IDs (`spec/test-ids.json`) never change with the locale, so selectors keep working in every language.
