# Stop Hook Prompt

This prompt is intended to be run when the agent is about to stop.

You must perform a final repository state evaluation and update the agent docs.

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

- Summary of work completed.
- Files touched.
- Tests/validation run.
- Current known issues.
- Architectural notes.
- Recommended next task.

Update `agent/BACKLOG.md`:

- Mark the completed task.
- Remove or move completed task if appropriate.
- Add follow-up tasks if needed.
- Ensure at least five ready tasks exist unless the project is blocked.

Update `agent/COMPLETED.md`:

- Add completed task summary.
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
- Be small.
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
