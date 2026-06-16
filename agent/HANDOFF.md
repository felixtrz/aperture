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
