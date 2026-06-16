# Handoff - Racing Library Gap Slices

**Updated:** 2026-06-16 15:03 PDT

Current user-directed work is executing
`racing/docs/RACING_EXPERIENCE_LIBRARY_GAP_PLAN.md` in validated, committed
slices while keeping racing and Shadow Lab working.

## Latest Completed Slice

- Added spawn-time GLTF material/render-state overrides to
  `this.spawn.gltf(...)` through `materials.renderState`.
- Implemented the override path by cloning/reusing patched source material
  assets keyed by source material plus override hash, then retargeting the
  spawned subtree `Material` components. Source GLTF materials are not mutated.
- Migrated racing and shadow-lab GLTF spawns to request `cullMode: "back"`
  through the public spawn API.
- Removed the global ready-material registry scans from both setup systems.
- Rebuilt package `dist` outputs and both experience production bundles.
- Updated the racing plan for RACE-LIB-15.

## Latest Validation

- `pnpm run build`
- `pnpm run typecheck:test`
- `pnpm exec tsc -p packages/app/tsconfig.json --noEmit --pretty false`
- `pnpm exec vitest run test/app/developer-api.test.ts --testNamePattern "spawn-time GLB material"`
- `pnpm exec vitest run test/app/developer-api.test.ts test/app/gltf-instance-lookup.test.ts`
- `pnpm run check:progress`
- `pnpm run typecheck && pnpm run build` in `racing/`
- `pnpm run typecheck && pnpm run build` in `shadow-lab/`
- No-cache HTTP probes against both running dev servers confirmed the served
  racing/shadow-lab systems use `materials: GLTF_FRONT_SIDE_MATERIALS`, no
  active system uses the old global material scan path, and both apps serve the
  same rebuilt shared `spawn/gltf.js` helper with `materialOverrideKey(...)`.
- Aperture MCP `browser_status` for racing was running with `webgpuOk:true`,
  `lastError:null`, automatic directional shadow submitted, compact shared
  `:override:` material assets, and non-null `wheelBL`/`wheelBR` vehicle
  resource values.
- Racing screenshot captured at
  `racing/.aperture/runtime/race-lib-15-gltf-material-overrides-shared.png`.
- Shadow-lab `pnpm exec aperture dev status` reported daemon/server/browser
  running and bridge available on `http://127.0.0.1:8861/`.

## Current Notes

- The racing console log history still contains earlier errors from the
  half-written helper placement and the pre-rebuild `this.gltf` migration, but
  the current MCP status is healthy after rebuilding package `dist`.
- Shadow-lab browser logs also contain earlier transient errors from prior
  render work; current dev status is alive and source probes/builds are clean.
- Pre-existing untracked screenshot/parity artifacts remain outside the commit.

## Recommended Next Task

Continue Phase 4 with RACE-LIB-16: add a batch/instanced GLTF spawn helper for
repeated static imported assets, then migrate racing/shadow-lab decoration
buckets only if it reduces active system boilerplate without changing placement
or visual output.

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
