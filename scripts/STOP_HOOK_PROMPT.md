# Stop Hook Prompt

This prompt is intended to be run when the agent is about to stop.

You must perform a final repository state evaluation and update the agent docs.

## Continuation Gate

Before performing final stop updates, check elapsed time for this run using `agent/STATUS.json.lastRunStartedAt` when available, otherwise the best available run-start time from the current session.

If all of the following are true, do not stop yet:

- Less than 45 minutes have elapsed.
- At least one ready task remains in `agent/BACKLOG.md`.
- No stop condition or safety issue applies.
- Continuing would not mix unrelated changes into an incoherent diff.

When the continuation gate says not to stop, select the next ready task and keep working. Defer final handoff/backlog/completed/status updates until the 45-minute window has elapsed, no ready task remains, or a stop condition applies.

## Required Review

Review:

- Current diff.
- `agent/BACKLOG.md`.
- `agent/HANDOFF.md`.
- `agent/COMPLETED.md`.
- `docs/NORTH_STAR.md`.
- `docs/ROADMAP.md`.
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

Update `agent/STATUS.json`:

- Ensure state is not `running`.
- Set `lastResult` to success, failure, or blocked.
- Clear `activePid`.

## Backlog Refill Policy

Use `docs/NORTH_STAR.md` and `docs/ROADMAP.md` to decide what the next useful tasks are.

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

Leave the repository in a state where the next agent can continue without guessing.
