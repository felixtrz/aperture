# Handoff - Racing Library Gap Slices

**Updated:** 2026-06-16 14:22 PDT

Current user-directed work is executing
`racing/docs/RACING_EXPERIENCE_LIBRARY_GAP_PLAN.md` in validated, committed
slices while keeping racing and Shadow Lab working.

## Latest Completed Slice

- Wired material depth bias / polygon offset through built-in material pipeline
  keys, WebGPU depth-stencil descriptors, and render pipeline cache keys.
- Exposed `depthBias` and `depthBiasSlopeScale` on
  `this.trails.groundRibbon(...)`.
- Migrated racing drift marks to request `depthBias: -2` through the shared
  trail helper.
- Updated the racing plan and public tracker pages for RACE-LIB-13.

## Latest Validation

- `pnpm exec tsc -b packages/render packages/webgpu packages/app --pretty false`
- `pnpm exec tsc --noEmit -p tsconfig.test.json --pretty false`
- `pnpm exec vitest run test/app/trails.test.ts test/webgpu/material-render-state.test.ts test/materials/key-format-contract.test.ts test/webgpu/unlit-pipeline-descriptor.test.ts test/webgpu/pipeline-cache.test.ts`
- `pnpm run check:progress`
- `git diff --check`
- `pnpm run build`
- `pnpm run typecheck && pnpm run build` in `racing/`
- `pnpm run typecheck && pnpm run build` in `shadow-lab/`
- No-cache HTTP probes against both running dev servers confirmed the served
  shared package modules contain the updated depth-bias code.
- Aperture MCP `browser_status` for racing was running with `webgpuOk:true`,
  `lastError:null`, and prepared drift material pipeline key
  `unlit|depth-bias:-2:0|blend|none|less|alpha`.

## Current Notes

- The racing console log history still contains earlier errors from the
  half-written helper placement before this slice was fixed, but the current
  MCP status is healthy.
- Pre-existing untracked screenshot/parity artifacts remain outside the commit.

## Recommended Next Task

Continue the racing library-gap plan with the next non-render-state slice:
audio runtime ergonomics, GLTF spawn/material override ergonomics, or cleanup of
inactive racing setup variants.

---

# Handoff - Shadow Lab Fixed-Step Render Interpolation

**Updated:** 2026-06-15 22:03 PDT

This run completed the user-directed Shadow Lab/racing parity slice for
fixed-step migration fallout and GLB front-side culling parity.

## Completed

- Added priority-aware fixed-step task registration in
  `@aperture-engine/runtime`, preserving insertion order for equal priorities.
- Added the app-level `fixedUpdate(context)` hook so systems can declare
  deterministic fixed-step work without manual disposer boilerplate.
- Added opt-in `RenderInterpolation` ECS state and app-side snapshot
  interpolation for presentation-only smoothing of mesh transforms and camera
  view matrices between fixed ticks.
- Migrated the racing vehicle and camera systems to `fixedUpdate(context)`.
- Fixed wheel spin to scale by fixed delta while preserving the prior 60 Hz
  feel, and removed misleading fixed-step `dt` clamps.
- Added material patch support for render-state updates and forced imported GLB
  materials in Shadow Lab/racing through `cullMode: "back"` so Aperture matches
  three.js `FrontSide` behavior unless a source material opts into
  double-sided/no-cull.
- Updated architecture, decision, dashboard, and render-pipeline tracker docs.

## Validation Run

- `pnpm exec vitest run test/runtime/fixed-step-schedule.test.ts test/app/fixed-step-app.test.ts`
  passed with 2 test files and 8 tests.
- `pnpm run build` passed.
- `pnpm run typecheck:test` passed.
- `pnpm run check:boundaries` passed.
- `pnpm run check:doc-paths` passed.
- `pnpm run check:progress` passed.
- `pnpm run typecheck` passed in `shadow-lab/`.
- `pnpm run typecheck` passed in `racing/`.
- Targeted `pnpm exec eslint ...` over changed root TypeScript files passed.
  The root ESLint config ignores the changed app project files, so those are
  covered by their app typechecks.
- Targeted `pnpm exec prettier --check ...` over changed files passed.
- Aperture MCP browser status was `running` with `lastError:null`; a no-reload
  screenshot was captured at
  `shadow-lab/.aperture/runtime/current-fixedupdate-render-interpolation-culling.png`.

## Known Issues

- Full `pnpm run format:check` still fails on pre-existing formatting drift in
  many untouched files.
- Full `pnpm run lint` still fails on pre-existing vendored Shadow Lab
  three.js/compat-rule lint issues after the local unused import was fixed.
- Render interpolation currently covers opted-in `LocalTransform` hierarchies
  and camera view matrices. Future shared-buffer publication may want the same
  presentation-only rewrite closer to packed snapshot transport.

## Recommended Next Task

Continue Shadow Lab parity by comparing the remaining StandardMaterial shader
variant/resource behavior against three.js with the same side-by-side scene,
especially bloom intensity, shadow filtering, and any residual imported material
differences now that fixed-step cadence and GLB culling parity are corrected.
