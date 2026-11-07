#!/usr/bin/env bash
# Usage: pnpm devices:setup [--check] [--boot]
set -u

DEVICE_NAME="${TODO_DEVICE_NAME:-todo-tracker-e2e}"
ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
CHECK_ONLY=false
BOOT=false
missing=0

for arg in "$@"; do
  case "$arg" in
    --) ;;
    --check) CHECK_ONLY=true ;;
    --boot) BOOT=true ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 2
      ;;
  esac
done

ok() { echo "  ok    $1"; }
warn() { echo "  warn  $1"; }
fail() {
  echo "  MISSING  $1"
  missing=$((missing + 1))
}

require() {
  if command -v "$1" >/dev/null 2>&1; then ok "$1"; else fail "$1 ($2)"; fi
}

echo "Tools"
require pnpm "corepack enable"
require gh "brew install gh"
require maestro "curl -fsSL https://get.maestro.mobile.dev | bash"
require java "brew install openjdk@17"
require adb "Android SDK platform-tools"
require emulator "Android SDK emulator"
require avdmanager "Android SDK cmdline-tools"
require xcodebuild "install Xcode"
require xcrun "install Xcode"
require xcodegen "brew install xcodegen"
if command -v swiftlint >/dev/null 2>&1; then ok swiftlint; else warn "swiftlint not installed; pnpm lint:ios won't run, CI still covers it (brew install swiftlint)"; fi

echo "GitHub"
scopes=$(gh auth status -h github.com 2>&1 | grep -i 'token scopes' || true)
if [ -z "$scopes" ]; then
  warn "not signed in to github.com (gh auth login -h github.com)"
elif echo "$scopes" | grep -q workflow; then
  ok "token can edit workflows"
else
  warn "token can't edit .github/workflows (gh auth refresh -h github.com -s workflow)"
fi

echo "Playwright"
chromium=$(pnpm --silent --filter web exec node -e 'import("@playwright/test").then(({ chromium }) => console.log(chromium.executablePath()))' 2>/dev/null | tail -1)
if [ -n "$chromium" ] && [ -e "$chromium" ]; then
  ok "Chromium installed"
else
  warn "Chromium not installed (pnpm --filter web exec playwright install chromium)"
fi

echo "Ports"
port=3100
while lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; do port=$((port + 1)); done
ok "free web port: $port"
if lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
  warn "port 3000 is taken, and pnpm --filter web e2e would test whatever server is using it"
fi

if [ "$missing" -gt 0 ]; then
  echo "$missing required tool(s) missing."
  exit 1
fi

if [ "$CHECK_ONLY" = true ]; then exit 0; fi

echo "Dependencies"
if pnpm install --frozen-lockfile >/dev/null 2>&1; then ok "pnpm install"; else warn "pnpm install failed; run it to see why"; fi

echo "Android"
if emulator -list-avds 2>/dev/null | grep -qx "$DEVICE_NAME"; then
  ok "AVD $DEVICE_NAME exists"
else
  abi=$([ "$(uname -m)" = arm64 ] && echo arm64-v8a || echo x86_64)
  image_dir=$(ls -d "$ANDROID_HOME"/system-images/android-*/google_apis/"$abi" 2>/dev/null | sort -V | tail -1)
  if [ -z "$image_dir" ]; then
    echo "  No google_apis $abi system image. Install one: sdkmanager \"system-images;android-36;google_apis;$abi\""
    exit 1
  fi
  package="system-images;$(echo "$image_dir" | sed -E 's|.*/system-images/||; s|/|;|g')"
  if echo no | avdmanager create avd -n "$DEVICE_NAME" -k "$package" -d pixel_6 >/dev/null 2>&1; then
    ok "created AVD $DEVICE_NAME ($package)"
  else
    echo "  Couldn't create AVD $DEVICE_NAME"
    exit 1
  fi
fi

echo "iOS"
sim_id() {
  xcrun simctl list devices available -j | node -e '
    const name = process.argv[1];
    const { devices } = JSON.parse(require("fs").readFileSync(0, "utf8"));
    const match = Object.values(devices).flat().find((device) => device.name === name);
    console.log(match ? match.udid : "");
  ' "$DEVICE_NAME"
}
udid=$(sim_id)
if [ -n "$udid" ]; then
  ok "simulator $DEVICE_NAME exists ($udid)"
else
  picked=$(node -e '
    const { execSync } = require("child_process");
    const list = (kind) => JSON.parse(execSync(`xcrun simctl list ${kind} -j`, { encoding: "utf8" }))[kind];
    const runtime = list("runtimes").filter((r) => r.isAvailable && r.name.startsWith("iOS")).at(-1);
    const iphones = runtime ? (runtime.supportedDeviceTypes ?? []).filter((t) => t.name.startsWith("iPhone")) : [];
    const type = iphones.filter((t) => t.name.endsWith(" Pro")).at(-1) ?? iphones.at(-1);
    if (type) console.log(`${type.identifier} ${runtime.identifier}`);
  ')
  if [ -z "$picked" ]; then
    echo "  No iOS runtime with an iPhone found. Install one in Xcode > Settings > Components."
    exit 1
  fi
  # shellcheck disable=SC2086
  udid=$(xcrun simctl create "$DEVICE_NAME" $picked)
  ok "created simulator $DEVICE_NAME ($udid)"
fi

if [ "$BOOT" = true ]; then
  echo "Booting"
  xcrun simctl boot "$udid" 2>/dev/null || true
  xcrun simctl bootstatus "$udid" -b >/dev/null 2>&1
  ok "simulator booted"
  if ! pgrep -f "qemu-system.*-avd $DEVICE_NAME( |$)" >/dev/null; then
    nohup emulator -avd "$DEVICE_NAME" -no-boot-anim >/dev/null 2>&1 &
  fi
  ok "emulator starting; pnpm devices:run sets TODO_ANDROID_SERIAL once it's connected"
fi

echo "Ready. Run device work with: pnpm devices:run -- <command>"
