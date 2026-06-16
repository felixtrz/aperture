# Handoff - Racing Library Gap Slices

**Updated:** 2026-06-16 14:43 PDT

Current user-directed work is executing
`racing/docs/RACING_EXPERIENCE_LIBRARY_GAP_PLAN.md` in validated, committed
slices while keeping racing and Shadow Lab working.

## Latest Completed Slice

- Added public GLTF instance lookup in `@aperture-engine/app/systems`:
  `this.gltf.node(root, name, filter?)` and `this.gltf.nodes(root, filter?)`.
- Surfaced structured diagnostics for inactive roots, empty names, missing
  nodes, and duplicate node names.
- Made the helper walk the fast `Children` index when present and fall back to
  authoritative `Parent` links so raw GLTF replay subtrees are covered.
- Migrated racing vehicle body/wheel lookup from an app-owned all-node query to
  `this.gltf`.
- Rebuilt package `dist` outputs and both experience production bundles.
- Updated the racing plan for RACE-LIB-14.

## Latest Validation

- `pnpm run build`
- `pnpm run typecheck:test`
- `pnpm exec vitest run test/app/gltf-instance-lookup.test.ts`
- `pnpm exec vitest run test/app/gltf-instance-lookup.test.ts test/app/hierarchy-accessor.test.ts test/app/trails.test.ts`
- `pnpm run typecheck && pnpm run build` in `racing/`
- `pnpm run typecheck && pnpm run build` in `shadow-lab/`
- No-cache HTTP probes against both running dev servers confirmed the served
  racing vehicle system uses `this.gltf` and the served shared package module
  contains the `Parent` fallback helper code.
- Aperture MCP `browser_status` for racing was running with `webgpuOk:true`,
  `lastError:null`, automatic directional shadow submitted, and restored
  non-null `wheelBL`/`wheelBR` vehicle resource values.

## Current Notes

- The racing console log history still contains earlier errors from the
  half-written helper placement and the pre-rebuild `this.gltf` migration, but
  the current MCP status is healthy after rebuilding package `dist`.
- Pre-existing untracked screenshot/parity artifacts remain outside the commit.

## Recommended Next Task

Continue Phase 4 with RACE-LIB-15: add spawn-time GLTF material/render-state
overrides, then migrate racing and shadow-lab off the global material registry
scan in `setup.system.ts`.

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
