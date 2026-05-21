# Stop Hook Prompt

This prompt is intended to be run when the agent is about to stop.

You must perform a final repository state evaluation and update the agent docs.

## Continuation Gate

Before performing final stop updates, check elapsed time for this run using
`agent/STATUS.json.currentRunStartedAt`. `.codex/config.toml` should have set
that value by running `scripts/codex-start-hook.sh` through Codex's
`SessionStart` hook before the wake prompt was sent. Do not use a stale
`lastRunStartedAt` as a substitute for an active run start; if
`currentRunStartedAt` is missing, document the start-hook failure and stop with
a blocked result.

The default work window is 50 minutes; if `STOP_HOOK_WORK_WINDOW_MINUTES`
intentionally changes that value, update this file, `AGENTS.md`, and
`agent/WAKE.md` together.

If all of the following are true, do not stop yet:

- Less than 50 minutes have elapsed.
- At least one ready task remains in `agent/BACKLOG.md`.
- No stop condition or safety issue applies.
- Continuing would not mix unrelated changes into an incoherent diff.

When the continuation gate says not to stop, select the next ready task and keep working. Defer final handoff/backlog/completed/status updates until the 50-minute window has elapsed, no ready task remains, or a stop condition applies.

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
`lastRunFinishedAt`, and records the chosen `lastResult`. The finalizer rejects
`success` and `failure` if `scripts/codex-start-hook.sh` did not record a valid
`currentRunStartedAt`. The stop hook also requires the finalized
`lastRunFinishedAt` timestamp to be fresh, so rerun the finalizer after fixing
any stop-hook failures that change handoff or status context.

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
