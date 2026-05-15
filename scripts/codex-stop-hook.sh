#!/usr/bin/env bash
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

LOG_DIR="agent/logs"
RUN_ID="$(date -u +"%Y%m%dT%H%M%SZ")"
LOG_FILE="$LOG_DIR/stop-hook-$RUN_ID.log"

mkdir -p "$LOG_DIR"

exec > >(tee -a "$LOG_FILE") 2>&1

failures=0

fail() {
  echo "ERROR: $*"
  failures=$((failures + 1))
}

run_if_script_exists() {
  local script_name="$1"

  if node -e "const scripts = require('./package.json').scripts || {}; process.exit(Object.hasOwn(scripts, process.argv[1]) ? 0 : 1)" "$script_name"; then
    echo "Running npm script: $script_name"
    if ! npm run "$script_name"; then
      fail "npm run $script_name failed"
    fi
  else
    echo "Skipping npm script: $script_name is not defined"
  fi
}

echo "Aperture stop hook started at $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "Repository: $ROOT"
echo "Log file: $LOG_FILE"

required_files=(
  "AGENTS.md"
  "docs/NORTH_STAR.md"
  "docs/ROADMAP.md"
  "docs/ARCHITECTURE.md"
  "docs/DECISIONS.md"
  "agent/BACKLOG.md"
  "agent/HANDOFF.md"
  "agent/COMPLETED.md"
  "agent/STATUS.json"
  "agent/STOP_CONDITIONS.md"
)

for file in "${required_files[@]}"; do
  if [[ ! -f "$file" ]]; then
    fail "required file is missing: $file"
  fi
done

if ! node <<'NODE'; then
const fs = require("node:fs");

const statusPath = "agent/STATUS.json";
const status = JSON.parse(fs.readFileSync(statusPath, "utf8"));

if (status.state === "running") {
  throw new Error(`${statusPath} is still in running state`);
}

if (status.activePid !== null) {
  throw new Error(`${statusPath} still has activePid=${status.activePid}`);
}

console.log(`Agent status: ${status.state}; lastResult: ${status.lastResult}`);
NODE
  fail "agent/STATUS.json is invalid or not finalized"
fi

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Git branch: $(git branch --show-current)"
  echo "Git status:"
  git status --short
else
  fail "repository is not initialized as a Git worktree"
fi

if [[ -f package.json ]]; then
  run_if_script_exists build
  run_if_script_exists test
  run_if_script_exists lint
  run_if_script_exists format:check
else
  fail "package.json is missing"
fi

if ((failures > 0)); then
  echo "Aperture stop hook failed with $failures issue(s)."
  exit 1
fi

echo "Aperture stop hook completed successfully."
