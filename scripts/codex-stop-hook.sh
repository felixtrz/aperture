#!/usr/bin/env bash
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

LOG_DIR="agent/logs"
RUN_ID="$(date -u +"%Y%m%dT%H%M%SZ")"
LOG_FILE="$LOG_DIR/stop-hook-$RUN_ID.log"

mkdir -p "$LOG_DIR"

# Stop hooks must write valid JSON to stdout. Keep the original stdout on fd 3
# and send all human-readable diagnostics to the log file.
exec 3>&1
exec >>"$LOG_FILE" 2>&1

failures=0

emit_success() {
  printf '{"continue":true}\n' >&3
}

emit_continue_request() {
  local reason="$1"
  node -e 'console.log(JSON.stringify({ decision: "block", reason: process.argv[1] }))' "$reason" >&3
}

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

commit_all_changes() {
  local status_before_commit
  status_before_commit="$(git status --short --untracked-files=all)"

  if [[ -z "$status_before_commit" ]]; then
    echo "No changes to checkpoint; working tree is already clean."
    return
  fi

  echo "Checkpointing all repository changes:"
  printf '%s\n' "$status_before_commit"

  if ! git add -A; then
    fail "git add -A failed"
    return
  fi

  if git diff --cached --quiet; then
    echo "No staged changes after git add -A; nothing to commit."
    return
  fi

  local timestamp
  timestamp="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

  if ! git commit \
    -m "chore: checkpoint automation changes" \
    -m "Automated stop-hook checkpoint at $timestamp."; then
    fail "git commit failed"
    return
  fi

  echo "Created checkpoint commit: $(git rev-parse --short HEAD)"

  local status_after_commit
  status_after_commit="$(git status --short --untracked-files=all)"

  if [[ -n "$status_after_commit" ]]; then
    echo "Working tree after checkpoint:"
    printf '%s\n' "$status_after_commit"
    fail "working tree is still dirty after checkpoint commit"
    return
  fi

  echo "Working tree is clean after checkpoint commit."
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

if (status.lastRunStartedAt) {
  const startedAt = Date.parse(status.lastRunStartedAt);
  const finishedAt = status.lastRunFinishedAt ? Date.parse(status.lastRunFinishedAt) : Date.now();

  if (!Number.isNaN(startedAt) && !Number.isNaN(finishedAt)) {
    const elapsedMs = Math.max(0, finishedAt - startedAt);
    const elapsedMinutes = elapsedMs / 60000;
    console.log(`Recorded run elapsed time: ${elapsedMinutes.toFixed(1)} minute(s)`);

    if (status.lastResult === "success" && elapsedMs < 45 * 60000) {
      throw new Error(`recorded successful run finished after ${elapsedMinutes.toFixed(1)} minute(s), below the 45-minute minimum`);
    }
  }
}
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
  emit_continue_request "Aperture stop hook found $failures issue(s). Read $LOG_FILE, fix straightforward failures, and update the handoff before stopping."
  exit 0
fi

commit_all_changes

if ((failures > 0)); then
  echo "Aperture stop hook failed with $failures issue(s)."
  emit_continue_request "Aperture stop hook found $failures issue(s). Read $LOG_FILE, fix straightforward failures, and update the handoff before stopping."
  exit 0
fi

echo "Aperture stop hook completed successfully."
emit_success
