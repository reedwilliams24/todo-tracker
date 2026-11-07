#!/usr/bin/env bash
# Usage: pnpm devices:run -- <command>
set -u

[ "${1:-}" = "--" ] && shift
if [ "$#" -eq 0 ]; then
  echo "Usage: pnpm devices:run -- <command>" >&2
  exit 2
fi

DEVICE_NAME="${TODO_DEVICE_NAME:-todo-tracker-e2e}"
QUEUE_DIR="${TODO_DEVICE_QUEUE_DIR:-$HOME/.cache/todo-tracker/device-queue}"
POLL_SECONDS="${TODO_DEVICE_QUEUE_POLL:-3}"

mkdir -p "$QUEUE_DIR"
ticket="$QUEUE_DIR/$(date +%s)-$$"
echo "$*" >"$ticket"
trap 'rm -f "$ticket"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

remove_dead_tickets() {
  for file in "$QUEUE_DIR"/*; do
    [ -e "$file" ] || continue
    pid="${file##*-}"
    kill -0 "$pid" 2>/dev/null || rm -f "$file"
  done
}

last_status=""
while :; do
  remove_dead_tickets
  first=$(ls "$QUEUE_DIR" | sort -n | head -1)
  [ "$first" = "$(basename "$ticket")" ] && break
  ahead=$(ls "$QUEUE_DIR" | sort -n | grep -n "^$(basename "$ticket")$" | cut -d: -f1)
  status="Waiting for local devices: $((ahead - 1)) ahead, running: $(cat "$QUEUE_DIR/$first" 2>/dev/null)"
  if [ "$status" != "$last_status" ]; then
    echo "$status" >&2
    last_status="$status"
  fi
  sleep "$POLL_SECONDS"
done

export TODO_IOS_UDID
TODO_IOS_UDID=$(xcrun simctl list devices available -j 2>/dev/null | node -e '
  const name = process.argv[1];
  const { devices } = JSON.parse(require("fs").readFileSync(0, "utf8"));
  const match = Object.values(devices).flat().find((device) => device.name === name);
  console.log(match ? match.udid : "");
' "$DEVICE_NAME" 2>/dev/null)

export TODO_ANDROID_SERIAL=""
for serial in $(adb devices 2>/dev/null | awk '/^emulator-[0-9]+\tdevice/{print $1}'); do
  if [ "$(adb -s "$serial" emu avd name 2>/dev/null | head -1 | tr -d '\r')" = "$DEVICE_NAME" ]; then
    TODO_ANDROID_SERIAL="$serial"
    break
  fi
done

"$@" &
child=$!
# Must stop the command too, or it keeps using the device after the queue moves on.
trap 'kill "$child" 2>/dev/null; exit 130' INT
trap 'kill "$child" 2>/dev/null; exit 143' TERM
wait "$child"
