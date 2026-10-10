# Todo Tracker for Android

A native Kotlin / Jetpack Compose app that replaces the Expo app on Android (REED-27). Package: `com.reedwilliams24.todotracker`, min SDK 26.

- `core/`: the domain logic ported from `packages/shared`, as a pure JVM module. `FixtureTest` runs every case in `spec/fixtures` and fails on unknown ops. `TestIdsTest` checks `TestIds` against `spec/test-ids.json`.
- `app/`: Compose UI, `TodoViewModel` (drives `reduceTodos` and the 5 s undo timer), and Room storage. One row per todo, with `position` keeping storage order.

```bash
./gradlew :core:test              # conformance fixtures
./gradlew :app:assembleDebug      # app/build/outputs/apk/debug/app-debug.apk
adb install -r app/build/outputs/apk/debug/app-debug.apk
maestro test --include-tags spec -e APP_ID=com.reedwilliams24.todotracker ../../spec/scenarios/maestro
```

UI selectors are Compose `testTag`s, exposed as resource IDs (`testTagsAsResourceId`) so Maestro can find them.
