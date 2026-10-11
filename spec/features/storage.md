# Storage

Fixtures: [`../fixtures/storage.json`](../fixtures/storage.json). Shape: [`../schema/storage.schema.json`](../schema/storage.schema.json).

## Rules

- Key `todo-tracker:todos:v1`. Value: JSON array of todos in storage order (newest first).
- Missing, empty, corrupt or non-array values load as an empty list. They never crash the app.
- Clients load once at startup and save after every change once loaded.
- Sort preference: key `todo-tracker:sort:v1`, value `priority` or `manual` (`parseStoredSort`). Missing or unknown values load as `priority`. Web uses localStorage, Android SharedPreferences, iOS UserDefaults.
