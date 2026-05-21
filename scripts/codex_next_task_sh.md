# Example `scripts/codex-next-task.sh`

Save this as `scripts/codex-next-task.sh` and make it executable.

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

LOCK_FILE="agent/lock"
LOG_DIR="agent/logs"
PROMPT_FILE="agent/WAKE.md"

mkdir -p "$LOG_DIR"

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

echo "Starting Codex run $RUN_ID"

set +e
codex exec "$(cat "$PROMPT_FILE")" 2>&1 | tee "$LOG_FILE"
CODEX_EXIT=${PIPESTATUS[0]}
set -e

if [[ "$CODEX_EXIT" -ne 0 ]]; then
  pnpm run agent:finalize -- \
    --result failure \
    --notes "Codex exited with code $CODEX_EXIT. See $LOG_FILE."
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

git push

pnpm run agent:finalize -- \
  --result success \
  --commit "$LAST_COMMIT" \
  --notes "Autonomous Codex run completed. See $LOG_FILE."

echo "Codex run completed."
```
