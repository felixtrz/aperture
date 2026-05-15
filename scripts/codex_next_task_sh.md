# Example `scripts/codex-next-task.sh`

Save this as `scripts/codex-next-task.sh` and make it executable.

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

LOCK_FILE="agent/lock"
STATUS_FILE="agent/STATUS.json"
LOG_DIR="agent/logs"
PROMPT_FILE="scripts/CODEX_WAKE_PROMPT.md"

mkdir -p "$LOG_DIR"

now() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

is_pid_alive() {
  local pid="$1"
  if [[ -z "$pid" ]]; then
    return 1
  fi
  kill -0 "$pid" 2>/dev/null
}

if [[ -f "$LOCK_FILE" ]]; then
  LOCK_PID="$(cat "$LOCK_FILE" || true)"
  if is_pid_alive "$LOCK_PID"; then
    echo "Codex job already running with PID $LOCK_PID. Skipping."
    exit 0
  fi

  echo "Found stale lock for PID $LOCK_PID. Removing."
  rm -f "$LOCK_FILE"
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Repo has uncommitted changes. Skipping new Codex run."
  exit 0
fi

echo "$$" > "$LOCK_FILE"

cleanup() {
  rm -f "$LOCK_FILE"
}
trap cleanup EXIT

RUN_ID="$(date -u +"%Y%m%dT%H%M%SZ")"
LOG_FILE="$LOG_DIR/$RUN_ID.log"

cat > "$STATUS_FILE" <<EOF
{
  "state": "running",
  "currentTaskId": "auto",
  "lastRunStartedAt": "$(now)",
  "lastRunFinishedAt": null,
  "lastResult": "in_progress",
  "lastCommit": null,
  "activePid": $$,
  "notes": "Autonomous Codex run started."
}
EOF

echo "Starting Codex run $RUN_ID"

set +e
codex exec "$(cat "$PROMPT_FILE")" 2>&1 | tee "$LOG_FILE"
CODEX_EXIT=${PIPESTATUS[0]}
set -e

if [[ "$CODEX_EXIT" -ne 0 ]]; then
  cat > "$STATUS_FILE" <<EOF
{
  "state": "idle",
  "currentTaskId": null,
  "lastRunStartedAt": null,
  "lastRunFinishedAt": "$(now)",
  "lastResult": "failure",
  "lastCommit": null,
  "activePid": null,
  "notes": "Codex exited with code $CODEX_EXIT. See $LOG_FILE."
}
EOF
  exit "$CODEX_EXIT"
fi

# Optional validation gate.
if [[ -f package.json ]]; then
  if npm run build >/dev/null 2>&1; then
    npm run build 2>&1 | tee -a "$LOG_FILE"
  fi

  if npm test >/dev/null 2>&1; then
    npm test 2>&1 | tee -a "$LOG_FILE"
  fi
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  git add .
  git commit -m "agent: autonomous progress $RUN_ID" || true
  LAST_COMMIT="$(git rev-parse --short HEAD)"
else
  LAST_COMMIT="$(git rev-parse --short HEAD)"
fi

cat > "$STATUS_FILE" <<EOF
{
  "state": "idle",
  "currentTaskId": null,
  "lastRunStartedAt": null,
  "lastRunFinishedAt": "$(now)",
  "lastResult": "success",
  "lastCommit": "$LAST_COMMIT",
  "activePid": null,
  "notes": "Autonomous Codex run completed. See $LOG_FILE."
}
EOF

echo "Codex run completed."
```
