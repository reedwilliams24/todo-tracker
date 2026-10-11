# Theme

Fixtures: [`../fixtures/theme.json`](../fixtures/theme.json).

## Rules

- Preferences, in display order: `light`, `dark`, `system`. Labels: `Light`, `Dark`, `System`.
- The default preference is `system`.
- `system` follows the OS appearance (dark when the OS is dark, light otherwise). `light` and `dark` ignore the OS.
- Key `todo-tracker:theme:v1`. Value: the preference string. Missing, empty, unknown or differently cased values load as `system`. They never crash the app.
- Clients save the preference as soon as the user picks one and apply it before the first frame where the platform allows (web reads it in an inline script before hydration).
- Cycling goes `light` → `dark` → `system` → `light`.
- UI: a three-option control (`themeToggle`, one `themeOption` per preference) in the header. The selected option reports itself as selected to accessibility (`aria-checked` on web, `.isSelected` on iOS, selected tab on Android).
- Every surface (background, cards, text, borders, priority badges, undo toast) switches palette; nothing stays light in dark mode.
