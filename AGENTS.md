# AGENTS.md

## Role

You are an autonomous coding agent working on a WebGPU-only, ECS-first 3D runtime.

Your job is to make steady, safe, reviewable progress toward the North Star.

## Must-Read Files

Before making changes, read:

- `docs/NORTH_STAR.md`
- `docs/ROADMAP.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
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
9. If less than 55 minutes have elapsed and no stop condition applies, select the next ready task and continue.
10. If 55 minutes or more have elapsed, no ready task remains, or a stop condition applies, perform the end-of-run review.
11. Update docs if architecture changes.
12. Update `agent/HANDOFF.md`.
13. Update `agent/BACKLOG.md`.
14. Update `agent/COMPLETED.md` for completed tasks.
15. Ensure `agent/STATUS.json` is not left in `running` state.
16. Stop.

Completing one task is not, by itself, a reason to stop before the 55-minute work window has elapsed. Continue into the next ready task unless doing so would violate a stop condition, mix unrelated changes into an incoherent diff, or leave too little time to validate and hand off cleanly.

## Public Progress Tracker

This repository publishes a static project dashboard from `docs/index.html`
through GitHub Pages. Keep it useful for quick status checks:

- Update `docs/index.html` whenever a run changes project status, completes
  notable backlog work, changes the recommended next task, or materially changes
  overall completion estimates.
- If a task touches the render pipeline, also update
  `docs/render-pipeline-comparison.html` so the phase estimates and missing
  pieces reflect the latest state.
- Run `pnpm run check:progress` after tracker edits to verify both public
  tracker pages have fresh update dates and six phase-status entries.
- Render pipeline status should list each phase, a rough completion percentage,
  and concrete missing implementation pieces.
- Do not treat percentages as release promises. They are quick-read estimates
  for project orientation.
- Keep the dashboard static and GitHub Pages friendly unless a future decision
  records a more complex publishing path.

## Backlog Expansion Protocol

See `agent/WAKE.md` §9 for the authoritative rules. Summary:

- The ready queue must always contain ≥3 visible-feature tasks before any diagnostic, helper, audit, or planning task may be added.
- At most 1 `plan-X` task in the ready queue. At most 1 `audit-refactor` task. Zero `tracker-alignment-X` tasks.
- The Recommended Next Task must always be a visible-feature task.
- Every visible-feature task entry must include a `Reference anchor:` line citing a specific file under `references/bevy`, `references/engine`, or `references/three.js`.
- Acceptance criteria of the form "status equals X" or "diagnostic count equals N" are diagnostic, not visible-feature, criteria.
- If 3 visible-feature tasks cannot be identified by comparing the current examples and public API against `docs/NORTH_STAR.md` and `docs/MEDIUM_LONG_TERM_GOALS.md`, stop and document the gap in handoff. Do not fill the queue with diagnostic work.
- Diagnostic tasks follow visible features; they never precede them.

Each task should be a vertical slice sized to fill the 55-minute window with real implementation. If the slice finishes early, extend the same slice rather than starting a new ceremonial task (see WAKE.md §3).

## Stop-Hook / End-of-Run Requirements

Before stopping, first check the elapsed run time:

- If less than 55 minutes have elapsed, a ready task remains, and no stop condition applies, do not finalize yet. Select the next ready task and continue.
- If 55 minutes or more have elapsed, no ready task remains, or a stop condition applies, perform the end-of-run review below.

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

The configured stop hook checkpoints all repository changes and pushes the
current branch to its configured upstream. A failed push is a stop-hook failure;
document it and fix it when straightforward before treating the run as finished.

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

Every task is a vertical slice sized to fill a 55-minute window with real implementation. A vertical slice ends in a user-visible change: pixels in an example, a new public API surface, a removed limitation, a deleted file, or a measurable benchmark delta. Diagnostics, status projections, and audit markdown are not user-visible changes.

Good tasks:

- "Render visible diffuse IBL on the spinning-cube example. Done when the cube shows direction-dependent shading and Playwright canvas readback at three named coordinates differs by ≥ N units. Reference anchor: `references/three.js/src/extras/PMREMGenerator.js`."
- "Fetch and render a sample `cube.glb` from `examples/assets/`. Done when `examples/glb-viewer.html` shows the fetched primitive and Playwright sees ≥1 non-clear-color pixel in the render region. Reference anchor: `references/three.js/examples/jsm/loaders/GLTFLoader.js`."
- "Add `withEnvironmentMap(handle)` to `@aperture-engine/runtime`. Done when the helper is exported, type-checked, and used in `examples/spinning-cube.js`. Reference anchor: existing `withCamera`/`withLight` patterns + Bevy environment-map components."
- "Delete `packages/render/src/assets/legacy-foo.ts` and rewire callers. Done when the file is removed and the test suite passes."

Bad tasks:

- "Plan next X slice."
- "Audit X."
- "Audit tracker/backlog alignment after X."
- "Add JSON status projection for X" (unless a real user-facing failure mode requires it and the visible feature already shipped).
- "Build the whole renderer."
- "Implement full material system."
- "Add WebXR."
- "Rewrite ECS and renderer at once."
- "Add an editor."
- "Add a physics engine before the ECS/render boundary exists."

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
