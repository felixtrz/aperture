# Codex Wake Prompt

You are waking up for one autonomous work cycle on this repository.

Follow this protocol exactly.

## 0. Run-Start Preconditions

`.codex/config.toml` must run `scripts/codex-start-hook.sh` through Codex's
`SessionStart` hook before this wake prompt is sent to the model. That hook
records the whole chat/run start in `agent/STATUS.json.currentRunStartedAt`.

This is a run-start hook, not a per-turn hook. If `currentRunStartedAt` is
missing when this prompt begins, treat the repo hook config as misconfigured:
update `agent/HANDOFF.md` with the reason and stop instead of manually
backfilling the timestamp.

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
- Confirm `agent/STATUS.json` says `running` with a valid
  `currentRunStartedAt` for this run. This is the expected state after the
  `SessionStart` hook.
- Treat `STATUS.json` as unsafe if it is still `idle`, if
  `currentRunStartedAt` is missing/invalid, or if it appears to describe a
  different active run.

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

This run has a 50-minute work window. Completing one task before the 50-minute mark is not a reason to stop. The stop hook enforces this same 50-minute default through `STOP_HOOK_WORK_WINDOW_MINUTES`; if that value changes, update this file, `AGENTS.md`, and `scripts/STOP_HOOK_PROMPT.md` together.

A task is one vertical slice sized to fill the 50-minute window with real implementation. A vertical slice ends in a user-visible change: new pixels in an example, a new public API surface a library user would call, a removed limitation, a deleted file or feature flag, or a measurable benchmark delta.

If your selected slice finishes in less than 50 minutes with time remaining, do not pick a new ceremonial task. In priority order:

1. Extend the same slice with the next obvious thing a user would notice — more test coverage against visible outcomes, edge cases, example polish, related dead-code removal.
2. Start the next slice from the backlog _only if_ it is also a visible-feature slice and there is enough time to finish it cleanly.

Never start a `plan-X`, `audit-X`, or `tracker-alignment-X` task to fill leftover time. If no visible-feature slice remains and you cannot extend the current one, stop early with a clean handoff. Stopping early with real work shipped is better than filling time with ceremony.

If 50 minutes or more have elapsed, no ready task remains, or a stop condition applies, proceed to the end-of-run review.

Do not start broad refactors except for explicitly scoped `audit-refactor`
tasks.

## 4. Reference Anchor

Before implementing a selected task, identify the relevant proven pattern and
inspect the matching local reference code.

Before writing any new shader, pipeline, render-graph, asset-loading, lighting, shadow, or material-system code, you MUST identify and read the analogous implementation in at least one of `references/bevy`, `references/engine` (PlayCanvas), or `references/three.js`. Compare common patterns across at least two references when the slice touches the WebGPU backend or render pipeline. Borrow concepts; do not copy code. Adapt the borrowed pattern to Aperture's TypeScript, package-boundary, ECS-authoritative, WebGPU-only architecture.

Reference anchoring is required even for "small" slices when they touch rendering, lighting, shadows, IBL, glTF loading, or material wiring. The only slices exempt from reference anchoring are pure docs/tooling tasks and slices that are removing code (a deletion does not need a reference).

Every visible-feature task in the backlog must include a `Reference anchor:` line naming at least one specific file path in `references/`. If a task lacks a reference anchor, fix the backlog entry before starting implementation. If no analogous reference implementation exists for the slice, stop and document the gap in handoff before writing speculative code — the user prefers an industry-proven implementation as the anchor over a from-scratch design.

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

Each run's handoff entry must include a `References inspected:` subsection listing every reference file read during the run. This applies to all runs, not only those that change architecture or public API shape.

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
- Update `docs/index.html` when project status, completed work, next tasks, or
  completion estimates materially change.
- If work touches the render pipeline, also update
  `docs/render-pipeline-comparison.html` with current phase completion
  estimates and concrete missing pieces.

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

## 6.5 Commit Completed Feature Slices

After a coherent feature slice is implemented, validated, and documented in the
agent files, you may make an interim commit before selecting the next task. This
is encouraged when the next task would otherwise mix unrelated work into the
same diff.

Rules:

- Commit only completed, validated work and the bookkeeping that describes it.
- Do not wait for the final stop hook just to create the first commit.
- Do not use interim commits to hide failing validation or incomplete
  scaffolding.
- After committing, continue active work if the work window remains open and a
  ready visible-feature task remains.

The stop hook remains a final safety net that commits any remaining
uncommitted changes and pushes the branch. It is not the only commit point.

## 7. Audits Are Demand-Driven, Not Periodic

Do not run audits on a cadence. The standing audit is the test suite: `check:boundaries`, `typecheck`, `lint`, `vitest`, and `playwright`. If those pass, the architecture invariants are intact.

File a real `audit-refactor` task only when implementation surfaces one of these _during a slice_:

- A package import crosses a boundary the typecheck didn't catch.
- The snapshot leaks a non-JSON value the test didn't catch.
- Two implementations of the same concept have diverged.
- An example stopped working without the test suite noticing.

When this happens, fix it in the current run as part of the slice. Do not file a separate audit task. Standalone audit markdown that restates the diff is not a deliverable.

## 8. End-of-Run Review

Only perform the end-of-run review when the 50-minute work window has elapsed, no ready task remains, or a stop condition applies.

Before stopping:

- Update `agent/HANDOFF.md`. Include a `References inspected:` subsection listing every reference file read during the run.
- Update `agent/BACKLOG.md`.
- Update `agent/COMPLETED.md` for every completed task.
- Add follow-up tasks if backlog has fewer than five ready tasks. See §9 for composition rules.
- Update docs if architecture changed.
- Add a decision record if a significant decision was made.
- Verify the ready queue still meets the §9 composition rule (≥3 visible-feature, ≤1 plan, ≤1 audit, 0 tracker-alignment, Recommended Next Task is visible-feature, every visible-feature task has a `Reference anchor:` line). If not, fix it before stopping.
- Finalize `agent/STATUS.json` with `pnpm run agent:finalize -- --result success --notes "<run summary>"`. Use `failure`, `blocked`, or `stop-condition` instead of `success` when that matches the handoff.
  The finalizer rejects `success` and `failure` when the run-start hook did not
  set a valid `currentRunStartedAt`.

## 9. Backlog Refill

The backlog must always contain at least 5 ready tasks. Refill is required, but the _shape_ of refill is constrained.

**Required composition of the ready queue at all times:**

- **At least 3 visible-feature tasks** before any diagnostic, helper, audit, or planning task may be added.
- **At most 1** `plan-X` task in the ready queue.
- **At most 1** `audit-refactor` task in the ready queue.
- **Zero** `tracker-alignment-X` tasks in the ready queue.
- The **Recommended Next Task** must always be a visible-feature task.
- Every visible-feature task entry must include a `Reference anchor:` line naming at least one specific file path under `references/bevy`, `references/engine`, or `references/three.js`.

**Roadmap-strict refill (active while a Pipeline Maturity Roadmap exists in `agent/BACKLOG.md`).**

When `agent/BACKLOG.md` contains a `## Strategic Focus — Pipeline Maturity Roadmap` section listing unfinished roadmap tasks, the agent MUST:

1. Pick the next ready roadmap task in the order listed (tier ascending, then within-tier order).
2. Refuse to invent new backlog tasks outside the roadmap until every roadmap task has shipped. The composition rule (≥3 visible-feature tasks ready) is satisfied by the roadmap itself; do not add GLB-sample-variant tasks, route-coverage tasks, or any other non-roadmap visible-feature task during this period.
3. When the slice completes, advance to the next roadmap task in order. Append a follow-up entry only if the just-completed slice surfaces a _concrete blocker_ (e.g., a typecheck failure in a referenced module) that must be fixed before the next roadmap task can proceed. Such follow-ups must be filed under the same tier as the slice that surfaced them.
4. If a roadmap task's dependencies are unmet (e.g., task-3007 depends on task-3005), skip to the next task whose dependencies are met. Do not invent new tasks to "unblock" — the dependency declaration is authoritative.

When every roadmap task has shipped, this section becomes inactive. The agent may then resume regular refill per the composition rule. Until then, the roadmap is the sole source of work.

**Acceptance-criteria template for a visible-feature task.** Must include at least one of:

- "Playwright screenshot in `examples/X.html` matches reference / shows non-trivial pixels in region (x, y, w, h)."
- "Public API `X` callable from `@aperture-engine/core` (or another published package) with signature Y produces result Z."
- "File `path/to/foo.ts` deleted."
- "Benchmark `X` improves by N%."
- "Example `examples/X.html` renders Y where it previously rendered Z."

Acceptance criteria of the form `status.X.Y equals Z`, `report.diagnostics.length === N`, or `summary.X.status === "ready"` are **diagnostic**, not visible-feature, criteria.

**If you cannot identify 3 visible-feature tasks** by comparing the current examples and public API against `docs/NORTH_STAR.md` and `docs/MEDIUM_LONG_TERM_GOALS.md`, that is a signal to stop and document the gap in handoff. Do not fill the queue with diagnostic work.

Note: when the Pipeline Maturity Roadmap is active, this clause is moot — the roadmap supplies the next 20+ visible-feature tasks. The clause re-activates only after the roadmap is fully shipped.

Diagnostic tasks are allowed _only_ when a real user-facing failure mode would otherwise be invisible, and only _after_ the corresponding visible feature ships. Diagnostics follow visible features; they never precede them.

Do not add vague tasks like "continue renderer."

Each new backlog task entry must follow this shape:

```md
### task-NNNN — <Visible-feature title>

Category: <simulation | render-bridge | webgpu-render | runtime-orchestration | docs-tooling | audit-refactor>
Package/write-scope: <paths>
Reference anchor: <≥1 specific file in references/bevy, references/engine, or references/three.js>

Acceptance criteria:

- <Pixel / public API / deletion / benchmark criterion — see template above>
- <Validation command(s) run>
```

Reject any task entry that lacks a `Reference anchor:` line, unless `Category: docs-tooling` and the slice is purely docs.

Good task:

```md
### task-2001 — Render diffuse IBL on the spinning-cube example

Category: `webgpu-render`
Package/write-scope: `packages/webgpu/src/standard-shader.ts`, `packages/webgpu/src/standard-material-ibl-bind-group.ts`, `examples/spinning-cube.js`, targeted tests.
Reference anchor: `references/three.js/src/extras/PMREMGenerator.js`, `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/reflectionEnv.js`.

Acceptance criteria:

- Cube in `examples/spinning-cube.html` shows direction-dependent diffuse-IBL shading.
- Playwright canvas readback at three named coordinates differs measurably.
- `pnpm exec playwright test test/e2e/spinning-cube.spec.ts` passes.
```

Bad tasks:

```md
### task-NNNN — Make renderer better

### task-NNNN — Plan next route/glTF fidelity slice

### task-NNNN — Audit selected follow-up

### task-NNNN — Add JSON status projection for X
```

## 10. Stop

Before returning your final response, run:

```bash
pnpm run agent:finalize -- --result success --notes "<run summary>"
scripts/codex-stop-hook.sh
```

The finalizer clears active run fields in `agent/STATUS.json`. The stop hook
then validates required state, checkpoints all repository changes, and pushes
the current branch to its configured upstream. If the push fails, treat that as
a stop-hook failure and document/fix it before stopping.

If it returns a continuation request or records failures in `agent/logs`, address the failures if straightforward, update the handoff, and run it again.
If those fixes took more than a few minutes or changed the handoff/status
context, rerun `pnpm run agent:finalize -- --result <result> --notes "<run summary>"`
before rerunning the stop hook so `lastRunFinishedAt` stays fresh.

Stop after the 50-minute work window, an explicit stop condition, or exhausting ready work, then complete the handoff update and stop-hook verification.

The next agent run should be able to continue from your handoff.
