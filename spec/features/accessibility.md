# Accessibility

UI-only rules (no domain ops, so no fixture file). Web enforces them with axe in `apps/web/e2e/a11y.spec.ts`; iOS and Android are checked by hand with VoiceOver / TalkBack until they have automated checks.

## Rules

- **Contrast**: all text meets WCAG 2.1 AA (4.5:1) on its background. Secondary text (subtitle, due date, empty state, remaining count, delete `×`) uses the foreground at 70% opacity, never lower. Completed titles are struck through at 70% opacity.
- **Priority badges** use the darker tints on the 15% badge background: high `#B91C1C` (red-700), medium `#92400E` (amber-800), low `#047857` (emerald-700). Dark mode on web keeps the 400 tints.
- **Labels**: every control has an accessible name that includes the todo title where it acts on one:
  - checkbox `Mark "{title}" as complete` / `Mark "{title}" as active`
  - title button `Edit "{title}"`, with the hint "Opens the title for editing" where the platform supports hints
  - delete `Delete "{title}"`
  - inputs `Todo title`, `Due date`, `Priority`; the add button `Add todo` on native (web: `Add`)
  - filter group `Filter todos`
- **Live updates**: the remaining count is announced politely when it changes (`aria-live="polite"` / Compose `liveRegion = Polite` / VoiceOver announcement). The undo toast is also a polite live region.
- **Structure**: the app title is a heading. The list has the name `Todos` on web.
- **Focus (web)**: every interactive element shows a 2px foreground outline on `:focus-visible`; tab order follows the visual order (title → priority → due date → add).
