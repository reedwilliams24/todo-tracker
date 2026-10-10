# Todo Tracker for iOS

Native SwiftUI app (iOS 18+, bundle id `com.reedwilliams24.todotracker`). It replaces the Expo app in `apps/mobile` on iOS (REED-27).

- `TodoCore/`: a Swift package with the domain logic (todos, list ops, undo reducer, storage format, voice parser), ported from `packages/shared`. No UI or persistence.
- `TodoTracker/`: the SwiftUI app. `TodoViewModel` drives the `reduceTodos` reducer and schedules undo expiry. `SwiftDataTodoStore` persists the list with SwiftData.
- `TodoTrackerUITests/`: an XCUITest smoke test (add, complete, undo, delete).

`project.yml` is the source of truth for the Xcode project. `TodoTracker.xcodeproj` is generated and git-ignored.

## Run

```bash
brew install xcodegen
cd apps/ios
(cd TodoCore && swift test)   # shared spec/fixtures, one XCTContext activity per case
xcodegen generate
open TodoTracker.xcodeproj    # run the TodoTracker scheme on a Simulator
```

From the command line (no signing needed for the Simulator):

```bash
xcodebuild build test -project TodoTracker.xcodeproj -scheme TodoTracker \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -derivedDataPath build CODE_SIGNING_ALLOWED=NO
```

## UI scenarios

Install the build on a booted Simulator, then run the generated Maestro flows from the repo root:

```bash
xcrun simctl install booted apps/ios/build/Build/Products/Debug-iphonesimulator/TodoTracker.app
maestro test --include-tags spec -e APP_ID=com.reedwilliams24.todotracker spec/scenarios/maestro
```

Views set `accessibilityIdentifier` to the IDs in `spec/test-ids.json` (see `TestIDs.swift`). The checkbox is a `Toggle` that reports `1`/`0` as its accessibility value, which Maestro's `checked:` reads.
