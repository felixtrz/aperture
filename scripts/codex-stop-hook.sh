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
failure_messages=()

emit_success() {
  printf '{"continue":true}\n' >&3
}

emit_continue_request() {
  local reason="$1"
  node -e 'console.log(JSON.stringify({ decision: "block", reason: process.argv[1] }))' "$reason" >&3
}

emit_failure_request() {
  local details=""

  for message in "${failure_messages[@]}"; do
    if [[ -n "$details" ]]; then
      details="$details; $message"
    else
      details="$message"
    fi
  done

  if [[ -n "$details" ]]; then
    emit_continue_request "Aperture stop hook found $failures issue(s): $details. Read $LOG_FILE, fix straightforward failures, and update the handoff before stopping."
  else
    emit_continue_request "Aperture stop hook found $failures issue(s). Read $LOG_FILE, fix straightforward failures, and update the handoff before stopping."
  fi
}

fail() {
  local message="$*"

  echo "ERROR: $message"
  failure_messages+=("$message")
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
    echo "No remaining changes to checkpoint; working tree is already clean."
    return
  fi

  echo "Checkpointing remaining uncommitted repository changes:"
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

push_current_branch() {
  local branch
  branch="$(git branch --show-current)"

  if [[ -z "$branch" ]]; then
    fail "cannot auto-push from detached HEAD"
    return
  fi

  local upstream
  if ! upstream="$(git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null)"; then
    fail "current branch '$branch' has no upstream; configure it before relying on auto-push"
    return
  fi

  echo "Pushing current branch '$branch' to upstream '$upstream'."

  if ! git push; then
    fail "git push failed"
    return
  fi

  echo "Push completed successfully."
  git status --short --branch
}

echo "Aperture stop hook started at $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "Repository: $ROOT"
echo "Log file: $LOG_FILE"

echo "Stop gate: current minute must be >= 50 when ready tasks remain."

stop_gate_result="$(node scripts/stop-gate.mjs)"
stop_gate_status=$?

if [[ -n "$stop_gate_result" ]]; then
  stop_gate_summary="$(node -e '
const gate = JSON.parse(process.argv[1]);
if (gate.status === "ok" || gate.status === "blocked") {
  console.log(`minute=${gate.currentMinute} requiredMinute=${gate.stopMinute} readyTasks=${gate.readyTaskCount}`);
} else {
  console.log(`${gate.status}: ${gate.reason}`);
}
' "$stop_gate_result")"
  echo "Stop gate: $stop_gate_summary"
fi

if ((stop_gate_status == 2)); then
  echo "Blocking stop attempt before the minute-50 gate opens."
  stop_gate_block_reason="$(node -e '
const gate = JSON.parse(process.argv[1]);
console.log(`Stop gate not open: current minute ${gate.currentMinute} is before minute ${gate.stopMinute} of this hour, and ${gate.readyTaskCount} ready task(s) remain. Continue active repository work on the next coherent ready task; do not wait, sleep, poll, or idle.`);
' "$stop_gate_result")"
  emit_continue_request "$stop_gate_block_reason"
  exit 0
elif ((stop_gate_status != 0)); then
  fail "stop gate minute check failed"
fi

required_files=(
  "AGENTS.md"
  "docs/NORTH_STAR.md"
  "docs/ROADMAP.md"
  "docs/MEDIUM_LONG_TERM_GOALS.md"
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

if ! status_check_output="$(node <<'NODE'
const fs = require("node:fs");

const statusPath = "agent/STATUS.json";
const status = JSON.parse(fs.readFileSync(statusPath, "utf8"));
const readyTaskCount = countReadyTasks("agent/BACKLOG.md");
const finalResults = new Set(["success", "failure", "blocked", "stop-condition"]);
const maxFinalizedStatusAgeMinutes = Number(
  process.env.STOP_HOOK_FINALIZED_STATUS_MAX_AGE_MINUTES ?? 30,
);
const problems = [];

if (status.state === "running") {
  problems.push(`${statusPath} state is "running"; expected "idle" before stopping`);
} else if (status.state !== "idle") {
  problems.push(`${statusPath} state is "${status.state}"; expected "idle" before stopping`);
}

if (status.activePid !== null) {
  problems.push(`${statusPath} activePid is ${status.activePid}; expected null`);
}

if (
  status.currentRunStartedAt !== null &&
  status.currentRunStartedAt !== undefined
) {
  problems.push(
    `${statusPath} currentRunStartedAt is ${status.currentRunStartedAt}; expected null`,
  );
}

if (status.currentTaskId !== null && status.currentTaskId !== undefined) {
  problems.push(
    `${statusPath} currentTaskId is ${status.currentTaskId}; expected null`,
  );
}

if (!finalResults.has(status.lastResult)) {
  problems.push(
    `${statusPath} lastResult is ${status.lastResult}; expected a finalized result`,
  );
}

const lastRunFinishedMs = Date.parse(status.lastRunFinishedAt ?? "");

if (!Number.isFinite(maxFinalizedStatusAgeMinutes)) {
  problems.push("STOP_HOOK_FINALIZED_STATUS_MAX_AGE_MINUTES is invalid");
} else if (!Number.isFinite(lastRunFinishedMs)) {
  problems.push(
    `${statusPath} lastRunFinishedAt is ${status.lastRunFinishedAt}; expected a valid finalizer timestamp`,
  );
} else {
  const finalizedAgeMinutes = (Date.now() - lastRunFinishedMs) / 60000;

  if (
    finalizedAgeMinutes < -1 ||
    finalizedAgeMinutes > maxFinalizedStatusAgeMinutes
  ) {
    problems.push(
      `${statusPath} lastRunFinishedAt is stale (${status.lastRunFinishedAt}); rerun pnpm run agent:finalize after updating handoff`,
    );
  }
}

if (problems.length > 0) {
  console.log(
    `${problems.join("; ")}. Run: pnpm run agent:finalize -- --result success --notes "completed <task or run summary>"`,
  );
  process.exit(1);
}

console.log(`Agent status: ${status.state}; lastResult: ${status.lastResult}`);
console.log(`Ready backlog tasks: ${readyTaskCount}`);

function countReadyTasks(backlogPath) {
  const backlog = fs.readFileSync(backlogPath, "utf8");
  const lines = backlog.split(/\r?\n/);
  let inReadySection = false;
  let count = 0;

  for (const line of lines) {
    if (/^##\s+Ready Tasks(?:\s+By Category)?\s*$/.test(line)) {
      inReadySection = true;
      continue;
    }

    if (inReadySection && /^##\s+/.test(line)) {
      break;
    }

    if (inReadySection && /^###\s+task-\d+\b/.test(line)) {
      count += 1;
    }
  }

  return count;
}
NODE
)"; then
  echo "$status_check_output"
  fail "$status_check_output"
else
  echo "$status_check_output"
fi

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Git branch: $(git branch --show-current)"
  echo "Git status:"
  git status --short
else
  fail "repository is not initialized as a Git worktree"
fi

if [[ -f package.json ]]; then
  run_if_script_exists typecheck
  run_if_script_exists typecheck:test
  run_if_script_exists build
  run_if_script_exists test
  run_if_script_exists lint
  run_if_script_exists format:check
else
  fail "package.json is missing"
fi

if ((failures > 0)); then
  echo "Aperture stop hook failed with $failures issue(s)."
  emit_failure_request
  exit 0
fi

commit_all_changes

if ((failures == 0)); then
  push_current_branch
fi

if ((failures > 0)); then
  echo "Aperture stop hook failed with $failures issue(s)."
  emit_failure_request
  exit 0
fi

echo "Aperture stop hook completed successfully."
emit_success
