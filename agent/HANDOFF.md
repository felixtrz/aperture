# Handoff - Starter Kit FPS HUD Feedback Slice

**Updated:** 2026-06-16 23:21 PDT

User-directed work is now on branch `fps-starter-kit-port`, created from the
previous working state so the old state remains recoverable.

## Latest Completed Slice

- Added HUD feedback for the Starter Kit FPS port:
  - `damagePulse` is now an Aperture signal driven by enemy physics-LOS damage.
  - The browser HUD flashes a red damage overlay and pulses the health meter
    when damage lands.
  - Crosshair hit feedback pulses when the ECS hit count increases.
  - Low health now gets a distinct HUD color treatment.
- Preserved the previous physics/raycast slice:
  - ECS-authored `player.body` kinematic capsule movement uses
    `physics.moveCharacter(...)`.
  - Shooting uses Aperture `physics.raycastAll(...)` and enemy attacks require
    physics line of sight to the player capsule.
  - Muzzle/impact sprite assets and ECS-authored shot effect sprites are in
    place.
  - Top-level `aperture tool physics_*` commands route to generated worker
    physics devtools.
- Re-exported `serializeEntityRef` from `@aperture-engine/app/systems` so app
  systems can use keyed ECS entities with physics devtools/backend refs without
  importing lower-level package internals.
- Committed:
  - `aaa83107` — `Port Starter Kit FPS slice to Aperture`
  - `37bc0e5e` — `Add FPS pointer lock look bridge`
  - `bd85c5e4` — `Add FPS physics character and raycast gameplay`
  - `4f44aa73` — `Add FPS HUD damage and hit feedback`

## Latest Validation

- `pnpm --dir fps run typecheck`
- `pnpm --dir fps run build`
- Aperture CLI runtime proof from `fps/`:
  - `browser_wait_for_webgpu` succeeded against managed FPS at
    `http://127.0.0.1:5174/`.
  - After reset/resume with enemy line of sight, `browser_status` signals read
    `health:90` and `damagePulse:2`.
  - After repeated queued look input and one shot, `fps.state` read
    `yaw:-0.5416666666666666`, `pitch:0.1625`, `shotsFired:1`, `hits:3`, and
    `enemy.0` health `25`.
- `pnpm --dir racing run typecheck`
- `pnpm --dir racing run build`
- `pnpm --dir shadow-lab run typecheck`
- `pnpm --dir shadow-lab run build`
- Previous physics slice validation:
- `pnpm run typecheck` from repo root
- `pnpm run typecheck:test` from repo root
- `pnpm --filter @aperture-engine/app typecheck && pnpm --filter @aperture-engine/app build`
- `pnpm --filter @aperture-engine/cli typecheck && pnpm --filter @aperture-engine/cli build`
- `pnpm --filter @aperture-engine/render typecheck && pnpm --filter @aperture-engine/render build`
- `pnpm run typecheck && pnpm run build` from `fps/`
- `pnpm run typecheck && pnpm run build` from `racing/`
- `pnpm run typecheck && pnpm run build` from `shadow-lab/`
- Aperture CLI runtime proof from `fps/`:
  - Restarted managed dev at `http://127.0.0.1:5174/`.
  - `browser_status` reported `status:"running"`, `webgpuOk:true`, no
    `lastError`/`lastFailure`.
  - `asset_list` reported FPS GLTF/audio/texture assets ready, including
    `muzzle-burst` and `impact-hit`.
  - `render_get_diagnostics` reported no worker failure, no frame diagnostics,
    and no last render error.
  - `physics_summary` reported Rapier `simulation-worker`, 18 bodies, 18
    colliders, and 0 unsupported features.
  - `ecs_find_entities` confirmed `player.body` has `RigidBody`,
    `Collider`, `KinematicTarget`, `PhysicsVelocity`,
    `PhysicsCharacterController`, and `PhysicsBodyState`.
  - `physics_move_character` on `player.body` returned grounded movement and a
    target translation through Rapier.
  - `physics_raycast_all` from the player eye toward `enemy.0` hit
    `enemy.0.hitbox` first.
  - Stepped input proof aimed at `enemy.0`, fired once, and read `fps.state`:
    `shotsFired:1`, `hits:3`, `enemy.0` health `100 -> 25`.
  - `browser_screenshot` wrote
    `fps/.aperture/runtime/fps-physics-raycast-proof.png`.

## Current Notes

- Managed FPS is running at `http://127.0.0.1:5174/` through Aperture dev.
- Pre-existing untracked screenshots,
  racing parity artifacts, and `racing/parity/` remain outside commits.
- Use `value:0` rather than `pressed:false` for button-release CLI scripts when
  an immediate following `ecs_step` proof must be unambiguous.
- For held look input through the CLI, queue `input_action_set` with `x`/`y`
  before each `ecs_step`; a single vector input is consumed by one frame.
- `render_readback_samples` / `browser_pick_pixel` still need follow-up if
  future FPS proofs require pixel samples; screenshot capture is reliable.

## Recommended Next Task

Continue the FPS port with another visible gameplay slice: add enemy
destroy/respawn/end-state feedback or animate the muzzle/impact sprite sheets,
then prove the result through Aperture CLI runtime tools while keeping racing
and Shadow Lab typecheck/build green.

---

# Handoff - Racing Library-Gap Plan Complete

**Updated:** 2026-06-16 21:56 PDT

Current user-directed work executed
`racing/docs/RACING_EXPERIENCE_LIBRARY_GAP_PLAN.md` in validated, committed
slices while keeping racing and Shadow Lab working. The plan is complete for
this pass.

## Latest Completed Slice

- Finished the final no-cache racing verification slice after the post-port
  genericity cleanup commit.
- Stopped the racing managed dev session, removed `racing/node_modules/.vite`,
  and relaunched racing with
  `pnpm exec aperture dev up --open --host 127.0.0.1 --port 5173`.
- Verified fresh racing runtime through Aperture MCP: managed browser running
  on `127.0.0.1:5173` / CDP `6173`, `webgpuOk:true`, no
  `lastError`/`lastFailure`, submitted directional shadows, clean baseline
  render snapshot, and console tail with only Vite logs plus the known
  deprecated-parameter warning.
- Proved fresh-session smoke/HUD by pausing ECS, applying `drive=[1,1]`,
  resuming briefly, pausing, and reading MCP status:
  `particleEmitters:306`, `liveParticles:906`, `texturedEmitters:306`,
  `diagnostics:0`, `started:true`, `throttle:1`, `speed:0.937`, and
  `driftIntensity:1.057`.
- Verified Shadow Lab stayed isolated on its own Aperture session at
  `127.0.0.1:8861` / CDP `9861`; typecheck/build still pass.

## Latest Validation

- `pnpm --dir racing run typecheck`
- `pnpm --dir racing run build`
- `pnpm --dir shadow-lab run typecheck`
- `pnpm --dir shadow-lab run build`
- `pnpm exec aperture dev down` from `racing/`
- `rm -rf racing/node_modules/.vite`
- `pnpm exec aperture dev up --open --host 127.0.0.1 --port 5173` from
  `racing/`
- Aperture MCP `browser_status`, `browser_console_logs`,
  `render_get_snapshot_summary`, `input_reset`, `ecs_pause`,
  `input_action_set`, and `ecs_resume` for the racing proof described above.
- `pnpm exec aperture dev status` from `shadow-lab/` confirmed Shadow Lab's
  separate managed session remained alive on `127.0.0.1:8861` / CDP `9861`.

## Current Notes

- Managed racing is running at `http://127.0.0.1:5173/` through Aperture dev
  and was left resumed after the fresh no-cache smoke proof with virtual inputs
  reset.
- Shadow Lab remains alive at `http://127.0.0.1:8861/`; it was not restarted or
  attached through racing's MCP tools.
- Pre-existing untracked screenshot/parity artifacts remain outside the commit.

## Recommended Next Task

Return to the broader visible-feature queue. The first ready task is
`task-3097 — Replace placeholder PMREM with GGX/VNDF prefilter sampling`
anchored to `references/three.js/src/extras/PMREMGenerator.js` and
`references/engine/src/scene/graphics/reproject-texture.js`.

---

# Handoff - Generated Audio Unlock Startup

**Updated:** 2026-06-16 19:06 PDT

Current user-directed work is executing
`racing/docs/RACING_EXPERIENCE_LIBRARY_GAP_PLAN.md` in validated, committed
slices while keeping racing and Shadow Lab working.

## Latest Completed Slice

- Hardened `@aperture-engine/audio` voice realization so snapshot-authored
  playback intent is distinct from Web Audio source starts. While the backend is
  suspended, voices can track loop/one-shot epochs, but buffer sources and
  streaming sources are not created or started.
- Autoplay loops now start after `unlock()`/resume when the backend is running.
  Pre-unlock one-shot epoch bumps are treated as stale and dropped; fresh
  post-unlock one-shots still play. Running-context ducking still responds to
  pending decode intent, preserving existing mixer behavior.
- Added engine-level tests for initially suspended autoplay loops and stale
  pre-unlock one-shot suppression, plus generated-browser integration coverage
  proving `installGeneratedAudio(...)` keeps worker-authored loop intent silent
  until unlock.
- Rebuilt `@aperture-engine/audio` and `@aperture-engine/app`, then restarted
  only racing through Aperture after clearing `racing/node_modules/.vite`.
  Shadow Lab stayed on its existing `8861` managed session.
- Fresh racing console after the cold-cache relaunch had no new
  `AudioContext was not allowed to start` warning. Held `KeyW` + `KeyA` through
  Aperture input tooling and reproved smoke at `emitters:306`,
  `liveParticles:906`, `texturedEmitters:306`, with no runtime
  `lastError`/`lastFailure`.

## Latest Validation

- `pnpm exec vitest run test/audio/resume.test.ts test/app/audio-integration.test.ts`
- `pnpm exec vitest run test/audio/voice-manager.test.ts test/audio/streaming.test.ts test/audio/fixes.test.ts`
- `pnpm exec vitest run test/audio`
- `pnpm --filter @aperture-engine/audio run typecheck`
- `pnpm --filter @aperture-engine/audio run build`
- `pnpm --filter @aperture-engine/app run typecheck`
- `pnpm --filter @aperture-engine/app run build`
- `pnpm --dir racing run typecheck`
- `pnpm --dir racing run build`
- `pnpm --dir shadow-lab run typecheck`
- `pnpm --dir shadow-lab run build`
- Managed Aperture racing proof described above: `dev down`, cache clear,
  `dev up --open --host 127.0.0.1 --port 5173`, WebGPU wait, console tail,
  held-input smoke proof, post-drive status.
- Managed Shadow Lab proof: existing session reported `running`,
  `webgpuOk:true`, `lastError:null`, `lastFailure:null`; console tail only had
  Vite connection logs.

## Current Notes

- The managed racing app is running at `http://127.0.0.1:5173/` and was left
  resumed after a cache-busted restart. Inputs were released after the live
  smoke check.
- Shadow Lab remains alive at `http://127.0.0.1:8861/`; it was validated by
  typecheck/build and by runtime status during this slice and was not restarted.
- Racing console history still contains older `AudioContext was not allowed`
  warnings and one older worker transport error, but no new AudioContext warning
  appeared after the cold-cache restart or the held-input proof.
- Pre-existing untracked screenshot/parity artifacts remain outside the commit.

## Recommended Next Task

Add worker-safe audio loop lifecycle controls and automation descriptors so
systems can pause/resume stable loops and schedule generic gain/rate/filter
ramps without exposing Web Audio nodes or adding browser-side app audio code.

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
