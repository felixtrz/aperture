# Handoff - Racing Library Gap Slices

**Updated:** 2026-06-16 16:10 PDT

Current user-directed work is executing
`racing/docs/RACING_EXPERIENCE_LIBRARY_GAP_PLAN.md` in validated, committed
slices while keeping racing and Shadow Lab working.

## Latest Completed Slice

- Added a worker-authored `this.audio` control surface in
  `@aperture-engine/app/systems` for stable loops, loop updates/stops, and
  one-shot events that compile to `AudioEmitter` ECS/snapshot intent.
- Extended `AudioEmitter` authoring/extraction/packets with authored lowpass
  frequency/Q and updated `@aperture-engine/audio` voice management to compose
  authored lowpass with occlusion lowpass.
- Migrated racing's RPM/skid/impact model into
  `racing/src/systems/audio.system.ts` and deleted `racing/src/audio.ts`; the
  HUD no longer initializes a main-thread racing audio driver.
- Rebuilt `packages/render`, `packages/audio`, `packages/app`, racing, and
  shadow-lab bundles so workspace consumers and served modules resolve current
  package `dist`.
- Updated the racing plan and backlog for RACE-LIB-19, with the next suggested
  slice moving to camera-follow helper/readability work.

## Latest Validation

- `pnpm --filter @aperture-engine/audio run typecheck`
- `pnpm --filter @aperture-engine/audio run build`
- `pnpm --filter @aperture-engine/app run typecheck`
- `pnpm --filter @aperture-engine/app run build`
- `pnpm exec vitest run test/rendering/audio-emitter-extraction.test.ts test/audio/voice-manager.test.ts test/app/audio-access.test.ts test/app/audio-integration.test.ts`
- `pnpm --dir racing run typecheck`
- `pnpm --dir racing run build`
- `pnpm --dir shadow-lab run typecheck`
- `pnpm --dir shadow-lab run build`
- Cache-busted live probes with no-cache headers confirmed racing serves the
  current `src/systems/audio.system.ts`, `src/hud.ts` no longer contains
  `initRacingAudio`, deleted `src/audio.ts` is not served as stale JavaScript
  (Vite returns app HTML fallback), and racing/shadow-lab serve rebuilt
  `packages/app`, `packages/render`, and `packages/audio` dist modules.
- Aperture MCP `input_key` drove racing through the managed browser; status
  remained healthy with `webgpuOk:true`, `lastError:null`, `lastFailure:null`,
  automatic directional shadow submitted, and the generated systems list
  included `src/systems/audio.system.ts` at priority 127. Input was reset after
  the check.

## Current Notes

- Direct requests to deleted `racing/src/audio.ts` return the app HTML fallback
  from Vite with `Cache-Control: no-cache`, not stale old JavaScript. There are
  no live imports of that deleted module.
- Pre-existing untracked screenshot/parity artifacts remain outside the commit.

## Recommended Next Task

Continue with RACE-LIB-20: add a small reusable camera follow/control helper
and migrate racing's camera-follow system to it while preserving current camera
feel. This targets the next largest hard-to-read system after audio and should
be verified with racing typecheck/build, no-cache served-module probes, and
Aperture MCP runtime status/visual checks.

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
