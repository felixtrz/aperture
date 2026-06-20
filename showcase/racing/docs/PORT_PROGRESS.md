# Racing Port — Progress & Context Dump

Port of `references/Starter-Kit-Racing` (three.js + crashcat) to Aperture as a
release proof-point. Goal: **full function + rendering parity**; patch library
gaps in `packages/` as discovered; document everything. Do not stop until parity.

## Repo layout

- `/Users/felixz/Projects/aperture` — engine monorepo (`packages/*`).
- `references/Starter-Kit-Racing` — the reference app. Every `js/*.js` has been read.
  `screenshot.png` there is the **visual parity target**.
- `racing/` — the port. Scaffolded with `aperture create racing --template game`,
  then app content moved in. Uses **fresh built tgz** deps (see below).
- `racing-backup/` — earlier hand-rolled version (kept as backup; ignore for work).

## Dependency model (important)

`racing/` is an **isolated** project (`racing/pnpm-workspace.yaml` = `packages: []`)
that consumes the engine as built tarballs, simulating an external consumer:

- `racing/vendor/*.tgz` — 10 packed packages.
- `racing/package.json` deps + `pnpm.overrides` map every `@aperture-engine/*` to
  its `file:vendor/*.tgz`.

**Rebuild loop after editing `packages/`:**

```
cd /Users/felixz/Projects/aperture && pnpm run build
( cd packages/<changed> && pnpm pack --pack-destination /Users/felixz/Projects/aperture/racing/vendor )
cd racing && pnpm install --force
node_modules/.bin/aperture dev down && node_modules/.bin/aperture dev up --open --port 8852
```

Repack every package you changed (app/webgpu/render/physics/cli are the ones touched).

## How Aperture apps work (architecture)

- App = `aperture.config.ts` + `src/systems/**/*.system.ts` + `index.html` + `src/hud.ts`.
- Runs split: **simulation worker** (ECS + systems) ↔ **main thread** (WebGPU render,
  input, audio). The Vite plugin (`ai: { mode: "agent" }`) generates the bootstrap.
- Systems: `createSystem({ priority, queries, config })`; in a system use
  `this.spawn.{camera,light,mesh,gltf,physics,fog}`, `this.physics`, `this.actions`,
  `this.signals`, `this.assets.gltf(id)`, `this.queries.X.entities`.
- Physics writes back each step to `LocalTransform` (pose) and `PhysicsVelocity`
  (lin/ang). Writing `LocalTransform` teleports a body.
- Cross-system intra-worker data: module singleton (`src/lib/vehicle-state.ts`),
  mirroring how the reference passes its `vehicle` object around.
- Worker→DOM HUD: config `signals` read on the main thread via
  `readGeneratedBrowserAppStatus()` (`src/hud.ts`).

## Library patches made so far (in `packages/`, built + repacked)

1. **Physics enablement in generated apps** — `config.physics` field
   (`packages/app/src/config/index.ts` `AperturePhysicsAppConfig`), validated in
   `config/validation.ts`, threaded through `packages/app/src/worker/loop.ts`
   (`resolveConfigPhysicsOption`) into `createApertureApp({ physics })`.
   (`createApertureApp` already supported physics; it just wasn't wired from config.)
2. **Shadows on the spawn facade** — `spawn.light({ shadow })`,
   `spawn.mesh/gltf({ castShadow, receiveShadow })` attach
   `LightShadowSettings`/`ShadowCaster`/`ShadowReceiver`.
   (`packages/app/src/systems/spawn/{commands,types,index}.ts`, re-exported in `systems.ts`.)
3. **Fog on the spawn facade** — `spawn.fog({ mode, color, start, end, density })`
   → `Fog` component.
4. **Tonemap/exposure/bloom in render config** — `ApertureRenderDefaults.{tonemap,
exposure, bloom}` threaded through `packages/app/src/browser/app.ts` into
   `createWebGpuApp({ tonemap, exposure, postEffects:[bloom] })`. Engine default
   tonemap was `"none"`; ACES/AgX/Neutral/Reinhard all exist.
5. **WGSL shader bug fix** —
   `packages/webgpu/src/materials/standard/standard-shader-extension-sampling.ts`:
   the fog block reassigned `let color` (immutable) — invalid WGSL **when shadows
   are also enabled** (shadow path keeps `color` a `let`). Now uses a fresh
   `let foggedColor`. Was the cause of an all-black screen with shadows+fog+HDR.
6. **`PhysicsAccess.getLinearVelocity/getAngularVelocity`**
   (`packages/app/src/systems/physics.ts`) — read written-back `PhysicsVelocity`
   so app code (vehicle drive) doesn't need a direct physics dep.
7. **CLI managed-browser launch = real Chrome, anti-throttle flags**
   (`packages/cli/src/dev/browser.ts`) — launches the user's installed **Google
   Chrome** via Playwright `channel: "chrome"` (NOT the bundled Chromium) and drops
   `--enable-unsafe-webgpu` + `--use-angle=metal`. The bundled Chromium + unsafe-webgpu
   intermittently selected the **software (SwiftShader) fallback adapter** → full-screen
   **magenta** on ~half of reloads; stock Chrome uses the hardware Metal adapter and
   never does this (matches the user's own browser). Kept the benign anti-throttle flags
   (`--disable-features=CalculateNativeWinOcclusion` + backgrounding/timer flags) so
   occluded-window WebGPU readback (screenshots) doesn't blank/freeze.

8. **ECS entity-capacity default raised** (`packages/simulation/src/ecs/index.ts`) —
   `createWorld` now defaults `entityCapacity` to `DEFAULT_ENTITY_CAPACITY = 16384`
   (was elics' fixed default 1000). elics allocates each component column densely at
   `entityCapacity` with NO growth, so a ~1000+ entity scene (track + ~115 decoration
   gltfs, each expanding to several entities) crashed with `gltfEcsReplay.component
ApplyFailed: offset is out of bounds`. Overridable via `worldOptions.entityCapacity`
   (threaded from `options.start.entityCapacity` in `worker/loop.ts`). Deeper fix: elics
   should grow dynamically / emit a clear capacity diagnostic; expose `entityCapacity` in
   the public app config.

Still TODO: add changesets under `.changeset/` for each patch; write a
PATCHES.md; consider a real `LightKind.Hemisphere` (needed for matte road-fill parity —
the flat `kind:"ambient"` stand-in under-fills the road so the sun highlight reads as
sheen; engine has Ambient/Environment/Directional/Point/Spot/RectArea, no Hemisphere).

## App state (racing/)

- **config**: 11 gltf assets; signals `lap,currentLapTime,lastLapTime,bestLapTime,
speed,started`; input `drive` (axis2d: WASD/arrows + gamepad stick); physics
  gravity `[0,-9.81,0]`; render clearColor `0xadb2ba`, defaultCamera/Light false,
  sampleCount 4, tonemap `aces`, exposure 1.0, bloom `{threshold .5, intensity .02, radius .02, levels 5}`.
- **src/lib**: `math.ts` (quat/scalar helpers), `track.ts` (TRACK_CELLS, DECO_CELLS,
  NPC_TRUCKS, CELL_RAW 9.99, GRID_SCALE 0.75, codec, spawn/bounds, decoration buckets),
  `tuning.ts` (constants), `physics-colliders.ts` (wall+ground colliders, port of
  Physics.js), `vehicle-state.ts` (shared singleton).
- **systems**: `setup.system.ts` (p0: camera, dir+ambient light, fog, **temp** green
  ground plane, ground+wall colliders, track pieces, NPC trucks),
  `vehicle.system.ts` (p40: sphere body + yellow-truck visual, arcade drive via
  angular velocity, body lean, wheel spin/steer, respawn, publishes vehicleState),
  `camera-follow.system.ts` (p120: deadzone follow, port of Camera.js).
- **hud.ts / index.html**: lap-timer panel reading signals.

Verified: build + typecheck pass; **193 entities**, 16 track pieces, 50 colliders,
no worker errors; physics runs (sphere rests on ground); render snapshot shows
**26 draw commands / 7 draw calls**, fog + shadows + 1 fog packet active.

## RESOLVED: green/magenta + camera (2026-06-14)

Two independent bugs, both fixed and verified live (track renders, car drives, camera
follows; `meshDraws` 1→41; magenta 0.00% across reloads):

1. **Green / blank** = `quatLookAt` returned the **conjugate (inverse)** rotation. The
   `matBasisToQuat` off-diagonal sign terms were flipped, so the camera aimed ~110° AWAY
   from the scene → track + car frustum-culled, leaving only the 400-unit ground plane
   (always in frustum) → green. Fixed `matBasisToQuat` to standard Shepperd signs
   (`src/lib/math.ts`). Numerically verified: camera forward now matches dir-to-target
   (dot=1.000) for all off-axis cases; live camera forward `[-0.598,-0.535,-0.598]`
   exactly equals dir-to-scene-center.
2. **Intermittent magenta** (managed browser only) = bundled Chromium + `--enable-unsafe-webgpu`
   selected the SwiftShader software adapter on ~half of loads. Fixed by launching real
   Chrome — see patch #7.

**Input gotcha (verified):** `input_action_set` (virtual action) sets only the
main-thread resolved action; it does NOT reach the simulation worker, so the vehicle
sees `drive.y=0` and won't move. Use **real key events** (`input_key down KeyW`) — those
forward to the worker (`lastWorkerSummary.input.actions.drive` then reflects them, and
the `speed` signal ramps). Driving forward moved the car around a corner with the camera
following correctly.

**Systems glob is evaluated at dev-server START, not on page reload** — after
adding/renaming `*.system.ts` files, restart the session (`aperture dev down/up`) or the
generated bootstrap won't pick them up.

`racing-backup/parity/` has reference + earlier port screenshots for comparison:
`ref-initial.png` (live reference), `port-A.png` (track pre-shadows, GOOD),
`port-C.png` (track + ACES + fog + shadows, GOOD).

## TODO to parity

- [x] Fix the green/camera issue (quatLookAt conjugate + real-Chrome launch — 2026-06-14).
- [ ] Material parity: Aperture asphalt is too reflective vs reference's matte road
      (PBR standard material specular/roughness — check glTF roughness import + env spec).
- [x] Decorations: forest/tents/empty tiles from `computeDecorationBuckets()`
      (`decorations.system.ts`, p10); replaced temp ground. Needed engine fix #8
      (entity-capacity) — full ~115 decorations crashed the worker before that.
- [x] Verify driving + camera follow (drove a lap section; speed signal ramps,
      camera tracks). Steering-sign fine-tune vs reference still optional.
- [x] Smoke particles (Particles.js) → `particles.system.ts` (p125), APP-ONLY. Avoided the
      broken GPU particle pipeline entirely: builds a dynamic textured-unlit billboard-quad
      pool (pool 1280, camera-facing, `/sprites/smoke.png`) via the same dynamic-mesh+registry
      path as drift marks, faithful to spec §6. Decodes the sprite itself in the worker
      (config `asset.texture` doesn't decode pixels — see ENGINE_FINDINGS #4). Loads + runs
      clean (7 systems, no error); smoke emits when driftIntensity>0.7. Visual-under-drift
      pending a foreground view (managed window currently occluded → dark screenshots).
- [x] Drift marks (DriftMarks.js) → `drift-marks.system.ts` (p135): dynamic vertex-color
      unlit meshes per rear wheel, faithful to the reference. Loads + runs (registry path
      works); renders under drift. Caveats: uses a non-public registry hack (#7) and a
      Y-offset instead of unwired polygonOffset. Visual-under-hard-drift not yet captured.
- [x] Lap timer system (`lap-timer.system.ts`, p130) → finish-line crossing +
      cell-visited gating; drives lap/currentLapTime/lastLapTime/bestLapTime signals
      (HUD reads them). Verified currentLapTime ticks on input; full-lap crossing
      faithful to LapTimer.js (not yet driven a full loop live).
- [x] Audio (Audio.js) → `src/audio.ts` (main-thread, wired from `hud.ts`). APP-ONLY: the
      high-level `AudioEngine` has no imperative voice API (only snapshot-driven emitters),
      so the driver builds voices directly on the public `createWebAudioBackend` +
      `createAudioMixer` seams and drives engine/skid/impact from the `speed`/`throttle`/
      `driftIntensity` signals (3-gear pitch model per spec §8). Boots on first gesture;
      clips at `/audio/*.ogg` (200). No engine patch. Sound itself pending an ear-check.
- [~] Road matte parity — app-side improved (sky-biased ambient fill); full parity needs a
  `LightKind.Hemisphere` (+ optional double-sided back-face normal flip). ENGINE_FINDINGS #3.
- [x] Touch / pointer drive controls (`src/hud.ts` `setupTouchControls`): virtual-joystick
      drag → `dispatchApertureInputAction("drive",{x,y})`. VERIFIED forwarding to the worker
      (simulated drag drove `drive` to `{x:0.94,y:0.94}` then back to `{0,0}` on release).
      Confirms the app's CustomEvent virtual-input path DOES reach the worker (unlike the MCP
      `input_action_set` debug tool, which doesn't).
- [ ] Map codec `?map=` URL param — needs a page-URL→worker bridge (the worker can't read
      `location.search`; `decodeCells` is ready but the cells must be threaded into the
      worker systems). Likely a small engine/bootstrap addition.
- [ ] Parity screenshot pass + tune; changesets + PATCHES.md.

## Tooling (CLI = what I used; MCP = same tools once relaunched from racing/)

- Session: `aperture dev up --open --port 8852` / `--headless`; `dev down`,
  `dev status`, `dev logs`.
- `aperture tool <name> --json '{...}'`:
  `browser_screenshot` (base64 → decode with `racing/scripts/decode-screenshot.mjs`),
  `browser_status`, `browser_wait_for_webgpu`, `browser_console_logs`,
  `render_get_diagnostics`, `render_get_snapshot_summary`, `render_readback_samples`,
  `render_explain_entity`, `ecs_find_entities {namePattern|keyPattern}`,
  `ecs_get_entity`, `ecs_get_hierarchy`, `ecs_list_systems`, `ecs_snapshot`,
  `camera_get`, `input_key`, `input_action_set`, `ecs_set_component_field` (mutate to debug).
- MCP: `.mcp.json` present → these appear as `mcp__aperture__*` tools when the editor/agent
  is launched from `racing/`. Same contracts as the CLI.
- Reference app (visual target) can be served: `python3 -m http.server 8851` in
  `references/Starter-Kit-Racing`, open `http://127.0.0.1:8851/`.
