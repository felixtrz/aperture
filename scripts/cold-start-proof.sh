#!/usr/bin/env bash
# AF-6 (readiness roadmap R4.1): the cold-start proof. Scaffolds a fresh app
# from the workspace-linked CLI in a temp directory, installs, typechecks,
# builds, starts a headless managed dev session, drives the MCP browser/ECS
# tools, and tears down — exactly what test/e2e/cli-ai-tools.spec.ts
# ("aperture create produces an installable app...") gates in CI via the
# sharded e2e matrix.
#
# Requires: pnpm, Google Chrome via `pnpm exec playwright install chrome`,
# the chromium headless shell via `pnpm exec playwright install chromium`
# (used by `aperture dev up --headless`), and xvfb on Linux.
set -euo pipefail
cd "$(dirname "$0")/.."

pnpm run build

RUNNER=(pnpm exec playwright test --config=playwright.ci.config.ts
  test/e2e/cli-ai-tools.spec.ts
  --grep "aperture create produces an installable app")

if command -v xvfb-run >/dev/null 2>&1; then
  CI=true xvfb-run -a "${RUNNER[@]}"
else
  CI=true "${RUNNER[@]}"
fi

echo "Cold-start proof passed: create → install → build → dev up → MCP tools → down."
