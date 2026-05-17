# Codex Wake Prompt

You are waking up for one autonomous work cycle on this repository.

Follow this protocol exactly.

## 1. Read Context

Read:

- `AGENTS.md`
- `docs/NORTH_STAR.md`
- `docs/ROADMAP.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
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

Work on one task at a time. Every ready task should declare a category. If the
selected task is uncategorized, first update the backlog entry with a category,
package/write-scope, reference anchors, and acceptance criteria before
implementing it.

Task categories:

- `simulation`: ECS, assets, math, diagnostics, transforms, headless systems.
- `render-bridge`: render authoring components, extraction, snapshots, render
  world contracts, prepared-asset contracts.
- `webgpu-render`: GPU resources, WGSL, pipelines, bind groups, render passes,
  command encoding, submission, GPU diagnostics.
- `runtime-orchestration`: app facades, frame loop policy, examples, headless vs
  WebGPU mode selection.
- `docs-tooling`: docs, scripts, tests, validation, agent workflow.
- `audit-refactor`: architecture drift checks and small corrective refactors.

This run has a 55-minute work window. Completing one task before the 55-minute mark is not a reason to stop. After each coherent task and its relevant validation, check elapsed time:

- If less than 55 minutes have elapsed and no stop condition applies, select the next highest-priority ready task and keep working.
- If 55 minutes or more have elapsed, no ready task remains, or a stop condition applies, proceed to the end-of-run review.

Do not start broad refactors except for explicitly scoped `audit-refactor`
tasks.

## 4. Reference Anchor

Before implementing a selected task, identify the relevant proven pattern and
inspect the matching local reference code. Keep the research proportional: small
docs/test updates may need only the existing Aperture docs, while architecture
or renderer changes need direct reference inspection.

Reference rules by category:

- `simulation`, `render-bridge`, and `runtime-orchestration`: anchor first on
  `/Users/felixz/Projects/aperture/references/bevy`, especially its ECS,
  assets, render extraction, render app, material, and render-asset preparation
  patterns.
- `webgpu-render`: inspect both
  `/Users/felixz/Projects/aperture/references/engine` and
  `/Users/felixz/Projects/aperture/references/three.js`. Find common render
  pipeline, material, geometry, shader, resource, or pass-management patterns,
  then design Aperture's version around its ECS/snapshot/WebGPU-only model.
- `audit-refactor`: compare the implementation against `docs/NORTH_STAR.md`,
  `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, package dependency boundaries,
  and the relevant reference anchors for the area being audited.
- `docs-tooling`: use project docs and local scripts as the primary reference;
  inspect external engine references only if the docs/tooling change affects
  architecture or implementation direction.

Do not copy reference implementation text or code verbatim. Borrow concepts,
state the commonality, and adapt them to Aperture's TypeScript, package-boundary,
ECS-authoritative, WebGPU-only architecture.

Record the reference files or patterns inspected in `agent/HANDOFF.md` when the
task changes architecture, package boundaries, render pipeline behavior, or
public API shape.

## 5. Execute

Implement the task.

Rules:

- Keep changes small and coherent.
- Add/update tests where practical.
- Do not violate architecture invariants.
- Do not add large dependencies without documenting why.
- Do not create a central mutable scene graph.
- Do not make the renderer own ECS/game state.
- Do not implement WebGL fallback.

## 6. Validate

Run relevant validation:

- `pnpm run build` if available.
- `pnpm test` if available.
- `pnpm run lint` if available.
- `pnpm run check` for broad validation after package, public API, or
  architecture changes.
- `pnpm exec playwright test ...` for browser/WebGPU behavior changes.
- Targeted tests for changed files.

If validation fails, fix if straightforward. If not, stop and document the failure.

## 7. Audit Cadence

Every few implementation tasks, enforce a focused `audit-refactor` task. Add or
select an audit task when any of these are true:

- Three to five non-audit implementation tasks have landed since the last audit.
- A package boundary, public API, render extraction contract, or render pipeline
  stage changed.
- A task introduced temporary scaffolding that needs cleanup.
- Examples or tests reveal drift from the North Star or Bevy-aligned bridge.

Audit tasks should be small and concrete. They should check package dependency
direction, ECS/render ownership, snapshot serializability, public API shape,
docs/backlog alignment, examples, and relevant tests. They may include small
corrective refactors, but should not become broad rewrites.

## 8. End-of-Run Review

Only perform the end-of-run review when the 55-minute work window has elapsed, no ready task remains, or a stop condition applies.

Before stopping:

- Update `agent/HANDOFF.md`.
- Update `agent/BACKLOG.md`.
- Update `agent/COMPLETED.md` for every completed task.
- Add follow-up tasks if backlog has fewer than five ready tasks.
- Update docs if architecture changed.
- Add a decision record if a significant decision was made.

## 9. Backlog Refill

Compare current implementation against:

- `docs/NORTH_STAR.md`
- `docs/ROADMAP.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`

If more immediate work is needed, add small backlog tasks with acceptance criteria.

Do not add vague tasks like “continue renderer.”

Each new backlog task must include:

- Category.
- Package/write-scope.
- Reference anchor.
- Acceptance criteria.

Good task:

```md
### task-0021 — Add render packet sorting by material

Category: `render-bridge`
Package/write-scope: `packages/render`, targeted tests.
Reference anchor: Bevy render phase queue/sort pattern.

Acceptance criteria:

- Render packets can be sorted by material handle.
- Sorting is stable.
- Tests cover sort order.
```

Bad task:

```md
### task-0021 — Make renderer better
```

## 10. Stop

Before returning your final response, run:

```bash
scripts/codex-stop-hook.sh
```

The stop hook validates required state, checkpoints all repository changes, and
pushes the current branch to its configured upstream. If the push fails, treat
that as a stop-hook failure and document/fix it before stopping.

If it returns a continuation request or records failures in `agent/logs`, address the failures if straightforward, update the handoff, and run it again.

Stop after the 55-minute work window, an explicit stop condition, or exhausting ready work, then complete the handoff update and stop-hook verification.

The next agent run should be able to continue from your handoff.
