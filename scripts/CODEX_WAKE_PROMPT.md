# Codex Wake Prompt

You are waking up for one autonomous work cycle on this repository.

Follow this protocol exactly.

## 1. Read Context

Read:

- `AGENTS.md`
- `docs/NORTH_STAR.md`
- `docs/ROADMAP.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `agent/STATUS.json`
- `agent/HANDOFF.md`
- `agent/BACKLOG.md`
- `agent/CURRENT_TASK.md`
- `agent/STOP_CONDITIONS.md`

## 2. Safety Check

Before changing files:

- Check whether another run appears active.
- Check whether the working tree has unexpected changes.
- Check whether `agent/STATUS.json` says `running`.

If unsafe, update `agent/HANDOFF.md` with the reason and stop.

## 3. Select Work

If `agent/CURRENT_TASK.md` names a task, work on that.

Otherwise, select the highest-priority ready task from `agent/BACKLOG.md`.

Work on exactly one task.

Do not start broad refactors.

## 4. Execute

Implement the task.

Rules:

- Keep changes small and coherent.
- Add/update tests where practical.
- Do not violate architecture invariants.
- Do not add large dependencies without documenting why.
- Do not create a central mutable scene graph.
- Do not make the renderer own ECS/game state.
- Do not implement WebGL fallback.

## 5. Validate

Run relevant validation:

- `npm run build` if available.
- `npm test` if available.
- `npm run lint` if available.
- Targeted tests for changed files.

If validation fails, fix if straightforward. If not, stop and document the failure.

## 6. End-of-Run Review

Before stopping:

- Update `agent/HANDOFF.md`.
- Update `agent/BACKLOG.md`.
- Update `agent/COMPLETED.md` if a task is complete.
- Add follow-up tasks if backlog has fewer than five ready tasks.
- Update docs if architecture changed.
- Add a decision record if a significant decision was made.

## 7. Backlog Refill

Compare current implementation against:

- `docs/NORTH_STAR.md`
- `docs/ROADMAP.md`
- `docs/ARCHITECTURE.md`

If more immediate work is needed, add small backlog tasks with acceptance criteria.

Do not add vague tasks like “continue renderer.”

Good task:

```md
### task-0021 — Add render packet sorting by material

Acceptance criteria:

- Render packets can be sorted by material handle.
- Sorting is stable.
- Tests cover sort order.
```

Bad task:

```md
### task-0021 — Make renderer better
```

## 8. Stop

Stop after one coherent task and handoff update.

The next agent run should be able to continue from your handoff.
