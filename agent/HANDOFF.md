# Handoff - Starter Kit FPS Controls And Enemy Range

**Updated:** 2026-06-17 01:40 PDT

User-directed work is now on branch `fps-starter-kit-port`, created from the
previous working state so the old state remains recoverable.

## Latest Completed Slice

- Fixed the browser-facing shoot path: primary mouse down on the FPS canvas now
  drives the generated `shoot` action even before pointer lock succeeds, while
  still requesting pointer lock for look input. This covers managed-browser and
  browser-denied pointer-lock cases where a click previously left
  `shotsFired` unchanged.
- Aligned enemy attack cadence/range with upstream `objects/enemy.tscn` /
  `objects/enemy.gd`: attack interval is now `0.25` seconds and the source
  raycast range is represented as a 5-unit line-of-sight damage gate.
- Reproved the reported controls through Aperture runtime tools: generated
  shoot increments `shotsFired`, W after yaw moves relative to camera direction,
  and jump leaves the ground with positive vertical velocity.
- Committed implementation:
  - `ba78c09e` — `Fix FPS canvas shooting before pointer lock`
  - `e9e94c9c` — `Align FPS enemy attack range`

## Previous Completed FPS Slices

- Weapon recoil:
  - Added source-style weapon recoil from upstream `objects/player.gd` /
    `weapons/*.tres`: each shot now samples the weapon's authored min/max
    camera kick, nudges pitch/yaw, and adds a short backwards movement impulse.
  - Kept recoil ECS/simulation-owned by feeding the transient impulse through
    the existing character-controller movement path; no renderer-owned weapon or
    camera state was introduced.
  - Added focused control-helper coverage proving recoil points backward
    relative to camera yaw.
  - Committed implementation: `6ea8464a` — `Add FPS weapon recoil kick`.
- Player blob shadow:
  - Added a source-like player blob shadow as ECS-authored render data. Setup
    now registers the upstream `blob_shadow` sprite, creates an unlit
    transparent material/sampler asset, and spawns `player.shadow` as a
    non-casting, non-receiving mesh plane at the player's feet.
  - `PlayerSystem` keeps `player.shadow` aligned with
    `fps.state.playerPosition` without adding a renderer-owned player scene
    graph or hidden gameplay state.
  - Re-ran the reported control concerns through Aperture CLI stepping:
    camera-relative movement follows yaw, jump leaves the ground with positive
    vertical velocity, and generated shoot input increments `shotsFired`.
  - Committed implementation: `694d60a1` — `Add FPS player blob shadow`.
- Full-clear proof:
  - Proved the Starter Kit FPS port can reach the all-enemies-cleared gameplay
    state through generated gameplay input only. The proof drove configured
    `move`, `look`, `jump`, and `shoot` actions through Aperture tools; it did
    not mutate enemy health, player transforms, or ECS gameplay state.
  - Replaced the failed straight-line route with a platform-aware path: start
    platform -> enemy.1 perch -> southeast grass platform for `enemy.2` ->
    center platform edge -> elevated northeast platform for `enemy.3`.
  - Final proof state: `health:55`, `shotsFired:12`, `hits:16`,
    `enemiesRemaining:0`, `destroyedEnemies:4`, every `enemyDestroyed.*:true`,
    `gameStatus:"cleared"`, HUD enemies text `CLEAR`, and
    `body[data-game-status="cleared"]`.
  - `browser_screenshot` wrote
    `fps/.aperture/runtime/fps-full-clear-proof.png`.
- Landing camera bob:
- Added upstream-style landing camera bob from `objects/player.gd`: landing
  after a jump dips the first-person camera by `-0.1`, then lerps it back toward
  the neutral player eye position at the upstream recovery rate.
- Kept the effect ECS-owned by writing the bobbed `LocalTransform` on
  `camera.main`; no renderer-owned camera object was introduced.
- Added `landingBob` and `landingPulse` to `fps.state` so Aperture tools can
  prove both the landing pulse and recovery.
- Committed:
  - `57c48500` — `Add FPS landing camera bob`
  - `bff2a66f` — `Add FPS weapon switch animation`
- Weapon switch:
  - Added source-like weapon switch animation from upstream
    `objects/player.gd`: the current weapon lowers, the active model swaps, then
    the new weapon raises back to its authored on-screen position.
  - Kept the implementation ECS-first by animating `LocalTransform` on the keyed
    weapon entities (`weapon.0` and `weapon.1`) rather than adding a mutable
    renderer-owned weapon container.
  - Added `weaponVisualIndex`, `weaponSwitchProgress`, and `weaponSwitchPhase`
    to `fps.state` for generated-worker proof and future HUD/tooling inspection.
- Controls:
  - Fixed pointer-lock shooting in the browser HUD. While the canvas is locked,
    primary mouse down/up now drives the generated `shoot` action directly, and
    release is delayed by 40 ms so a fast click cannot collapse into an
    unobservable same-frame virtual down/up pair.
  - Moved FPS control math into `fps/src/lib/fps-controls.ts` and added
    `test/app/fps-controls.test.ts` to lock camera-relative movement, diagonal
    normalization, pitch-aware shot direction, and upward-move snap behavior.
  - Kept movement relative to camera yaw: after a rightward look, W moves mostly
    along +X instead of world -Z.
  - Fixed unreliable jumps by using the no-snap character-controller settings
    only while desired vertical movement is upward. Normal grounded movement
    still uses the configured snap-to-ground distance.
- Authored clouds:
  - Added the remaining authored cloud instances from upstream
    `scenes/main.tscn`; the FPS port now spawns 11 cloud roots instead of the
    previous 4.
  - Preserved source cloud transforms as ECS data by storing source-derived
    quaternions and scale values in `CLOUDS`, with setup passing `rotation`
    into `spawn.gltf(...)` instead of collapsing cloud orientation to yaw-only
    values.
  - Added `src/systems/clouds.system.ts`, an ECS system that applies
    deterministic source-like hover motion equivalent to upstream
    `objects/cloud.gd`.
- Enemy destruction/status:
  - Added explicit enemy-destruction status for the Starter Kit FPS port,
    following the upstream `objects/enemy.gd` `destroy()` behavior by making
    dead enemies non-renderable/non-colliding instead of leaving active hitboxes.
  - `fps.state` now summarizes `enemyDestroyed`, `enemiesRemaining`,
    `destroyedEnemies`, `enemyDestroyedPulse`, `lastDestroyedEnemy`, and
    `gameStatus` so generated-worker tools can prove enemy death and HUD state.
  - The FPS HUD now flashes on enemy destruction, reports the remaining enemy
    count from generated signals, and has a clear-state banner for the eventual
    all-enemies-cleared state.
- Tooling support:
  - ECS entity lookup summaries now expose top-level `enabled` for entities with
    the `Enabled` component, and snapshot diffs include enabled-state changes.
- Committed:
  - `aaa83107` — `Port Starter Kit FPS slice to Aperture`
  - `37bc0e5e` — `Add FPS pointer lock look bridge`
  - `bd85c5e4` — `Add FPS physics character and raycast gameplay`
  - `fc8dd87e` — `Update handoff for FPS physics slice`
  - `4f44aa73` — `Add FPS HUD damage and hit feedback`
  - `40eb3bc3` — `Update handoff for FPS HUD feedback`
  - `70959002` — `Animate FPS sprite effects and expose sprite summaries`
  - `ba516abc` — `Preserve same-frame input button edges`
  - `35f50305` — `Add FPS enemy destruction status feedback`

## Latest Validation

- `pnpm exec vitest run test/app/fps-controls.test.ts`
- `pnpm --dir fps run typecheck`
- `pnpm --dir fps run build`
- `pnpm run typecheck`
- `pnpm run typecheck:test`
- `pnpm --dir racing run typecheck`
- `pnpm --dir racing run build`
- `pnpm --dir shadow-lab run typecheck`
- `pnpm --dir shadow-lab run build`
- Aperture CLI/runtime proof from `fps/`:
  - Restarted managed FPS at `http://127.0.0.1:5173/`;
    `browser_wait_for_webgpu` succeeded with no diagnostics.
  - Browser canvas mouse proof: before click `shotsFired:0`; after primary
    mouse down/up on the unlocked canvas, `shotsFired:1`,
    `shotCooldown:0.2333`, `yaw:0.0262`, `pitch:0.0372`.
  - Generated control proof: one generated `shoot` produced
    `shotsFired:1`; after yaw `0.8333`, held W moved by
    `dx:1.8504`, `dz:-1.681`; generated jump produced
    `grounded:false`, `verticalVelocity:7`, `jumpsRemaining:1`,
    `playerY:1.8613`.
  - Enemy attack proof: standing at spawn for 80 frames kept
    `healthDelta:0`; moving forward for 44 frames reached
    `position:[0.3033,1.0505,-3.5072]` and took one source-sized hit
    (`healthDelta:-5`).
  - The live FPS session was reset afterward to fresh gameplay.
- MCP sanity check:
  - `resource_get {"id":"fps.state"}` after reset reported
    `health:100`, `enemiesRemaining:4`, `shotsFired:0`, `hits:0`,
    `gameStatus:"active"`.
  - `render_explain_entity {"key":"player.shadow"}` returned zero diagnostics
    and stable render/bounds packet keys after the control/range edits.
  - `browser_console_logs {"lines":40}` showed the current reload ended with
    only Vite connect messages plus the known deprecated-parameter warning.
- Previous player-shadow Aperture CLI/runtime proof from `fps/`:
  - Active managed session: `http://127.0.0.1:5174/`, WebGPU healthy.
  - `resource_get {"id":"fps.state"}` after reset reported fresh gameplay:
    `health:100`, `enemiesRemaining:4`, `shotsFired:0`, `hits:0`,
    `gameStatus:"active"`.
  - `render_explain_entity {"key":"player.shadow"}` reported
    `rendered:true`, `hasBounds:true`, `renderKey:"mesh-draw:2"`,
    `boundsKey:"bounds:2:0"`, and zero diagnostics.
  - Deterministic paused stepping with generated actions reproved the reported
    controls: after yaw `0.8333`, forward movement produced `dx:1.8504`,
    `dz:-1.681`; jump produced `grounded:false`, `verticalVelocity:7`,
    `jumpsRemaining:1`, `deltaY:0.3667`; shoot produced `shotsFired:1` and
    `shotCooldown:0.2333`.
  - The live FPS session was reset afterward to fresh gameplay.
- Previous full-clear Aperture CLI/runtime proof from `fps/`:
  - Restarted managed FPS at `http://127.0.0.1:5174/`; `browser_wait_for_webgpu`
    succeeded with `webgpuOk:true` and no `lastError`/`lastFailure`.
  - Paused/reset the generated worker and drove only configured generated
    actions: `move`, `look`, `jump`, and `shoot`.
  - Killed `enemy.0` from spawn: `shotsBefore:0`, `shotsAfter:2`,
    `health:0`, `dist:7.02`.
  - Moved to a safe west perch on the start platform and killed `enemy.1`:
    `shotsBefore:2`, `shotsAfter:5`, `health:0`, `dist:7.86`.
  - Routed over the southeast platform gap through `center edge`,
    `jump to ground4 corner`, and `ground4 center` without falling, then killed
    `enemy.2`: `shotsBefore:5`, `shotsAfter:8`, `health:0`, `dist:3.92`.
  - Routed back through the center/north edge, jumped to `platform3`, jumped to
    the elevated northeast grass platform, and killed `enemy.3`:
    `shotsBefore:8`, `shotsAfter:12`, `health:0`, `dist:4.81`.
  - Final `fps.state`: `health:55`, `enemiesRemaining:0`,
    `destroyedEnemies:4`, every `enemyDestroyed.*:true`,
    `gameStatus:"cleared"`, `shotsFired:12`, `hits:16`.
  - HUD/browser proof: `#enemies` text was `CLEAR` and
    `document.body.dataset.gameStatus` was `cleared`.
  - `browser_screenshot` wrote
    `fps/.aperture/runtime/fps-full-clear-proof.png`.
  - The live FPS session was reset afterward and left paused at fresh gameplay:
    `health:100`, `enemiesRemaining:4`, `shotsFired:0`, `hits:0`,
    `gameStatus:"active"`.
- `pnpm run check:progress`
- Previous landing-bob validation:
- `pnpm --dir fps run typecheck`
- `pnpm --dir fps run build`
- Aperture CLI runtime proof from `fps/`:
  - Restarted managed FPS at `http://127.0.0.1:5174/`; `browser_wait_for_webgpu`
    succeeded with `webgpuOk:true` and no `lastError`/`lastFailure`.
  - Paused/reset the generated worker and stepped generated jump/landing input.
  - Initial proof state: `landingBob:0`, `landingPulse:0`, `cameraY:1.4945`.
  - Airborne proof state: `grounded:false`, `verticalVelocity:7.6667`,
    `playerY:1.6223`.
  - Landing proof state: `grounded:true`, `landingBob:-0.1`,
    `landingPulse:1`, `playerY:1.5201`, `cameraY:1.4201`, proving camera Y
    includes the landing dip.
  - Recovery proof state: `landingBob:-0.0175`, `landingPulse:1`,
    `cameraY:1.5026`.
  - Reset proof state: `health:100`, `enemiesRemaining:4`, `landingBob:0`,
    `landingPulse:0`.
  - Final runtime status remained `webgpuOk:true` with no `lastError` or
    `lastFailure`.
- `pnpm run typecheck`
- `pnpm run typecheck:test`
- `pnpm --dir racing run typecheck`
- `pnpm --dir racing run build`
- `pnpm --dir shadow-lab run typecheck`
- `pnpm --dir shadow-lab run build`
- Previous weapon-switch validation:
- `pnpm --dir fps run typecheck`
- `pnpm --dir fps run build`
- Aperture CLI runtime proof from `fps/`:
  - Restarted managed FPS at `http://127.0.0.1:5174/`; `browser_wait_for_webgpu`
    succeeded with `webgpuOk:true` and no `lastError`/`lastFailure`.
  - Paused/reset the generated worker and stepped generated `switchWeapon`.
  - Initial proof state: `weaponIndex:0`, `weaponVisualIndex:0`,
    `weaponSwitchPhase:"ready"`, `weapon0Y:-0.48`, `weapon1Y:-100`.
  - Hiding proof state: `weaponIndex:0`, `weaponVisualIndex:0`,
    `weaponSwitchPhase:"hiding"`, `weaponSwitchProgress:0.25`,
    `weapon0Y:-1.2207`, `weapon1Y:-100`.
  - Raising proof state: `weaponIndex:1`, `weaponVisualIndex:1`,
    `weaponSwitchPhase:"raising"`, `weaponSwitchProgress:0.6528`,
    `weapon0Y:-100`, `weapon1Y:-1.1744`.
  - Finished proof state: `weaponIndex:1`, `weaponVisualIndex:1`,
    `weaponSwitchPhase:"ready"`, `weaponSwitchProgress:1`,
    `weapon1Y:-0.48`.
  - Final runtime status remained `webgpuOk:true` with no `lastError` or
    `lastFailure`.
  - The live FPS session was reset to fresh gameplay afterward:
    `health:100`, `enemiesRemaining:4`, `shotsFired:0`, `hits:0`,
    `weaponIndex:0`, `weaponVisualIndex:0`, `weaponSwitchPhase:"ready"`,
    then resumed.
- `pnpm run typecheck`
- `pnpm run typecheck:test`
- `pnpm --dir racing run typecheck`
- `pnpm --dir racing run build`
- `pnpm --dir shadow-lab run typecheck`
- `pnpm --dir shadow-lab run build`
- Previous controls validation:
- `pnpm exec vitest run test/app/fps-controls.test.ts`
- `pnpm --dir fps run typecheck`
- `pnpm --dir fps run build`
- `pnpm run typecheck`
- `pnpm run typecheck:test`
- Aperture CLI runtime proof from `fps/`:
  - Restarted managed FPS at `http://127.0.0.1:5174/`; `browser_wait_for_webgpu`
    succeeded with `webgpuOk:true` and no `lastError`/`lastFailure`.
  - Paused/reset the generated worker and stepped a jump input:
    `grounded:false`, `verticalVelocity:7.6667`, `jumpsRemaining:1`,
    `playerY:1.6225`.
  - Stepped 40 frames of generated look input, then held W for 30 frames:
    `yaw:1.6667`, `dx:2.4885`, `dz:0.2393`, proving movement follows camera
    yaw.
  - Stepped generated `shoot` and browser pointer-click input:
    `generatedShots:1`, `browserClickShots:1`.
  - Final runtime status remained `webgpuOk:true` with no `lastError` or
    `lastFailure`.
  - The live FPS session was reset to fresh gameplay afterward:
    `health:100`, `enemiesRemaining:4`, `shotsFired:0`, `hits:0`, then resumed.
- Previous cloud validation:
- `pnpm --filter @aperture-engine/app typecheck`
- `pnpm --filter @aperture-engine/app build`
- Previous cloud Aperture CLI proof:
  - `ecs_list_systems` included `src/systems/clouds.system.ts`.
  - `ecs_find_entities { tags:["cloud"] }` returned 11 `deco.cloud.*`
    entities.
  - After 90 `ecs_step` frames, all 11 cloud roots had changed Y translation
    while X/Z, scale, and rotation stayed stable.
  - `browser_screenshot` wrote
    `fps/.aperture/runtime/fps-cloud-hover-proof.png`.
- Previous enemy-destruction validation:
- `pnpm exec vitest run test/app/developer-api.test.ts -t "publishes JSON-safe entity lookup summaries"`
- `pnpm exec vitest run test/app/developer-api.test.ts`
- Previous sprite/input validation:
- `pnpm exec vitest run test/app/input-state-events.test.ts`
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

- Managed FPS is running at `http://127.0.0.1:5173/` through Aperture dev and
  was reset to fresh gameplay after proof: `health:100`,
  `enemiesRemaining:4`, `shotsFired:0`, `hits:0`, `gameStatus:"active"`.
- The generated-input full-clear proof now has a working platform-aware route.
  The earlier failed straight-line route fell below the level after `enemy.2`;
  the successful proof instead uses explicit platform waypoints and jump arcs
  before claiming `gameStatus:"cleared"`.
- Pre-existing untracked screenshots,
  racing parity artifacts, and `racing/parity/` remain outside commits.
- `fps/src/systems/setup.system.ts` has an unrelated uncommitted helper
  extraction for the existing player-shadow mesh spawn. It was not staged in
  the control/range commits because it does not change runtime behavior.
- Use `value:0` rather than `pressed:false` for button-release CLI scripts when
  an immediate following `ecs_step` proof must be unambiguous.
- For held look input through the CLI, queue `input_action_set` with `x`/`y`
  before each `ecs_step`; a single vector input is consumed by one frame.
- `ecs_find_entities` now includes `enabled` and `renderSprite`, so future
  proofs can read entity enabled state, sprite `uvRect`, `atlasFrame`, and
  alpha directly instead of depending on fragile pixel timing.
- `render_readback_samples` / `browser_pick_pixel` still need follow-up if
  future FPS proofs require pixel samples; screenshot capture is reliable.

## Recommended Next Task

Continue the FPS port with another visible Starter Kit fidelity slice. Good
next options are improving enemy attack/muzzle-flash fidelity, adding more
source-like weapon/player detail parity, or packaging the platform-aware
full-clear route into a reusable smoke script so future regressions can re-run
the proof without retyping the route.

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
