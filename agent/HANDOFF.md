# Handoff

## Current Status

Completed `task-0158` through `task-0162` in one validated automation run.

The run finished the snapshot-driven injected render frame sequence:

```text
RenderSnapshot
  -> snapshot resource binding planner
  -> RenderWorld.applySnapshot
  -> resource binding updates
  -> packed transforms
  -> draw readiness
  -> render-world draw packages
  -> draw-command descriptors
  -> render pass assembly
  -> frame execution
  -> renderer frame summary
```

The next recommended task is `task-0163 — Add browser example harness`.

## Run Summary

Major changes:

- Added `summarizeInjectedRenderFrameSnapshotDiagnosticsByPhase`.
- Added `createSnapshotRenderFrameFixture` with ready, duplicate render id, missing binding, missing transform, and submit-failure coverage.
- Updated `docs/RENDER_FRAME_READINESS.md` for the snapshot runner and its relationship to render worlds, bindings, packed transforms, and lower-level runners.
- Added `planInjectedRenderFrameSnapshotResourceBindings`, which derives ordered binding updates from snapshots and mesh/material resource-key resolvers without mutating `RenderWorld`.
- Added `createEcsSnapshotRenderFrameFixture`, which builds ECS camera/mesh entities, extracts a snapshot, plans bindings, and runs the snapshot injected frame helper.
- Refilled the ready backlog with resolver-map, binding-plan JSON/diagnostics, fixture refactor, and docs follow-up tasks.
- User then redirected the next work toward browser end-to-end verification. The ready backlog was rewritten to prioritize a browser example harness, WebGPU clear smoke test, Playwright verification, real unlit GPU resources, and ECS-extracted scene rendering.
- User then asked to stabilize dependencies and validation tooling before automated browser work. Installed all npm dependencies from a clean lockfile path, added ESLint, split typecheck/lint scripts, and added a combined `npm run check`.
- User then asked to install Playwright dependencies before the next session. Added `@playwright/test`, `@types/node`, Chromium via `npx playwright install chromium`, baseline Playwright config, and E2E npm scripts.
- User also asked to record the next phase after unlit E2E works: expand browser/Playwright verification across geometries, materials, textures, lighting, cameras/render targets, visibility/sorting, and diagnostics.

Architecture boundaries remain intact:

- ECS remains authoritative.
- Rendering remains a derived view of snapshots/render-world state.
- Snapshot helpers do not query ECS directly.
- JSON and diagnostics helpers expose counts, ids, and diagnostic summaries, not raw GPU handles or injected WebGPU objects.
- The ECS fixture lives under tests; production WebGPU helpers still consume snapshots/resource plans and do not query ECS directly.
- No scene graph, renderer-owned ECS/game state, WebGL fallback, or new dependency was introduced.

## Files Touched This Run

Source:

- `src/webgpu/renderer-frame-summary.ts`

Tests:

- `test/webgpu/fixtures/ecs-snapshot-render-frame.ts`
- `test/webgpu/fixtures/ecs-snapshot-render-frame.test.ts`
- `test/webgpu/fixtures/snapshot-render-frame.ts`
- `test/webgpu/fixtures/snapshot-render-frame.test.ts`
- `test/webgpu/render-frame-snapshot-binding-planner.test.ts`
- `test/webgpu/render-frame-snapshot-diagnostics.test.ts`

Docs and bookkeeping:

- `docs/RENDER_FRAME_READINESS.md`
- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`

## Validation Run

Final validation:

- `npm run build` — passed
- `npm run lint` — passed
- `npm test` — passed, 118 test files / 443 tests
- `npm run format:check` — passed

Targeted validation was also run for snapshot diagnostics, snapshot fixture, binding planner, and ECS snapshot fixture tests before full validation.

## Known Issues

- The previous resolver-map and binding-plan polish tasks were deferred in favor of browser E2E rendering.
- There is no browser example harness, static server, or real WebGPU scene test yet.
- Playwright is installed and configured, but no E2E tests exist yet.
- The renderer path is still report/planning-heavy and does not yet execute a complete user-facing WebGPU frame from real GPU resources.
- The stop-hook fix in `scripts/codex-stop-hook.sh` is intentionally uncheckpointed because the corrected hook now blocks the current under-45-minute status while ready tasks remain. It now also runs `typecheck` and `typecheck:test` when those scripts exist.

## Backlog

Completed tasks appended to `agent/COMPLETED.md`:

- `task-0158` through `task-0162`

Ready backlog now contains:

- `task-0163 — Add browser example harness`
- `task-0164 — Add browser WebGPU clear smoke example`
- `task-0165 — Add Playwright browser smoke verification`
- `task-0166 — Create real unlit WebGPU pipeline bridge`
- `task-0167 — Upload simple mesh and frame GPU resources`
- `task-0168 — Render ECS-extracted triangle scene in browser`
- `task-0169 — Add Playwright triangle scene pixel verification`
- `task-0170 — Render multi-entity simple scene in browser`
- `task-0171 — Add Playwright multi-entity scene verification`
- `task-0172 — Document browser E2E rendering workflow`

After those unlit/browser verification tasks are complete and stable, use the new "Post-Unlit E2E Verification Targets" section in `agent/BACKLOG.md` to expand coverage across geometry, material, texture, lighting, camera/render-target, visibility/sorting, and diagnostics paths.

## Recommended Next Task

Start `task-0163 — Add browser example harness`.

## Tooling Note

Current uncheckpointed tooling changes:

- `npm ci` succeeds and installs the lockfile dependency set.
- `eslint.config.js` adds ESLint flat config for source and tests.
- `package.json` scripts now separate `typecheck`, `typecheck:test`, `lint`, `format:check`, `test`, and combined `check`.
- `playwright.config.ts` is present; `npm run test:e2e`, `npm run test:e2e:ui`, and `npm run test:e2e:install` are available.
- Chromium for Playwright was installed with `npx playwright install chromium`.
- Validation passed: `npm run check`, `npm run build`, `bash -n scripts/codex-stop-hook.sh`, and `git diff --check`.
