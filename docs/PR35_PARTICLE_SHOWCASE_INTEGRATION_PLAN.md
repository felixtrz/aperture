# PR35 Particle Showcase Integration Plan

## Current State

- Main worktree: `/Users/felixz/Projects/aperture`
  - Branch: `main`
  - Status: clean and synced with `origin/main` at `7435ae38`.
  - Obsolete racing changes have been removed.
- Integration worktree: `/Users/felixz/Projects/aperture-pr35-integration`
  - Branch: `codex/pr35-particle-showcase-integration`
  - Base: PR35 head, `origin/pr/35`.
  - Current uncommitted candidate fix:
    - `packages/app/src/systems/assets.ts`
    - `test/app/particle-effect-assets.test.ts`
- Particle showcase commit already exists on `main` and needs to be rebased onto PR35 after PR35 review/fixes.

## Goals

1. Review PR35 thoroughly for particle-system regressions.
2. Fix any PR35 issues required before layering the showcase on top.
3. Rebase or cherry-pick the particle showcase work onto the PR35 integration branch.
4. Resolve conflicts in favor of the PR35 particle-composition architecture.
5. Validate that existing examples and showcases still work.
6. Keep `main` clean and avoid reintroducing obsolete racing changes.

## Non-Goals

- Do not redesign package boundaries during this pass.
- Do not split particles into a new package during this pass.
- Do not refactor unrelated rendering, app, racing, or showcase code.
- Do not commit generated docs-site output or local tooling metadata.
- Do not mutate `main` while integration work continues.

## Workflow Phases

### 1. Freeze State

- Confirm `main` is clean before and after each major step.
- Confirm all implementation work happens in `/Users/felixz/Projects/aperture-pr35-integration`.
- Record PR35 head and local branch head before applying the showcase commit.
- Keep PR35 fixes and showcase integration separable in the final diff.

Acceptance criteria:

- `git -C /Users/felixz/Projects/aperture status --short --branch` shows a clean `main`.
- `git -C /Users/felixz/Projects/aperture-pr35-integration status --short --branch` shows only intentional integration-branch changes.

### 2. Review PR35

Review these surfaces:

- Particle authoring schema and validation:
  - `packages/render/src/assets/particles.ts`
  - `packages/app/src/config/index.ts`
  - `packages/app/src/config/validation.ts`
- App asset registration/loading:
  - `packages/app/src/systems/assets.ts`
  - `packages/app/src/worker/assets.ts`
- Extraction and snapshot transport:
  - `packages/render/src/rendering/extraction-particles.ts`
  - `packages/render/src/rendering/snapshot-packet-types.ts`
  - `packages/render/src/rendering/snapshot-packed-particle-codec.ts`
  - `packages/render/src/rendering/snapshot-packed-encoding-constants.ts`
- WebGPU particle runtime:
  - `packages/webgpu/src/app/particles.ts`
  - `packages/webgpu/src/app/resource-cache.ts`
  - `packages/webgpu/src/render/particles/particle-pipeline.ts`
- Tests and docs changed by PR35.

Review focus:

- Composite effects expand into leaf packets before WebGPU consumption.
- Child emitter `delay`, `duration`, `timeScale`, transform, seed, capacity, and effect version are preserved.
- Nested composite rejection is explicit and diagnostic-driven.
- Snapshot packed encoding carries new packet fields without breaking worker transport.
- Asset dependency graph includes particle textures, samplers, and composite child effects.
- GPU cache keys include all fields that affect resource layout or shader behavior.
- Continuous and burst particle paths still behave correctly.
- Package boundaries remain compatible with the repository invariants.

Acceptance criteria:

- Every PR35 particle data transition is understood end to end:
  - config input
  - asset registry
  - ECS particle emitter
  - extraction
  - packed snapshot
  - WebGPU frame preparation
  - draw command emission
- Any confirmed issue has a narrow fix and a test.
- Any unconfirmed concern is either investigated or explicitly documented as residual risk.

### 3. Fix PR35 Issues

Known candidate fix:

- Composite particle-effect assets should register dependencies on their child particle effects.
- Existing leaf dependencies on texture and sampler assets should remain unchanged.
- Add a regression test beside existing particle-effect asset tests.

Fix rules:

- Keep patches narrowly scoped.
- Prefer tests near the changed behavior.
- Do not restructure particle assets or app loading beyond the confirmed issue.
- Do not change public API naming unless a real regression requires it.

Acceptance criteria:

- New or updated tests fail before the fix and pass after the fix.
- The fix does not require unrelated source edits.
- The fix does not change behavior for non-composite particle effects.

### 4. Rebase Particle Showcase Onto PR35

Bring the particle showcase work onto the PR35 integration branch.

Expected overlap:

- `packages/webgpu/src/app/particles.ts`
- `packages/webgpu/src/app/resource-cache.ts`
- `packages/webgpu/src/render/particles/particle-pipeline.ts`
- `test/webgpu/particle-frame-resources.test.ts`
- Example files under `examples/`
- Particle sprite assets under `examples/assets/`

Conflict-resolution rules:

- Preserve PR35's unified leaf/composite particle model.
- Adapt the showcase to PR35's current public and internal APIs.
- Keep example logic ECS-authored and worker-compatible.
- Preserve the optimized showcase behavior from the current particle demo:
  - staged lightning, flare, fire, smoke cycle
  - ground strike point
  - shader-driven glowing dot
  - point-light pulses
  - reduced stutter/resource churn
  - no obsolete racing-asset dependency
- Do not reintroduce the discarded racing changes.

Acceptance criteria:

- The showcase compiles and runs on top of PR35.
- The example uses PR35-compatible particle effect authoring.
- The demo has no missing asset, particle, shader, or snapshot diagnostics during normal playback.
- Visual behavior remains suitable for recording.

### 5. Validate Examples And Showcases

Run targeted tests first, then broader checks.

Targeted particle tests:

```sh
./node_modules/.bin/vitest run \
  test/app/particle-effect-assets.test.ts \
  test/app/particle-spawn.test.ts \
  test/rendering/particle-composite-extraction.test.ts \
  test/rendering/particle-emitter-extraction.test.ts \
  test/rendering/snapshot-packed-encoding.test.ts \
  test/webgpu/particle-frame-resources.test.ts \
  test/webgpu/particle-pipeline.test.ts
```

Core repo validation:

```sh
pnpm run check:boundaries
pnpm run build
pnpm run typecheck:test
pnpm run check:examples
pnpm run lint
pnpm run format:check
pnpm test
```

Showcase validation:

```sh
pnpm --dir showcase/platformer run typecheck
pnpm --dir showcase/platformer run build
pnpm --dir showcase/racing run typecheck
pnpm --dir showcase/racing run build
pnpm --dir showcase/city-builder run typecheck
pnpm --dir showcase/city-builder run build
pnpm --dir showcase/fps run typecheck
pnpm --dir showcase/fps run build
```

Browser/WebGPU validation:

```sh
node scripts/serve-examples.mjs
```

Open:

```text
http://127.0.0.1:4173/examples/particle-showcase.html
```

Browser checks:

- Particle showcase initializes successfully.
- No runtime diagnostics appear for missing particle effects, textures, shaders, or bind groups.
- Lightning stage has repeated visible strikes across the full strike window.
- Fire and smoke stages transition smoothly.
- Glowing dot starts at opacity 0, grows during lightning, persists through fire, and fades to 0 by the next cycle.
- No obvious frame freezes or repeated resource-allocation stalls.
- Examples index links to the showcase correctly.

Full final gate, if feasible:

```sh
pnpm run check
pnpm run test:e2e
```

Acceptance criteria:

- All targeted particle tests pass.
- Root build/typecheck/example/lint/format/test checks pass, or any failure is confirmed unrelated and documented.
- All showcase typecheck/build commands pass, or any failure is confirmed unrelated and documented.
- Browser smoke confirms particle showcase renders correctly on PR35.

## Commit Strategy

Preferred commit split:

1. `fix: track composite particle dependencies`
   - PR35 correctness fix and test.
2. `feat: rebase particle showcase onto particle composition`
   - Showcase example, assets, WebGPU integration conflict resolutions, and tests.

If conflict resolution tightly couples PR35 fixes to showcase adaptation, combine only when separation would make the history misleading.

Before committing:

- Inspect `git diff --stat`.
- Inspect `git diff --check`.
- Stage only intentional files.
- Confirm no racing changes are present.

## Final Report

Report back with:

- Workflow phases completed.
- Files changed.
- PR35 issues found and fixed.
- Showcase rebase summary.
- Validation commands run and outcomes.
- Any skipped validation or residual risk.
- Branch/worktree status.
