#!/usr/bin/env bash
# Runs Apple's swift-format (`swift format`, bundled with the Swift 6 toolchain) over the iOS sources.
# Usage: scripts/swift-format.sh format --in-place | scripts/swift-format.sh lint --strict
set -euo pipefail
cd "$(dirname "$0")/../apps/ios"
mode=$1
shift
exec swift format "$mode" "$@" --parallel --recursive \
  TodoCore/Package.swift TodoCore/Sources TodoCore/Tests TodoTracker TodoTrackerUITests
