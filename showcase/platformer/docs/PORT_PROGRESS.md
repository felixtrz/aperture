# Starter-Kit-3D-Platformer → Aperture port

Porting Kenney's [Starter Kit 3D Platformer](https://github.com/KenneyNL/Starter-Kit-3D-Platformer)
(Godot 4.6) onto the Aperture engine. Reference checkout lives in
`../references/Starter-Kit-3D-Platformer`. The sibling `../fps` app (a port of
Kenney's FPS starter kit) is the primary pattern reference — it already solves
kinematic character movement, double jump, the signals→DOM HUD bridge, audio,
skybox, and blob shadows.

## Source mechanics (from the Godot project)

| System            | Source script            | Behaviour |
|-------------------|--------------------------|-----------|
| Player controller | `scripts/player.gd`      | `CharacterBody3D` + `move_and_slide`; camera-relative WASD; scalar gravity (`+= 25·dt`, jump sets `gravity = -7`); **double jump**; squash/stretch on jump/land; faces movement dir; respawn when `y < -10`; footstep loop + walk/idle/jump anims + dust trail. |
| Camera rig        | `scripts/view.gd`        | Orbit rig follows player (pos lerp), arrow/right-stick rotate (yaw + pitch clamp `[-80°,-10°]`), `+`/`-`/triggers zoom (`[4,16]`). |
| Coins             | `objects/coin.gd`        | `Area3D`; rotate + sine-bob; on player overlap → `collect_coin()`, coin SFX, hide. 14 coins. |
| Falling platforms | `objects/platform_falling.gd` | On player contact (top `Area3D`) → fall SFX, squash, accelerate down (`+= 15·dt`), free `< -10`. 3 of them. |
| Bricks            | `objects/brick.gd`       | `StaticBody3D` + bottom `Area3D`; break (SFX + particles, remove) when player hits from below. 3 of them. |
| Clouds            | `objects/cloud.gd`       | Decorative sine-bob, random rate/amplitude. 7 of them. |
| Flag              | model only               | Goal marker at `[0, 3.48, -6]`. |
| HUD               | `scripts/hud.gd`         | Coin icon + count. |
| Audio             | `scripts/audio.gd`       | Pooled one-shots, random pitch 0.9–1.1. |

Tuning constants (converted to m/s where Godot used `speed·dt`): `SPEED ≈ 4.5`,
`JUMP_STRENGTH = 7`, `GRAVITY = 25`, `MAX_JUMPS = 2`, movement/rotation/scale
smoothing rate `10`, camera follow rate `4`, camera rotate rate `6`,
`ROTATION_SPEED = 120°/s`, zoom `[4,16]` default `10`.

## Asset inventory (CC0, copied into `public/`)

- `models/*.glb` — platform, platform-medium, platform-grass-large-round,
  platform-falling, brick, coin, cloud, flag, grass, grass-small, character,
  dust, brick-particle, + shared `models/Textures/colormap.png` (referenced by
  every glb as an external URI — resolves relative to the glb).
- `character.glb`: 6 node meshes (no skin) + 4 TRS clips: `static/idle/walk/jump`.
- All platform/object glbs are single-mesh single-primitive → trimesh colliders
  via `mesh:<assetId>:mesh:0:primitive:0` (enabled by
  `physics.colliderGeometry: { kind: "assets" }`).
- `sounds/*.ogg` — coin, jump, land, fall, break, walking.
- `sprites/` — coin (HUD), blob_shadow, skybox, particle. `fonts/lilita_one`.

## Aperture mapping

- **Player body**: `spawn.physics` kinematic-position capsule + character
  controller; moved each frame with `physics.moveCharacter` (returns `grounded`
  + `collisions`), then `physics.setKinematicTarget`. (Mirrors fps.)
- **Player model**: separate `spawn.gltf("character")` entity, repositioned to
  the body each frame, yaw-rotated to face movement, scaled for squash/stretch,
  with `spawn.animation(root)` crossfading idle/walk/jump.
- **Camera**: single camera entity placed each frame at
  `target + R_y(yaw)·R_x(pitch)·(0,0,zoom)`, rotation `quatFromEulerYXZ(pitch,yaw,0)`.
- **Coins / falling platforms / bricks**: interaction detected from player
  position + `moveCharacter` collision normals (no per-frame physics overlap
  query needed); state held in a `defineResource` store.
- **HUD**: `coins` signal → `subscribeGeneratedSignals` in `src/hud.ts`.

### Systems

- `setup.system.ts` (p0) — camera, sun + ambient, skybox, fog, player body +
  model + shadow, level (visual gltf + trimesh colliders), falling platforms,
  bricks, coins, clouds, flag, grass decorations.
- `player.system.ts` (p20) — movement, jump, gravity, collision, respawn,
  squash/stretch, facing, animation, footstep/jump/land audio; writes
  model/shadow/camera-target + coin/platform/brick interaction events.
- `camera.system.ts` (p80) — orbit follow + rotate + zoom.
- `coins.system.ts` (p25) — spin/bob + collection.
- `hazards.system.ts` (p25) — falling platforms + bricks animation/removal.
- `decor.system.ts` (p10) — cloud bob.

## Engine feedback / bugs (live log)

> Goal directive: use the aperture MCP/CLI extensively and document any
> feedback/bugs found while building.

1. **`pnpm exec aperture` failed with `Command "aperture" not found` (MCP
   `-32000`) on a freshly-scaffolded workspace app.** Root cause: the cli `bin`
   (`dist/bin/aperture.js`) is a build artifact; the workspace `pnpm install`
   ran before the cli was built, so the `.bin/aperture` symlink was never
   created (affected every app + root). Fix: re-run `pnpm install` after the cli
   is built. *(Resolved during setup.)*

2. **Trimesh colliders from gltf assets work cleanly.** `physics.colliderGeometry:
   { kind: "assets" }` + a static collider with
   `shape: { kind: "trimesh", meshId: "mesh:<assetId>:mesh:0:primitive:0" }`
   produces correct collision for every single-mesh platform glb. Verified the
   player rests grounded on the starting platform and walks across the level
   staying grounded (vitexec `grounded=true`, `y≈0.49`).

3. **Capsule `halfHeight` is the cylinder-segment half (Rapier convention),** not
   the total. Player rests at body `y≈0.49` on a platform whose top is `0.55`
   (capsule bottom = offsetY 0.55 − (halfHeight 0.2 + radius 0.3) = +0.05).

4. **BUG (mine, fixed): brick fall-through.** Kenney's `brick.glb` has its origin
   at the *bottom* (AABB `y=[0,1]`), but I gave it a box collider centered on the
   entity origin → the collider sat entirely below the visible cube and the
   player fell through the top. Fix: `offsetTranslation: [0, 0.5, 0]` + half-extent
   0.5 to wrap the 1-unit visual, and brick-underside detection uses
   `brick.position.y` (origin = bottom face). *This was the "falls through orange
   platforms" report — the bricks are the orange blocks.*

5. **Black platform tops are FAITHFUL, not a bug.** Kenney's small/medium square
   `platform`/`platform-medium` glbs render gold dirt sides + a near-black top by
   design; only `platform-grass-large-round` is green grass. Confirmed against
   `references/.../screenshots/screenshot.png`.

6. **Audio one-shots don't leak ECS entities** (snapshot stayed at 161 entities,
   no `AudioEmitter` components lingering). Reworked one-shot playback to a bounded
   voice pool anyway (reuse 8 ids per system) — faithful to Godot `audio.gd`'s
   player pool and removes any concurrent-voice-budget risk. The user-reported
   "audio stops after respawn" needs live-session ear confirmation (audio output
   isn't measurable under headless SwiftShader).

7. **Falling platforms "fall through" was NOT an engine bug — verified.** Ran an
   in-app A/B (vitexec): placed one falling platform next to spawn and drove the
   player onto it with the collider as **kinematic** vs **static**. Both gave
   `groundedOverFallingPlatform=true` with near-identical trajectories — i.e. the
   character controller collides with kinematic *and* static bodies (the rapier
   KCC query only excludes sensors). Root cause was my **premature fall trigger**:
   a loose footprint (±1.0) + y-tolerance (±0.6) fired while the player was still
   on an *adjacent* surface, so the platform dropped away before they arrived.
   Ship-quality fix (no library change): trigger only when the character
   controller's actual ground contact is THIS platform (new `groundKey` resource,
   derived from `moveCharacter` collision normals), and implement falling as a
   **static** collider that is disabled after a short grace while the visual model
   animates down — which is also exactly how Kenney's Godot project models it (a
   `StaticBody3D` whose transform is scripted).

### Findings
All engine/tooling gaps are investigated to a conclusion (incl. retractions of
my own early misreads) in **`ENGINE_AND_TOOLING_FINDINGS.md`**. Headlines:
- Confirmed engine: `playOneShot` leaks emitter entities with unique ids (likely
  the audio-stop cause; app uses a bounded voice pool); `RAPIER.init({})`
  deprecation warning; misleading "0 draws" diagnostic during asset load.
- Confirmed tooling: `ecs_find_entities` `components` filter ignored; ~100k-char
  status-tool payloads.
- Retracted (didn't reproduce clean): `input_action_set` mis-map, `input_reset`
  stuck keys, `ecs_get_entity` key rejection.
- Physics: NOT broken (kinematic vs static A/B).

### vitexec note
- vitexec (v0.1.17 via `pnpm dlx`) prints its logs but **does not exit the
  process** — it lingers holding a Chromium. Running several in a session piles up
  orphan browsers and bogs the machine. Workflow: redirect to a file, poll for a
  final sentinel log, then `pkill` it (don't await exit). Better: the
  adopt-existing-browser fork reuses one browser (no per-run spawn). Verification
  in this port that didn't need arbitrary in-page JS was done via the persistent
  dev session + `aperture tool …` (one browser, no spawns).

## Verification status (all via vitexec logic runs + headed `aperture tool` shots)

- ✅ Player rests grounded on static platforms; walks across the level grounded.
- ✅ `groundKey` (controller ground-contact → AppEntityKey) tracks the platform
  under the player (`platform.0` → `platform-medium.0`) — confirms the precise
  falling-platform trigger.
- ✅ Jump + **double jump** (single peak ≈0.99, double ≈1.23 above rest 0.49).
- ✅ Coin collection (HUD `coins` 0→1 on contact).
- ✅ Respawn on fall below `y=-10` (teleports to start).
- ✅ Brick collider wraps the visible 1-unit cube (the first "orange" fall-through).
- ✅ Camera orbit responds to rotate input; full level renders correctly (green
  round grass platforms, black-top square platforms, bricks, coins, clouds, HUD).
- ⚠️ Audio: voice-pool fix applied; audio output can't be measured under headless
  SwiftShader — needs an ear in the live session to confirm the respawn case.

## How to run
`pnpm exec aperture dev up --open` (or `--port <n>` to pin off vitexec's 5173+
range), then play in the managed browser. `pnpm run build` / `pnpm run typecheck`
both pass clean.
