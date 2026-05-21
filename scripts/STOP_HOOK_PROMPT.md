# Stop Hook Prompt

This prompt is intended to be run when the agent is about to stop.

You must perform a final repository state evaluation and update the agent docs.

## Continuation Gate

Before performing final stop updates, check the current minute of the hour.
There is no run-start hook and no elapsed-runtime check. The stop hook only
uses the wall-clock minute gate.

If all of the following are true, do not stop yet:

- The current minute of the hour is before `:50`.
- At least one ready task remains in `agent/BACKLOG.md`.
- Continuing would not mix unrelated changes into an incoherent diff.

When the continuation gate says not to stop, select the next ready task and keep
working. Do not wait, sleep, poll, or idle for minute `:50`. Defer final
handoff/backlog/completed/status updates until the minute-50 gate opens, no
ready task remains, or a safety issue requires documentation. `lastResult` does
not bypass the minute gate.

## Required Review

Review:

- Current diff.
- `agent/BACKLOG.md`.
- `agent/HANDOFF.md`.
- `agent/COMPLETED.md`.
- `docs/NORTH_STAR.md`.
- `docs/ROADMAP.md`.
- `docs/MEDIUM_LONG_TERM_GOALS.md`.
- `docs/ARCHITECTURE.md`.

## Required Updates

Update `agent/HANDOFF.md` with:

- Summary of all work completed in the run.
- Files touched.
- Tests/validation run.
- Current known issues.
- Architectural notes.
- Recommended next task.

Update `agent/BACKLOG.md`:

- Mark every completed task.
- Remove or move completed tasks if appropriate.
- Add follow-up tasks if needed.
- Ensure at least five ready tasks exist unless the project is blocked.

Update `agent/COMPLETED.md`:

- Add completed task summaries.
- Include date if available.
- Include validation result.

Finalize `agent/STATUS.json` after the handoff/backlog/completed docs are current:

```bash
pnpm run agent:finalize -- --result success --notes "<run summary>"
```

Use `failure`, `blocked`, or `stop-condition` instead of `success` when that
matches the handoff. The finalizer sets `state` to `idle`, clears
`currentTaskId`, `currentRunStartedAt`, and `activePid`, updates
`lastRunFinishedAt`, and records the chosen `lastResult`. The stop hook also
requires the finalized `lastRunFinishedAt` timestamp to be fresh, so rerun the
finalizer after fixing any stop-hook failures that change handoff or status
context.

## Backlog Refill Policy

Use `docs/NORTH_STAR.md`, `docs/ROADMAP.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md` to decide what the next useful tasks are.

New backlog tasks must:

- Be specific.
- Be sized for about 30-60 minutes of focused work when possible.
- Have acceptance criteria.
- Align with architecture.
- Avoid speculative bloat.

## Stop Conditions

If the repo is in a questionable state, do not hide it.

Document:

- What is broken.
- What was attempted.
- What should happen next.

## Final Requirement

Leave the repository in a state where the next agent can continue without
guessing. Agents are allowed to make interim commits after coherent, validated
feature slices. The configured stop hook is expected to checkpoint any remaining
uncommitted changes and push the current branch; if that fails, document the
failure and do not treat the run as cleanly finished.
