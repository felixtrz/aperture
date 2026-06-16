# Handoff - Racing Library Gap Slices

**Updated:** 2026-06-16 15:39 PDT

Current user-directed work is executing
`racing/docs/RACING_EXPERIENCE_LIBRARY_GAP_PLAN.md` in validated, committed
slices while keeping racing and Shadow Lab working.

## Latest Completed Slice

- Added a public `@aperture-engine/audio` sound board API for named clip
  preload/decode/cache, first-gesture startup, loop voices, one-shots,
  gain/playback-rate automation, lowpass filters, mixer routing, and teardown.
- Migrated `racing/src/audio.ts` to use the sound board API. Racing still owns
  the vehicle-specific RPM/skid/impact model, but no longer creates raw Web
  Audio nodes or owns clip fetch/decode/teardown.
- Rebuilt `packages/audio/dist` so workspace consumers and Vite served-module
  imports resolve the new exports.
- Rebuilt both experience production bundles.
- Updated the racing plan for RACE-LIB-18 and moved the next recommendation to
  worker-authored audio intent.

## Latest Validation

- `pnpm --filter @aperture-engine/audio run typecheck`
- `pnpm --filter @aperture-engine/audio run build`
- `pnpm exec vitest run test/audio/sound-board.test.ts`
- `pnpm --dir racing run typecheck && pnpm --dir racing run build`
- `pnpm --dir shadow-lab run typecheck && pnpm --dir shadow-lab run build`
- Cache-busted live probes confirmed racing serves updated `src/audio.ts`,
  `packages/audio/dist/index.js`, and `packages/audio/dist/sound-board.js`
  with `Cache-Control: no-cache`, and the new sound board exports are present.
- Aperture MCP `input_key` triggered a harmless keyboard gesture so the new
  audio startup path executed; `browser_status` remained healthy with
  `webgpuOk:true`, `lastError:null`, `lastFailure:null`, and automatic
  directional shadow submitted.
- Shadow-lab `pnpm exec aperture dev status` reported daemon/server/browser
  running and bridge available on `http://127.0.0.1:8861/`; cache-busted source
  probes confirmed its decoration source stayed updated.

## Current Notes

- The racing console log history still contains earlier errors from the
  half-written helper placement, the pre-rebuild `this.gltf` migration, and a
  transient page error from before `packages/audio/dist` was rebuilt. Current
  MCP status is healthy after rebuilding package `dist`.
- Shadow-lab browser logs also contain earlier transient errors from prior
  render work; current dev status is alive and source probes/builds are clean.
- Pre-existing untracked screenshot/parity artifacts remain outside the commit.

## Recommended Next Task

Continue with RACE-LIB-19: move racing vehicle audio intent to a worker-authored
Aperture audio control surface. The new sound board removed raw Web Audio node
ownership from racing, but `src/audio.ts` still runs the vehicle audio model on
the main thread; the V1 direction is for worker systems to author loop/one-shot
audio intent while Aperture owns browser realization.

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
