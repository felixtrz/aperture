# Handoff - Generated Resource Inspection And Racing Console Proof

**Updated:** 2026-06-16 18:32 PDT

Current user-directed work is executing
`racing/docs/RACING_EXPERIENCE_LIBRARY_GAP_PLAN.md` in validated, committed
slices while keeping racing and Shadow Lab working.

## Latest Completed Slice

- Added generic generated-worker resource inspection through
  `resource_get` in the devtools bridge, CLI dispatch, and MCP tool metadata.
  Calling it without an id lists initialized app resources; calling it with an
  id returns JSON-safe field metadata and values for that resource only.
- Added focused tests proving `resource_get` can list resources, read a concrete
  generated-worker resource by id, and return structured not-found diagnostics.
  The CLI MCP `tools/list` coverage now includes `resource_get`.
- Verified racing through Aperture tooling after a fresh reload. The alarming
  console particle attachment mismatch is old append-only browser history from
  the broken HDR particle pipeline session, not a current failure. After reload,
  the only fresh console warning is the non-fatal Rapier/WASM deprecated
  initialization signature warning.
- Reproved smoke with deterministic generated-worker controls: paused racing,
  set virtual `drive=[1,1]`, stepped fixed simulation until
  `racing.vehicle.driftIntensity` reached `0.8058`, then read the compact frame
  report. Frame 1092 reported `ok:true`, `counts.particleEmitters:2`,
  `particles.liveParticles:6`, `particles.texturedEmitters:2`, and diagnostics
  `[]`. Inputs were reset and ECS was resumed afterward.
- Confirmed the existing HDR particle regression test still passes: particles
  under an HDR scene pass build the `rgba16float` pipeline variant rather than
  the old `bgra8unorm` swapchain variant.

## Latest Validation

- `pnpm exec prettier --write packages/app/src/worker/devtools/bridge.ts packages/cli/src/tools/dispatch.ts packages/cli/src/mcp.ts test/app/generated-worker-start.test.ts test/cli/dev-session.test.ts`
- `pnpm exec vitest run test/app/generated-worker-start.test.ts test/cli/dev-session.test.ts`
- `git diff --check`
- `pnpm --filter @aperture-engine/app run typecheck`
- `pnpm --filter @aperture-engine/cli run typecheck`
- `pnpm --filter @aperture-engine/app run build`
- `pnpm --filter @aperture-engine/cli run build`
- `pnpm exec vitest run test/webgpu/particle-frame-resources.test.ts`
- `pnpm --dir racing run typecheck`
- `pnpm --dir racing run build`
- `pnpm --dir shadow-lab run typecheck`
- `pnpm --dir shadow-lab run build`
- Managed Aperture racing proof described above. `pnpm exec aperture mcp stdio`
  was also used to prove a fresh rebuilt MCP server advertises and serves
  `resource_get`, because this Codex session's already-loaded MCP metadata did
  not expose the new tool name.

## Current Notes

- The managed racing app is running at `http://127.0.0.1:5173/` and was left
  resumed with inputs reset.
- Shadow Lab remains alive at `http://127.0.0.1:8861/`; it was validated by
  typecheck/build during this slice and was not restarted.
- The active Codex MCP tool list may remain stale until the session reconnects.
  The rebuilt CLI/MCP server itself has `resource_get`, proven through
  `pnpm exec aperture tool resource_get ...` and `pnpm exec aperture mcp stdio`.
- Racing console history still contains old WebGPU particle validation spam and
  a worker-transport error from earlier broken sessions. After the fresh
  2026-06-17T01:28:42Z reload and the smoke proof, no new particle/WebGPU
  attachment warnings appeared.
- Pre-existing untracked screenshot/parity artifacts remain outside the commit.

## Recommended Next Task

Add a typed generated signal subscription API for browser/HUD consumers and
migrate racing HUD reads to it. This should be generic browser runtime
orchestration, not a racing-specific status parser: diagnostics status remains
for tools, while app UI should receive stable signal snapshots/events.

---

## Previous Completed Slice

- Fixed hierarchical render interpolation in `@aperture-engine/app` so opted-in
  child objects compose against interpolated parent transforms instead of
  current-tick parent transforms. The user confirmed racing's staggered car body
  and wheel motion is fixed.
- Tightened GLTF node lookup so authored node queries exclude hidden primitive
  render children, keeping app-facing lookup behavior aligned with authored GLTF
  scene nodes.
- Fixed the Shadow Lab three.js comparison orbit camera to orbit at the authored
  camera offset distance instead of panning-like motion from a hardcoded radius.
- Fixed WebGPU frame routes so particle emitters are prepared, submitted, and
  reported in queued built-in, mixed custom WGSL, and custom WGSL render paths.
  The bug was route-level: racing emitted particles, but the queued route did
  not append particle commands/reports.
- Fixed the HDR scene-pass format bug exposed by racing smoke: particle
  pipelines were keyed from the swapchain format (`bgra8unorm`) while the HDR
  scene pass expected `rgba16float`, causing WebGPU attachment-state validation
  errors and invalid command-buffer submits when smoke emitted. Added a shared
  scene-pass color-format helper and migrated particles, sprites, text, UI,
  skybox, and custom WGSL frame helpers to use the scene target format.
- Added a mesh to the content-showcase example so its smoke-particle check
  exercises the queued built-in route rather than only the sprite-only route.
- Added an inline empty favicon to racing's HTML so reloads do not add a red
  `/favicon.ico` 404 to the browser console.
- Updated the racing library-gap plan with a genericity audit for the landed
  app/library work.

## Previous Validation

- `pnpm exec prettier --write packages/webgpu/src/app/queued-built-in-frame.ts packages/webgpu/src/app/mixed-custom-wgsl-frame.ts packages/webgpu/src/app/custom-wgsl-frame.ts examples/content-showcase-scene.js examples/content-showcase.worker.js test/e2e/content-showcase.spec.ts`
- `pnpm exec vitest run test/app/fixed-step-app.test.ts test/app/gltf-instance-lookup.test.ts`
- `pnpm --filter @aperture-engine/app run typecheck`
- `pnpm --filter @aperture-engine/app run build`
- `pnpm --filter @aperture-engine/cli run typecheck`
- `pnpm --filter @aperture-engine/cli run build`
- `pnpm --filter @aperture-engine/webgpu run typecheck`
- `pnpm --filter @aperture-engine/webgpu run build`
- `pnpm exec vitest run test/webgpu/particle-frame-resources.test.ts test/webgpu/particle-pipeline.test.ts`
- `pnpm exec prettier --write packages/webgpu/src/app/render-color-format.ts packages/webgpu/src/app/particles.ts packages/webgpu/src/app/sprites.ts packages/webgpu/src/app/text.ts packages/webgpu/src/app/ui.ts packages/webgpu/src/app/skybox.ts packages/webgpu/src/app/custom-wgsl-frame.ts packages/webgpu/src/app/mixed-custom-wgsl-frame.ts test/webgpu/particle-frame-resources.test.ts`
- `pnpm run typecheck:test`
- `pnpm --dir racing run typecheck`
- `pnpm --dir racing run build`
- `pnpm --dir racing run build` after the favicon HTML cleanup
- `pnpm --dir shadow-lab run typecheck`
- `pnpm --dir shadow-lab run build`
- Managed racing was restarted with
  `pnpm exec aperture dev up --open --host 127.0.0.1 --port 5173`; Aperture MCP
  `browser_wait_for_webgpu` passed with WebGPU/assets/systems ready.
- Robust particle proof used only Aperture MCP after the HDR format fix:
  restarted managed racing, focused the canvas, paused ECS, held `KeyW` and
  `KeyD`, stepped deterministic fixed updates until
  `racing.vehicle.driftIntensity` reached `0.758`, then read snapshot/frame
  reports while smoke was active. Snapshot frame 3367 reported
  `counts.particleEmitters:2` and diagnostics `0`. Frame report frame 3367
  reported `ok:true`, `summary.particles.emitters:2`, `liveParticles:6`,
  `texturedEmitters:2`, `statesCreated:2`, `textureResourcesCreated:1`,
  diagnostics `[]`, plus bloom/tonemap post effects. Console logs after the
  restarted fixed session showed no new particle attachment-state errors; the
  remaining WebGPU warnings are timestamped before the restart.
- Inputs were reset and ECS resumed after the paused particle proof.

## Previous Notes

- `pnpm exec playwright test test/e2e/content-showcase.spec.ts --reporter=line`
  was started after the content-showcase queued-route coverage change but
  produced no useful output for more than two minutes and was interrupted. Treat
  that specific e2e validation as not completed until rerun/debugged.
- Racing is running at `http://127.0.0.1:5173/` through the managed Aperture dev
  session. Shadow Lab was not restarted or disturbed during the particle proof.
- The current racing console still contains old append-only WebGPU validation
  logs from the broken session. After the favicon cleanup/reload there is no
  fresh 404 entry; runtime status is healthy: `webgpuOk:true`,
  `lastError:null`, `lastFailure:null`.
- Pre-existing untracked screenshot/parity artifacts remain outside the commit.

## Previous Recommended Next Task

Either rerun/debug the content-showcase Playwright smoke proof for the queued
particle route, or continue RACE-LIB-20 by adding a reusable app-level camera
follow/control helper and migrating racing's camera-follow system to it while
preserving current camera feel.

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
