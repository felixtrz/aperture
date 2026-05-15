# AGENTS.md

## Role

You are an autonomous coding agent working on a WebGPU-only, ECS-first 3D runtime.

Your job is to make steady, safe, reviewable progress toward the North Star.

## Must-Read Files

Before making changes, read:

- `docs/NORTH_STAR.md`
- `docs/ROADMAP.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `agent/BACKLOG.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`

## Project Direction

This project is not a three.js clone.

The goal is a modern 3D runtime where:

- ECS is the source of truth.
- Rendering is a derived view of ECS state.
- WebGPU is the only rendering backend.
- There is no central mutable scene graph.
- Render extraction is a first-class boundary.
- Future worker-thread simulation must remain possible.
- APIs and docs should be friendly to both humans and coding agents.

## Autonomous Work Protocol

When you start:

1. Check `agent/STATUS.json`.
2. Read `agent/HANDOFF.md`.
3. Read `agent/BACKLOG.md`.
4. Pick the next task from `agent/CURRENT_TASK.md` or the highest-priority ready task in `agent/BACKLOG.md`.
5. Work on one coherent task at a time.
6. Add or update tests where practical.
7. Run relevant validation for the work completed.
8. After each coherent task, check elapsed run time.
9. If less than 45 minutes have elapsed and no stop condition applies, select the next ready task and continue.
10. If 45 minutes or more have elapsed, no ready task remains, or a stop condition applies, perform the end-of-run review.
11. Update docs if architecture changes.
12. Update `agent/HANDOFF.md`.
13. Update `agent/BACKLOG.md`.
14. Update `agent/COMPLETED.md` for completed tasks.
15. Ensure `agent/STATUS.json` is not left in `running` state.
16. Stop.

Completing one task is not, by itself, a reason to stop before the 45-minute work window has elapsed. Continue into the next ready task unless doing so would violate a stop condition, mix unrelated changes into an incoherent diff, or leave too little time to validate and hand off cleanly.

## Backlog Expansion Protocol

At the end of a successful run, compare current state against:

- `docs/NORTH_STAR.md`
- `docs/ROADMAP.md`
- `docs/ARCHITECTURE.md`

If the backlog is empty or nearly empty, add small next-step tasks that advance the roadmap.

Rules:

- Add concrete tasks, not vague aspirations.
- Each task should have acceptance criteria.
- Each task should be substantial enough for about 30-60 minutes of focused work when possible.
- Prefer vertical slices.
- Do not add huge epics as immediate tasks.
- Do not invent architecture that conflicts with docs.
- If a new major direction is needed, add a decision to `docs/DECISIONS.md`.

## Stop-Hook / End-of-Run Requirements

Before stopping, first check the elapsed run time:

- If less than 45 minutes have elapsed, a ready task remains, and no stop condition applies, do not finalize yet. Select the next ready task and continue.
- If 45 minutes or more have elapsed, no ready task remains, or a stop condition applies, perform the end-of-run review below.

When performing the end-of-run review:

1. Summarize what changed.
2. List files touched.
3. List tests/validation run.
4. Note known issues.
5. Mark all completed backlog items.
6. Add new backlog items if needed.
7. Recommend the next task.
8. Update `agent/HANDOFF.md`.
9. Ensure `agent/STATUS.json` is not left in `running` state.

## Hard Constraints

Do not:

- Modify secrets or credentials.
- Add large dependencies without justification.
- Rewrite unrelated code.
- Change the core architecture without updating `docs/DECISIONS.md`.
- Auto-merge to main.
- Leave broad unfinished scaffolding.
- Start multiple tasks concurrently or combine unrelated work into one incoherent change.
- Delete roadmap, North Star, decision log, or handoff docs.
- Create a hidden scene graph as the renderer's source of truth.
- Make WebGL fallback part of the core renderer.

## Preferred Implementation Style

- TypeScript-first.
- Explicit types.
- Small modules.
- Tests near implementation.
- Clear public APIs.
- Minimal dependencies.
- Deterministic systems.
- Data-driven schemas.
- Actionable error messages.
- Good comments for architectural boundaries.

## Good Task Shape

Good:

- Implement entity allocator with tests.
- Add `WorldTransform` propagation for one-level hierarchy.
- Define `RenderPacket` and test extraction from mock ECS state.
- Add WebGPU device initialization with clear unsupported error.
- Add `FrameReport` data type and populate draw-call count.

Bad:

- Build the whole renderer.
- Implement full material system.
- Add WebXR.
- Rewrite ECS and renderer at once.
- Add an editor.
- Add a physics engine before the ECS/render boundary exists.

## Validation Expectations

Prefer running:

- `npm test`
- `npm run build`
- `npm run lint` if available
- targeted tests for changed files

If validation cannot run, explain why in `agent/HANDOFF.md`.

## Handoff Quality Bar

The next agent should be able to continue without guessing.

A good handoff includes:

- What was done.
- Why it was done.
- What remains.
- Whether tests pass.
- What to do next.
- Any architectural concerns.
