# Handoff - FPS Shadow Fit Tightening

**Updated:** 2026-06-17 09:10 PDT

User-directed work is now on branch `fps-starter-kit-port`, created from the
previous working state so the old state remains recoverable.

## Latest Completed Slice

- Fixed the soft FPS directional shadows by tightening the default single-cascade
  auto-fit:
  - Live Aperture CLI diagnostics showed FPS was using `mapSize: 2048` and
    `filterRadiusTexels: 2`, but the shadow matrix had
    `orthographicSize: 243` because the fit covered the full `far=80`,
    `fov=80` camera frustum, including empty sky/background.
  - `DirectionalShadowMatrixComputationInput` now accepts receiver bounds.
    Single-cascade camera fitting intersects the camera-frustum light-space AABB
    with standard-material receiver bounds, then uses existing caster bounds to
    tighten depth. Cascaded shadows keep the previous Bevy-style frustum path.
  - `RenderShadowFrameReport` now publishes compact shadow `descriptor`,
    `viewProjection`, `matrixComputation`, and `casterDrawList` reports, so
    `render_get_frame_report` can expose the actual fit numbers through the
    Aperture CLI/tooling path.
  - Live FPS verification after rebuild/reload:
    `browser_wait_for_webgpu` passed, `render_get_frame_report` reported no
    shadow diagnostics, and the FPS shadow ortho dropped from `243` to `13`
    at start-position inspection, then `8` from the later moved camera sample.
    Screenshot saved at `/tmp/fps-shadow-tight.png`.
- Validation:
  - `pnpm exec vitest run test/webgpu/shadows/render-shadow-frame.spec.ts`
  - `pnpm exec vitest run test/webgpu/shadows/render-shadow-frame.spec.ts test/webgpu/app-auto-shadow-frame.test.ts test/webgpu/directional-shadow-matrix-computation.test.ts`
  - `pnpm --filter @aperture-engine/webgpu run typecheck`
  - `pnpm --filter @aperture-engine/webgpu run build`
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `pnpm exec vitest run test/app/fps-data.test.ts test/app/fps-controls.test.ts test/app/fps-effects.test.ts test/webgpu/app-frame-boundaries.test.ts test/webgpu/shadows/render-shadow-frame.spec.ts test/webgpu/app-auto-shadow-frame.test.ts test/webgpu/directional-shadow-matrix-computation.test.ts`
    passed 73 tests.
- Commit:
  - pending in this handoff update.

## Previous Completed Slice - Starter Kit FPS Source Sun And Viewmodel

- Followed up the source-style FPS weapon overlay with lighting and viewmodel
  parity fixes:
  - Source anchors:
    `references/Starter-Kit-FPS/scenes/main.tscn`,
    `references/Starter-Kit-FPS/scenes/main-environment.tres`,
    `references/Starter-Kit-FPS/objects/player.tscn`, and
    `references/Starter-Kit-FPS/objects/player.gd`.
  - The FPS sun now uses `SOURCE_SUN_ROTATION` directly. The earlier temporary
    Euler runtime mapping produced live light travel with positive Y, so
    up-facing platform surfaces were mostly shade-side. Live
    `ecs_find_entities {"key":"light.sun"}` now reports the source quaternion
    and the source basis matrix from `main.tscn`.
  - The source movement values are `movement_speed = 5`, `jump_strength = 8`,
    and `number_of_jumps = 2`; there is no sprint mechanic in the source. The
    port already matches those constants with `PLAYER_SPEED = 5`,
    `JUMP_STRENGTH = 8`, and `MAX_JUMPS = 2`.
  - The weapon viewmodel calibration is now `[2.05, -1.05, -2.75]` for
    Aperture's weapon camera while preserving
    `SOURCE_WEAPON_VIEW_POSITION = [1.2, -1.1, -2.75]`. The screenshot
    `/tmp/fps-weapon-calibrated-205-105.png` shows the weapon tucked lower/right
    like the source reference; `/tmp/fps-weapon-calibrated-look-down-platform.png`
    shows the weapon remains visible over the platform at pitch `-PI/2`.
- Aperture tooling proof:
  - Started the managed FPS app at `http://127.0.0.1:5173/` with
    `pnpm --dir fps exec aperture dev up --headless --host 127.0.0.1 --port 5173 --strict-port`.
  - `browser_wait_for_webgpu` passed with WebGPU ready, 94 mirrored source
    assets, `pitch:0`, `yaw:0`, and no last error/failure after reset.
  - Note: keep Aperture CLI browser-tool calls serial. A parallel batch of
    browser/render/ECS tool calls tore down this managed session once during
    validation.
- Validation:
  - `pnpm exec vitest run test/app/fps-data.test.ts`
  - `pnpm --dir fps run typecheck`
  - `pnpm exec vitest run test/app/fps-data.test.ts test/app/fps-controls.test.ts test/app/fps-effects.test.ts test/webgpu/app-frame-boundaries.test.ts`
    passed 55 tests.
  - `pnpm --dir fps run build`
  - `pnpm --filter @aperture-engine/webgpu run typecheck`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `pnpm run check:progress`
  - `git diff --check`
  - Additional live control recheck after reset:
    - normalized `input_pointer_click {"x":0.5,"y":0.5}` incremented
      `shotsFired` from `0` to `1`;
    - held Space moved player Y from `0.9699` to `1.1608`, set
      `grounded:false`, and reduced `jumpsRemaining` to `1` before landing;
    - setting yaw to `PI/2` and pressing forward moved X from `0` to
      `-2.0643` while Z stayed near `0`, matching camera-relative forward.
- Commit:
  - `a6c45fbb` — `Calibrate FPS source sun and weapon view`

## Previous Completed FPS/Tooling Slices

- Restored the source-style Starter Kit FPS weapon overlay path and fixed the
  latest reported control issues:
  - Source anchors:
    `references/Starter-Kit-FPS/objects/player.gd` and
    `references/Starter-Kit-FPS/project.godot`.
  - Reference anchors for the renderer slice:
    `references/three.js/src/renderers/WebGLRenderer.js`,
    `references/three.js/src/renderers/webgl/WebGLBackground.js`, and
    `references/engine/src/scene/renderer/frame-pass-postprocessing.js`.
  - Renderer frame-boundary assembly now supports post-processed same-swapchain
    overlay views by loading scene color for later views, clearing depth for
    transparent/disjoint-layer overlays, preserving MSAA color when another view
    still targets the same surface, and presenting post effects only after the
    final same-target view.
  - FPS setup now spawns `camera.main` for world content and `camera.weapon`
    for weapon-layer content, with source FOVs `80` and `40` respectively.
    Weapon meshes and the player muzzle flash render on the weapon layer,
    parented under the weapon camera with transparent clear.
  - Added an app-level `fps.input` command channel from the browser HUD to the
    simulation worker. Keyboard movement, jump, switch-weapon, and reset now
    have a narrow command fallback in addition to generated input actions.
  - Canvas click now emits a short pointer-lock shoot action as a fallback, so
    unlocked click-to-shoot works even when pointer-lock acquisition and pointer
    action forwarding race.
  - Movement remains camera-relative through the existing yaw-based movement
    math; live proof showed W at yaw `0` moved Z negative, and W at yaw
    `0.148571...` produced both negative X and negative Z velocity.
- Aperture tooling proof:
  - Started the managed FPS app with
    `pnpm --dir fps exec aperture dev up --headless --host 127.0.0.1 --port 5173`.
  - Direct MCP calls still failed with `Transport closed`; the same Aperture
    tools were used through the CLI, and the managed browser's CDP port was
    used only for tight per-frame state sampling.
  - Space jump proof: per-frame sampling around a keyboard event moved player Y
    from `0.970100...` to `1.655889...`, set `grounded:false`, and reduced
    `jumpsRemaining` to `1`.
  - Shoot proof: a canvas click produced `virtualAction: shoot` and incremented
    `shotsFired` from `1` to `2`.
  - Movement proof: W at yaw `0` produced
    `movementVelocity:[0,0,-4.7794...]`; after camera yaw changed to
    `0.148571...`, W produced
    `movementVelocity:[-0.7083...,0,-4.7326...]`.
  - Render proof: `render_get_frame_report` reported two swapchain views, draw
    calls `19` world plus `4` weapon, total draw calls `36`, diagnostics `0`,
    and bloom plus HDR tonemap running once on final view `1`.
- Validation:
  - `pnpm exec vitest run test/app/fps-data.test.ts test/app/fps-hud.test.ts test/app/fps-controls.test.ts test/app/fps-effects.test.ts`
    passed 45 tests.
  - `pnpm exec vitest run test/webgpu/app-frame-boundaries.test.ts test/webgpu/post-graph-parity.test.ts test/webgpu/post-tonemap.test.ts`
    passed 24 tests.
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir packages/webgpu run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `git diff --check`
- Commit:
  - `285fa3dd` — `Restore FPS weapon overlay controls`

- Anchored Starter Kit FPS enemy scene/script constants:
  - Source anchors:
    `references/Starter-Kit-FPS/objects/enemy.tscn` and
    `references/Starter-Kit-FPS/objects/enemy.gd`.
  - The source enemy scene authors a sphere hitbox with `radius = 0.75`, a
    `CollisionShape3D` offset of `[0, 0.25, 0]`, a raycast target
    `[0, 0, 5]`, two muzzle offsets `[-0.45, 0.3, 0.4]` and
    `[0.45, 0.3, 0.4]`, and a `Timer.wait_time = 0.25`.
  - The source enemy script applies `damage(5)`, rolls muzzle flashes in the
    `[-45, 45]` degree range, and integrates
    `target_position.y += cos(time * 5) * 1 * delta`.
  - The port now exports the corresponding `SOURCE_ENEMY_*` constants, derives
    attack distance from `SOURCE_ENEMY_RAYCAST_TARGET`, routes setup/player
    systems through those constants, and uses `sourceEnemyHoverPosition(...)`
    for the closed-form enemy hover position.
- Aperture tooling proof:
  - Started/reused the managed FPS app with
    `pnpm --dir fps exec aperture dev up --headless --host 127.0.0.1 --port 5173`.
  - CLI `browser_wait_for_webgpu` passed with WebGPU ready and diagnostics
    `[]`.
  - With the worker paused, `ecs_find_entities {"key":"enemy.0.hitbox"}` read
    `physicsCollider.shapeKind:"sphere"`, `physicsCollider.radius:0.75`, and
    an offset from `enemy.0` of `[0,0.25,0]` both before and after a paused
    `ecs_step {"delta":0.25}`.
  - The same paused step moved `enemy.0` from
    `[-3.5,2.56318,-6]` to `[-3.5,2.593785,-6]`, delta
    `[0,0.030605,0]`, proving only source hover Y changed while X/Z stayed
    anchored.
- Validation:
  - `pnpm exec vitest run test/app/fps-data.test.ts test/app/fps-controls.test.ts test/app/fps-effects.test.ts`
    passed 35 tests.
  - `pnpm exec vitest run test/app/fps-controls.test.ts test/app/fps-data.test.ts test/app/fps-input-config.test.ts test/app/fps-effects.test.ts test/app/fps-audio.test.ts test/app/browser-input-forwarding.test.ts test/app/input-state-events.test.ts`
    passed 62 tests.
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `pnpm run check:progress`
  - `git diff --check`
- Commit:
  - `25825757` — `Anchor FPS enemy source constants`

- Anchored Starter Kit FPS cloud hover math:
  - Source anchor: `references/Starter-Kit-FPS/objects/cloud.gd`.
  - The source randomizes `random_velocity` and `random_time` in `[0.1, 2.0]`
    and integrates `position.y += cos(time * random_time) * random_velocity *
    delta`, which yields a sine offset of `random_velocity / random_time`.
  - The port now exposes `SOURCE_CLOUD_RANDOM_MIN = 0.1` and
    `SOURCE_CLOUD_RANDOM_MAX = 2.0`, uses `sourceCloudHoverPosition(...)` as
    the shared source formula, and keeps deterministic per-cloud hover values
    inside the source random range.
- Aperture tooling proof:
  - Started/reused the managed FPS app with
    `pnpm --dir fps exec aperture dev up --headless --host 127.0.0.1 --port 5173`.
  - CLI `browser_wait_for_webgpu` passed with WebGPU ready, generated FPS input
    actions present, and render diagnostics `[]`.
  - Reproved the user-reported control paths through the live generated worker:
    one generated `shoot` step produced `shotsFired:1`,
    `shotCooldown:0.25`, and `movementVelocity.z:6.664182862170411`;
    yaw `1.5707963267948966` plus forward movement produced
    `movementVelocity:[-0.8333333333333333,0,-5.102694996447305e-17]`;
    a grounded generated `jump` step moved Y from `0.97009998762951` to
    `1.0978777594864368`, set `verticalVelocity:7.666666666666667`, and left
    `jumpsRemaining:1`.
  - `render_get_frame_report --summaryOnly` reported two views, 49 draw calls,
    and render diagnostics `0`.
  - With the worker paused, `ecs_find_entities {"key":"deco.cloud.0"}` before
    and after `ecs_step {"delta":0.25}` showed translation delta
    `[0,-0.01747608184814453,0]`; X/Z stayed fixed and only Y hovered.
- Validation:
  - `pnpm exec vitest run test/app/fps-controls.test.ts test/app/fps-data.test.ts`
    passed 28 tests.
  - `pnpm --dir fps run typecheck`
  - `pnpm exec vitest run test/app/fps-controls.test.ts test/app/fps-data.test.ts test/app/fps-input-config.test.ts test/app/fps-effects.test.ts test/app/fps-audio.test.ts test/app/browser-input-forwarding.test.ts test/app/input-state-events.test.ts`
    passed 60 tests.
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `git diff --check`
- Commit:
  - `3dadd9ab` — `Anchor FPS cloud hover source math`

- Aligned Starter Kit FPS weapon-switch ordering and shared cooldown:
  - Source anchor: `references/Starter-Kit-FPS/objects/player.gd`.
  - The source `handle_controls(delta)` calls `action_shoot()` before
    `action_weapon_toggle()`, and `action_weapon_toggle()` only starts the
    weapon tween and weapon-change sound; it does not reset the shared
    `$Cooldown` timer.
  - The port now advances active switch animation first, resolves the currently
    usable weapon for shooting, processes shooting, and only then handles a new
    `switchWeapon` edge.
  - Switching no longer clears `shotCooldown`, so same-frame
    switch-plus-shoot during cooldown starts the source hide animation but does
    not fire an extra shot.
  - Source weapon-switch timing constants are now exported as
    `SOURCE_WEAPON_SWITCH_HIDE_DURATION = 0.1` and
    `SOURCE_WEAPON_SWITCH_RAISE_RATE = 10`.
- Aperture tooling proof:
  - Started/reused the managed FPS app with
    `pnpm --dir fps exec aperture dev up --headless --host 127.0.0.1 --port 5173`.
  - CLI `browser_wait_for_webgpu` passed with WebGPU ready, generated FPS input
    actions present, and render diagnostics `[]`.
  - Paused/reset the live worker, fired once, then released for one step:
    `shotsFired:1`, `shotCooldown:0.23333333333333334`,
    `weaponSwitchPhase:"ready"`.
  - Pressed `switchWeapon` and `shoot` together while cooldown was active and
    stepped once: `weaponSwitchPhase:"hiding"`, `weaponSwitchProgress:0`,
    `shotsFired:1`, and `shotCooldown:0.21666666666666667`.
  - After crossing the source 0.1s hide duration, resource state reported
    `weaponIndex:1`, `weaponVisualIndex:1`,
    `weaponSwitchPhase:"raising"`, and `weaponSwitchProgress:0.5833333333333333`.
- Validation:
  - `pnpm exec vitest run test/app/fps-data.test.ts test/app/fps-controls.test.ts`
    passed 26 tests.
  - `pnpm --dir fps run typecheck`
  - `pnpm exec vitest run test/app/fps-controls.test.ts test/app/fps-data.test.ts test/app/fps-input-config.test.ts test/app/fps-effects.test.ts test/app/fps-audio.test.ts test/app/browser-input-forwarding.test.ts test/app/input-state-events.test.ts`
    passed 58 tests.
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `git diff --check`
- Commit:
  - `f3128229` — `Align FPS source weapon switch cooldown`

## Previous Completed FPS/Tooling Slices

- Aligned Starter Kit FPS source shot body knockback and movement smoothing:
  - Source anchors:
    `references/Starter-Kit-FPS/objects/player.gd`,
    `references/Starter-Kit-FPS/weapons/blaster.tres`, and
    `references/Starter-Kit-FPS/weapons/blaster-repeater.tres`.
  - The source player script sets local `movement_velocity` from movement
    input, calls `action_shoot()` before movement application, adds
    `Vector3(0, 0, weapon.knockback)` on shot, transforms it through
    `transform.basis`, then lerps body velocity with `delta * 10`.
  - The port now exposes `SOURCE_MOVEMENT_LERP_RATE = 10`, carries
    `fps.state.movementVelocity`, and uses
    `sourceMovementTargetVelocity(...)` plus `sourceSmoothedMovementStep(...)`
    to lerp horizontal body velocity toward the same source target.
  - Shot body knockback now folds into the source movement target on the shot
    frame instead of using the previous independent recoil impulse/recovery
    approximation.
- Aperture tooling proof:
  - Started the managed FPS app with
    `pnpm --dir fps exec aperture dev up --headless --host 127.0.0.1 --port 5173`.
  - CLI `browser_wait_for_webgpu` passed with WebGPU ready, generated FPS input
    actions present, and render diagnostics `[]`.
  - Pre-shot `resource_get {"id":"fps.state"}` reported
    `movementVelocity:[0,0,0]`, `shotsFired:0`, and `shotCooldown:0`.
  - With the simulation paused, a reset step followed by
    `input_action_set {"action":"shoot","pressed":true}` and one `ecs_step`
    produced `shotsFired:1`, `shotCooldown:0.25`,
    `movementVelocity:[-0.17953479649859896,0,6.664248772464203]`, and
    `playerPosition.z:0.11107081174850464`; the `z` velocity matches the
    source blaster knockback path (`40 * 10 / 60`) within the small random yaw
    kick from source camera recoil.
- Validation:
  - `pnpm exec vitest run test/app/fps-controls.test.ts test/app/fps-data.test.ts`
    passed 26 tests.
  - `pnpm --dir fps run typecheck`
  - `pnpm exec vitest run test/app/fps-controls.test.ts test/app/fps-data.test.ts test/app/fps-input-config.test.ts test/app/fps-effects.test.ts test/app/fps-audio.test.ts test/app/browser-input-forwarding.test.ts test/app/input-state-events.test.ts`
    passed 58 tests.
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `git diff --check`
- Commit:
  - `1f1ebf66` — `Align FPS source shot body knockback`

## Previous Completed FPS/Tooling Slices

- Aligned Starter Kit FPS source look and weapon-camera layering:
  - `references/Starter-Kit-FPS/objects/player.gd` uses
    `mouse_sensitivity = 700`, `gamepad_sensitivity = 0.075`, a persistent
    `rotation_target`, source controller diagonal limiting, and
    `lerp_angle(..., delta * 25)`.
  - The port now keeps pointer-lock mouse look separate from
    controller/keyboard look through a virtual-only `mouseLook` generated
    action backed by a new `input.virtual()` config binding.
  - Pointer-lock mouse look applies the source immediate path at `26/700`
    radians per virtual unit; controller/keyboard `look` advances the source
    rotation target and lerps the camera/player yaw and pitch toward it.
  - Shot recoil now updates both the current camera rotation and the source
    rotation target.
  - FPS setup now spawns `camera.weapon` parented to `camera.main`, uses the
    source weapon `CameraItem` `fov = 40`, renders world and weapon content on
    separate render layers, and keeps lights visible to both layers.
  - Weapon GLB roots, actual GLB mesh primitive descendants, and the player
    muzzle flash are assigned to the weapon render layer; the main player
    camera keeps world content on the world layer.
  - Devtools entity summaries now expose `renderLayer.mask`, which made the
    layer proof direct instead of inferred from draw counts.
- Aperture tooling proof:
  - Started the managed FPS app with
    `pnpm --dir fps exec aperture dev up --headless --host 127.0.0.1 --port 5173`.
  - CLI `browser_wait_for_webgpu` passed; `mouseLook` was present in generated
    input actions and WebGPU was ready.
  - CLI `render_get_frame_report` reported two swapchain views with diagnostics
    `0`: world view `drawCalls:19`, weapon view `drawCalls:4`.
  - CLI `camera_list` reported `camera.main` at `fov=80`, priority `0`, layer
    mask `1`; `camera.weapon` at `fov=40`, priority `1`, layer mask `2`,
    transparent clear color, and frustum culling disabled.
  - CLI `ecs_find_entities {"key":"camera.weapon","limit":1}` found
    `camera.weapon` parented to `camera.main`.
  - CLI `ecs_find_entities` for the live `blaster` mesh primitive reported
    `componentIds` including `aperture.render.layer` and `renderLayer.mask:2`.
  - CLI `ecs_find_entities {"key":"effect.muzzle-burst","limit":1}` reported
    `renderLayer.mask:2`, additive blend, disabled depth, and alpha `0` at
    idle.
  - After reset, MCP `input_action_set {"action":"mouseLook","x":-1,"y":0.5}`
    plus one `ecs_step` produced `yaw:-0.037142857142857144` and
    `pitch:0.018571428571428572`, matching `-26/700` and `13/700`.
  - MCP `input_action_set {"action":"look","x":1,"y":0}` plus one 1/60s
    `ecs_step` produced `yaw:0.03125`, matching `0.075 * 25 / 60`.
  - Forward movement at nonzero yaw moved the player to
    `x:-0.004134966501879944,z:-0.08322144762976791`, proving movement remains
    camera-relative.
  - MCP `input_pointer_click {"x":0.5,"y":0.5}` plus one `ecs_step` produced
    `shotsFired:1` and `shotCooldown:0.25`.
  - MCP jump input produced `verticalVelocity:7.666666666666667`,
    `jumpsRemaining:1`, and `grounded:false`.
- Validation:
  - `pnpm exec vitest run test/app/config-validation.test.ts test/app/input-state-events.test.ts test/app/developer-api.test.ts test/app/fps-data.test.ts test/app/fps-controls.test.ts test/app/fps-hud.test.ts test/app/fps-input-config.test.ts test/app/fps-effects.test.ts test/app/fps-audio.test.ts test/app/browser-input-forwarding.test.ts`
    passed 134 tests.
  - `pnpm --filter @aperture-engine/app run typecheck`
  - `pnpm --dir packages/app run build`
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `git diff --check`
- Commit:
  - `9b5b6206` — `Align FPS source look and weapon camera`

## Previous Completed FPS/Tooling Slices

- Aligned Starter Kit FPS player weapon view placement:
  - `references/Starter-Kit-FPS/objects/player.tscn` authors the weapon
    subviewport `CameraItem` at `fov = 40.0`, the `Container` at
    `[1.2, -1, -2.25]`, and the runtime `container_offset` in
    `references/Starter-Kit-FPS/objects/player.gd` is `[1.2, -1.1, -2.75]`.
  - `references/Starter-Kit-FPS/weapons/blaster.tres` and
    `blaster-repeater.tres` leave weapon model position at the `Weapon`
    script default `[0,0,0]`, set rotation `[0,180,0]`, and set
    `muzzle_position = [0.1,-0.4,1.5]`.
  - The port now exposes source weapon-view constants, places both weapon GLB
    roots at `[1.2,-1.1,-2.75]` relative to the player camera, and derives
    muzzle flash placement from source `container.position -
    weapon.muzzle_position`, including movement sway offset.
- Hardened generated browser input forwarding:
  - `packages/app/src/browser/input.ts` now treats pointer capture/release as
    best-effort so synthetic or pointer-lock-transition events cannot prevent
    generated input from reaching the simulation worker.
  - Added focused coverage in `test/app/browser-input-forwarding.test.ts`.
- Focused coverage:
  - Added `fps-data` tests for source weapon container, weapon-camera,
    switch/drop, shot-kick, model position, rotation, and muzzle data.
  - Added `fps-controls` tests for source weapon muzzle local/world placement
    and movement sway offset.
- Aperture proof:
  - Reloaded the managed FPS app through Aperture CLI and waited for WebGPU.
  - CLI and MCP `ecs_find_entities {"key":"weapon.0","limit":1}` reported
    active weapon local translation
    `[1.2000000476837158,-1.100000023841858,-2.75]` and diagnostics `0`.
  - A generated center click reported `shotsFired:1`; CLI and MCP
    `ecs_find_entities {"key":"effect.muzzle-burst","limit":1}` then reported
    visible sprite alpha `1`, source sprite width/height near `2.56`,
    `depthMode:"disabled"`, and source-derived muzzle translation around
    `[0.9220132231712341,0.27010002732276917,-4.292131423950195]` with
    diagnostics `0`.
  - A fresh managed-browser click through `input_pointer_click` changed
    `fps.state.shotsFired` from `0` to `1`, set `shotCooldown:0.25`, and the
    frame report showed `spriteDraws:2`, `quadInstances:2`, diagnostics `0`.
  - `input_key Space press` plus one `ecs_step` produced
    `verticalVelocity:7.666666666666667`, `jumpsRemaining:1`, and
    `grounded:false`.
  - After generated look input, forward movement changed position from near the
    origin to `[0.02215035724262293,0.9701670107679092,0.08033558259526785]`
    at `yaw:15.977000000029802`, proving movement follows camera yaw instead
    of fixed world `-Z`.
  - Latest post-proof render frame report had diagnostics `0`; latest console
    entries after the fresh session contained no new pointer-capture
    `InvalidStateError`.
- Validation:
  - `pnpm exec vitest run test/app/fps-data.test.ts test/app/fps-controls.test.ts test/app/fps-hud.test.ts test/app/fps-input-config.test.ts test/app/fps-effects.test.ts test/app/fps-audio.test.ts test/app/browser-input-forwarding.test.ts test/app/input-state-events.test.ts`
    passed 56 tests.
  - `pnpm --dir packages/app run typecheck`
  - `pnpm --dir packages/app run build`
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `git diff --check`
- Commits:
  - `15b3cacf` — `Harden generated pointer capture forwarding`
  - `75c4ac57` — `Align FPS weapon view source placement`

## Previous Completed FPS/Tooling Slices

- Aligned Starter Kit FPS source player capsule/body data:
  - `references/Starter-Kit-FPS/objects/player.tscn` positions the
    `CharacterBody3D` at `y = 0.5`, the `Head` at local `y = 1`, and the
    `Collider` at local `y = 0.55`.
  - The source `CapsuleShape3D` uses `radius = 0.3` and `height = 1.0`.
    Godot 4.6 documents `height` as the full capsule height including both
    hemispheres, so the Rapier/Aperture capsule half-height is derived as
    `(1.0 - 2 * 0.3) / 2 = 0.2`.
  - The port now exposes explicit source player constants, keeps
    `PLAYER_EYE_HEIGHT` at `1.5`, starts the player physics body at
    `[0, 0.5, 0]`, and writes the source collider offset `[0, 0.55, 0]` onto
    `player.body`.
- Focused coverage:
  - Added `fps-data` coverage for the source root/head/collider/capsule values,
    the derived capsule half-height, player body start, and eye height.
- Aperture proof:
  - Started the managed FPS app through
    `pnpm --dir fps exec aperture dev up --headless --host 127.0.0.1 --port 5173`
    and waited for WebGPU through Aperture CLI.
  - CLI and MCP entity reads for `player.body` reported capsule
    `radius:0.30000001192092896`, `halfHeight:0.20000000298023224`,
    `offsetTranslation:[0,0.550000011920929,0]`, and diagnostics `0`.
  - CLI and MCP `resource_get {"id":"fps.state"}` after a generated shot and
    Space jump reported `shotsFired:1`, `grounded:false`,
    `jumpsRemaining:1`, `verticalVelocity:7.333333333333334`, and diagnostics
    `0`.
- Validation:
  - `pnpm exec vitest run test/app/fps-data.test.ts test/app/fps-controls.test.ts test/app/fps-hud.test.ts test/app/fps-input-config.test.ts test/app/fps-effects.test.ts test/app/fps-audio.test.ts`
    passed 36 tests.
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `git diff --check`
- Committed implementation:
  - `70726167` — `Align FPS player capsule source data`

## Earlier Completed FPS/Tooling Slices

- Aligned Starter Kit FPS source reload/respawn semantics:
  - `references/Starter-Kit-FPS/objects/player.gd` reloads the current scene
    when `position.y < -10` or `health < 0`.
  - `references/Starter-Kit-FPS/objects/enemy.gd` applies
    `collider.damage(5)` from enemy attack raycasts, which can trip the same
    reload path.
  - The port now extracts `sourcePlayerShouldRespawn(...)` and uses it both
    after fall/health checks and immediately after enemy attack damage.
  - Source reload reset now restores player position, yaw, pitch, vertical
    velocity, jumps, grounded state, health, weapon index, cooldown,
    shots/hits, enemy health/destroyed state, pulses, last destroyed enemy, the
    player physics body, and transient gameplay visual/audio timers.
  - The respawn frame suppresses weapon switch, shooting, enemy attacks, and
    weapon movement sway so post-reload state is stable.
- Focused coverage:
  - Added `sourcePlayerShouldRespawn(...)` threshold tests for the source
    `position.y < -10` and `health < 0` reload conditions.
- Aperture proof:
  - Started the managed FPS app through
    `pnpm --dir fps exec aperture dev up --headless --host 127.0.0.1 --port 5173`
    and waited for WebGPU through Aperture CLI.
  - CLI `resource_set {"id":"fps.state","values":{"health":-1}}` followed by
    one `ecs_step` proved the live worker resets `health` to `100`, `yaw` to
    `0`, `pitch` to `0`, `enemiesRemaining` to `4`, and `destroyedEnemies` to
    `0`.
  - MCP `resource_get {"id":"fps.state"}` read back the same reset state after
    the proof, with diagnostics `0`.
  - Direct lethal enemy-attack proof was not performed because the current MCP
    shortcut set does not expose a safe direct physics-body teleport; the live
    proof exercises the shared predicate and the enemy damage path calls that
    predicate immediately after applying damage.
- Validation:
  - `pnpm exec vitest run test/app/fps-controls.test.ts test/app/fps-hud.test.ts test/app/fps-input-config.test.ts test/app/fps-effects.test.ts test/app/fps-data.test.ts test/app/fps-audio.test.ts`
    passed 35 tests.
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `git diff --check`
- Committed implementation:
  - `76e885d0` — `Align FPS source respawn reset`

## Earlier Completed FPS/Tooling Slices

- Aligned Starter Kit FPS look input direction with source action-vector
  semantics:
  - `references/Starter-Kit-FPS/objects/player.gd` reads controller look with
    `Input.get_vector("camera_right", "camera_left", "camera_down",
    "camera_up")`.
  - The port now maps right-look input to negative generated `look.x`, left-look
    input to positive `look.x`, down-look input to negative `look.y`, and
    up-look input to positive `look.y`.
  - Browser-standard gamepad right-stick X is inverted to match the source
    camera action vector.
  - Keyboard look helpers now follow the same IJKL semantics: `L`/`I` map to
    source right/up and `J`/`K` map to source left/down.
  - Pointer-lock mouse X dispatch is inverted so mouse movement and generated
    action input drive the same source yaw direction.
- Focused coverage:
  - Expanded `test/app/fps-input-config.test.ts` to cover browser-standard
    gamepad X/Y look axes and keyboard IJKL look helpers.
  - Expanded `test/app/fps-hud.test.ts` to cover pointer-lock mouse delta
    conversion through the shared source action-vector helper.
- Aperture proof:
  - Reloaded the managed FPS app through Aperture CLI/MCP and waited for
    WebGPU.
  - `input_gamepad_set` with right-stick right/up and forward movement resolved
    to `look.x:-1`, `look.y:1`, moved `fps.state` to
    `yaw:-0.041666666666666664,pitch:0.041666666666666664`, and advanced the
    player to positive X/negative Z, proving movement is still camera-relative
    under the corrected look signs.
  - A normalized center `input_pointer_click` followed by one `ecs_step`
    produced `shotsFired:1` and `shotCooldown:0.23333333333333334`, proving
    browser pointer shooting works through the managed app.
  - `input_key Space press` followed by one `ecs_step` produced
    `grounded:false`, `jumpsRemaining:1`, and
    `verticalVelocity:7.666666666666667`, proving browser Space jump input
    reaches the player system.
- Validation:
  - `pnpm exec vitest run test/app/fps-input-config.test.ts test/app/fps-controls.test.ts test/app/fps-hud.test.ts test/app/fps-effects.test.ts test/app/fps-data.test.ts test/app/fps-audio.test.ts`
    passed 34 tests.
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `git diff --check`
- Committed implementation:
  - `68d0ab80` — `Align FPS look input direction`

## Earlier Completed FPS/Tooling Slices

- Aligned Starter Kit FPS HUD styling with source scene/script data:
  - `references/Starter-Kit-FPS/scenes/main.tscn` scales the 128px crosshair
    texture by `0.35`, so the source crosshair renders at `44.8px`.
  - The source health label uses `font_size = 36`, `outline_size = 12`,
    outline alpha `0.470588`, a `45px` line-height-sized rect, and `48px`
    left/bottom offsets.
  - The port now writes those values through explicit HUD source constants and
    CSS variables, while keeping the generated app HUD as DOM overlay state
    derived from ECS health.
  - The health formatter now clamps negative health to `0%` and falls back to
    `100%` for non-finite values.
- Focused coverage:
  - Added `test/app/fps-hud.test.ts` for source HUD constants, health text
    formatting, and CSS variable emission.
- Aperture proof:
  - Reused the managed FPS app through
    `pnpm --dir fps exec aperture dev up --headless` and waited for WebGPU
    through Aperture CLI.
  - Captured `.aperture/runtime/fps-hud-source-proof.png`, visually confirming
    the source-sized centered crosshair and large outlined lower-left health
    text.
  - `render_get_frame_report {"summaryOnly":true}` and MCP
    `render_get_frame_report` both reported one live view, 19 mesh draws,
    `skyboxes:1`, `fogs:1`, 33 draw calls, and diagnostics `0`.
- Validation:
  - `pnpm exec vitest run test/app/fps-hud.test.ts test/app/fps-effects.test.ts test/app/fps-controls.test.ts test/app/fps-data.test.ts test/app/fps-audio.test.ts test/app/fps-input-config.test.ts`
    passed 32 tests.
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `git diff --check`
- Committed implementation:
  - `b5496245` — `Align FPS HUD source styling`

## Earlier Completed FPS/Tooling Slices

- Aligned Starter Kit FPS player muzzle sprite sizing with source scene data:
  - `references/Starter-Kit-FPS/objects/player.tscn` uses an
    `AnimatedSprite3D` muzzle node with default `SpriteBase3D.pixel_size`.
  - `references/Starter-Kit-FPS/sprites/burst_animation.tres` uses 256px atlas
    frames from `sprites/burst.png`, so the unscaled player muzzle world size
    is `256 * 0.01 = 2.56`.
  - The port now spawns `effect.muzzle-burst` as a square `[2.56, 2.56]`
    sprite and keeps the existing source runtime scale range `0.40..0.75`
    from `references/Starter-Kit-FPS/objects/player.gd`.
  - Because the source muzzle is rendered through the transparent weapon
    subviewport on layer 2, the port now disables world-scene depth testing for
    `effect.muzzle-burst`.
- Focused coverage:
  - Added `SOURCE_PLAYER_MUZZLE_WORLD_SIZE` / sprite-size coverage beside the
    existing enemy muzzle and impact size tests.
- Aperture proof:
  - Started/reused the managed FPS app through
    `pnpm --dir fps exec aperture dev up --headless` and waited for WebGPU
    through Aperture CLI.
  - `ecs_find_entities {"key":"effect.muzzle-burst","limit":1}` reported
    `renderSprite.width` and `renderSprite.height` approximately `2.56`,
    `localTransform.scale` approximately `[0.4,0.4,0.4]` while hidden,
    `depthMode:"disabled"`, and diagnostics `0`.
  - After one generated `shoot` step, the same entity reported visible alpha
    `1`, `localTransform.scale:[0.4106,0.4106,0.4106]`, the same `2.56`
    width/height base size, and `depthMode:"disabled"`.
- Validation:
  - `pnpm exec vitest run test/app/fps-effects.test.ts test/app/fps-controls.test.ts test/app/fps-data.test.ts test/app/fps-audio.test.ts test/app/fps-input-config.test.ts`
    passed 28 tests.
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `git diff --check`
- Committed implementation:
  - `815d6af6` — `Align FPS player muzzle sprite size`
  - `69c929e8` — `Align FPS player muzzle overlay depth`

## Earlier Completed FPS/Tooling Slices

- Hardened Starter Kit FPS shooting input for fast click/release cases:
  - The player system now stores a short `0.08s` shoot buffer when the generated
    `shoot` button reports a down edge.
  - Held shooting still uses the upstream-style pressed state and weapon
    cooldown, so repeater/held-fire behavior remains intact.
  - The buffer is consumed after a shot and cleared on reset/respawn so stale
    click edges cannot leak across gameplay resets.
- Focused coverage:
  - Extracted `shouldConsumeBufferedShot(...)` beside the existing jump-buffer
    helper.
  - Added coverage for held shooting, buffered click consumption, empty input,
    and cooldown blocking.
- Aperture proof:
  - Reloaded the managed FPS app through `pnpm --dir fps exec aperture tool
    browser_reload` and waited for WebGPU.
  - Paused the generated worker, reset `fps.state`, queued `shoot` pressed
    `true` then `false` before the next `ecs_step`, and read
    `resource_get {"id":"fps.state"}`: `shotsFired:1` and
    `shotCooldown:0.25`.
- Validation:
  - `pnpm exec vitest run test/app/fps-controls.test.ts test/app/fps-effects.test.ts test/app/fps-data.test.ts test/app/fps-audio.test.ts test/app/fps-input-config.test.ts`
    passed 28 tests.
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `git diff --check`
- Committed implementation:
  - `61684e3a` — `Harden FPS shooting input`
  - `8c5d8bf6` — `Cover FPS shooting input buffer`

## Earlier Completed FPS/Tooling Slices

- Aligned Starter Kit FPS enemy muzzle runtime scale with source script data:
  - `references/Starter-Kit-FPS/objects/enemy.tscn` gives each enemy muzzle
    `AnimatedSprite3D` node a transform scale of `0.5`.
  - `references/Starter-Kit-FPS/objects/enemy.gd` only rewinds/plays the
    muzzle animation and randomizes `rotation_degrees.z`; it does not apply a
    second random scale at fire time.
  - The port now keeps `effect.enemy.*.muzzle.*` sprite dimensions at the
    previously derived `[1.28, 1.28]` source size and writes identity runtime
    transform scale instead of multiplying by the old `0.72` factor.
- Aperture proof:
  - Reused the managed FPS app through `pnpm exec aperture dev up --open`.
  - `browser_wait_for_webgpu` passed with WebGPU ready and diagnostics `0`.
  - MCP `ecs_query {"key":"effect.enemy.0.muzzle.0","limit":1}` reported
    `localTransform.scale:[1,1,1]`, `renderSprite.width` and
    `renderSprite.height` approximately `1.28`, `blendMode:"additive"`, and
    `depthMode:"test"`.
- Validation:
  - `pnpm exec vitest run test/app/fps-effects.test.ts test/app/fps-data.test.ts test/app/fps-audio.test.ts test/app/fps-controls.test.ts test/app/fps-input-config.test.ts`
    passed 27 tests.
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `git diff --check`
- Committed implementation:
  - `1c56da13` — `Align FPS enemy muzzle runtime scale`

## Older Completed FPS/Tooling Slices

- Aligned Starter Kit FPS enemy muzzle sprite sizing with source scene data:
  - `references/Starter-Kit-FPS/objects/enemy.tscn` uses two
    `AnimatedSprite3D` muzzle nodes with `transform` scale `0.5`.
  - `references/Starter-Kit-FPS/sprites/burst_animation.tres` uses 256px atlas
    frames from `sprites/burst.png`.
  - Godot `SpriteBase3D.pixel_size` defaults to `0.01`, so the source enemy
    muzzle world size is `256 * 0.01 * 0.5 = 1.28`.
  - The port now spawns `effect.enemy.*.muzzle.*` sprites at `[1.28, 1.28]`
    instead of `[0.42, 0.42]`.
- Aligned Starter Kit FPS one-shot audio pool behavior with
  `references/Starter-Kit-FPS/scripts/audio.gd`:
  - Source pooled `AudioStreamPlayer` instances use `volume_db = -10`.
  - Each queued one-shot randomizes `pitch_scale` with
    `randf_range(0.9, 1.1)`.
  - The port now routes landing, weapon switch, shooting, jump, enemy attack,
    enemy hurt, and enemy destroy one-shots through source gain and pitch
    scaling.
- Focused coverage:
  - Added source enemy muzzle world-size conversion coverage alongside the
    existing impact sprite size tests.
  - Added source one-shot gain and pitch-scale range coverage.
- Aperture proof:
  - Started the managed FPS app through `pnpm exec aperture dev up --open` and
    waited for WebGPU with Aperture MCP.
  - `ecs_find_entities {"key":"effect.enemy.0.muzzle.0"}` reported
    `renderSprite.width` and `renderSprite.height` as approximately `1.28`,
    `blendMode:"additive"`, and `depthMode:"test"`.
  - `render_get_frame_report {"summaryOnly":true}` reported frame `1577`,
    one view, `skyboxes:1`, `fogs:1`, 33 draw calls, and diagnostics `0`.
- Validation:
  - `pnpm exec vitest run test/app/fps-audio.test.ts` passed 5 tests.
  - `pnpm exec vitest run test/app/fps-effects.test.ts` passed 5 tests.
  - `pnpm exec vitest run test/app/fps-effects.test.ts test/app/fps-data.test.ts test/app/fps-audio.test.ts test/app/fps-controls.test.ts test/app/fps-input-config.test.ts`
    passed 26 tests.
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `git diff --check`
- Committed implementation:
  - `f5a2f3df` — `Align FPS enemy muzzle sprite size`
  - `d966ebe4` — `Align FPS one-shot audio pool`

## Older Completed FPS/Tooling Slices

- Aligned two small Starter Kit FPS source-fidelity details:
  - `references/Starter-Kit-FPS/objects/enemy.gd` plays the enemy hurt sound
    before the destroy sound on lethal damage. The port now emits
    `enemy-hurt` for every valid enemy hit and then `enemy-destroy` when the
    hit is lethal.
  - `references/Starter-Kit-FPS/objects/impact.tscn` sets
    `AnimatedSprite3D.pixel_size = 0.0025` on 128px atlas frames from
    `sprites/hit.png`, so the source world size is `0.32`. The port now spawns
    impact hit sprites at `[0.32, 0.32]` instead of the older `[0.85, 0.85]`.
- Focused coverage:
  - Added `sourceEnemyDamageAudioEvents(...)` tests for nonlethal, lethal, and
    already-destroyed enemy damage audio cases.
  - Added source `AnimatedSprite3D` world-size conversion coverage for impact
    sprites.
- Aperture proof:
  - Reused the managed FPS app through `pnpm exec aperture dev up --open` and
    waited for WebGPU with Aperture MCP.
  - `ecs_find_entities {"key":"effect.impact-hit.0"}` reported
    `renderSprite.width` and `renderSprite.height` as approximately `0.32`,
    `blendMode:"alpha"`, and `depthMode:"disabled"`.
  - `render_get_frame_report {"summaryOnly":true}` reported frame `1056`,
    one view, `skyboxes:1`, `fogs:1`, 33 draw calls, and diagnostics `0`.
- Validation:
  - `pnpm exec vitest run test/app/fps-audio.test.ts` passed 4 tests.
  - `pnpm exec vitest run test/app/fps-effects.test.ts` passed 4 tests.
  - `pnpm exec vitest run test/app/fps-effects.test.ts test/app/fps-data.test.ts test/app/fps-audio.test.ts test/app/fps-controls.test.ts test/app/fps-input-config.test.ts`
    passed 25 tests.
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `git diff --check`
- Committed implementation:
  - `71ce56f8` — `Align FPS enemy damage audio`
  - `63aacbec` — `Align FPS impact sprite size`

## Historical Completed FPS/Tooling Slices

- Aligned Starter Kit FPS ray-target semantics with upstream
  `references/Starter-Kit-FPS/objects/player.gd` and
  `references/Starter-Kit-FPS/objects/enemy.gd`:
  - Player pellet spread now uses the source RayCast target vector
    `[spreadX, spreadY, -maxDistance]` rotated through the camera basis, rather
    than a hard-coded `spread * 0.035` offset.
  - Enemy look, attack range, and line-of-sight raycasts now target the source
    upper-body point. Because Aperture stores `playerPosition` as the camera eye
    position, that target is represented as `playerEye.y - 0.5`.
  - FPS gamepad input now maps browser-standard gamepad axes explicitly, with
    Y-axis inversion for forward movement and look-up behavior.
- Focused coverage:
  - Added source pellet spread direction tests for centered, corner, and pitched
    camera-basis cases.
  - Updated enemy look/muzzle tests to use the source upper-body target.
  - Added `test/app/fps-input-config.test.ts` for standard gamepad Y-axis
    forward/look-up mapping.
- Aperture proof:
  - Restarted/reused the managed FPS app through `pnpm --dir fps exec aperture
    dev up --headless --host 127.0.0.1 --port 5173`, waited for WebGPU, and
    paused/stepped the generated worker through Aperture MCP/CLI tools.
  - `resource_get {"id":"fps.state"}` and
    `ecs_find_entities {"key":"enemy.0"}` showed the live enemy forward vector
    matching the source target `playerEye.y - 0.5`; computed dot product was
    `1.0000000107` for the source target versus `0.9897974997` for the old
    eye-plus target.
  - Reproved the reported gamepad controls after the implementation commit:
    left-stick forward (`y:-1`) moved to
    `playerPosition.z:-0.16666670143604279`; turn-then-forward movement
    produced `yaw:0.08333333333333333`, `x:-0.013872818771099915`, and
    `z:-0.1660883559553863`; right trigger produced `shotsFired:1`; and south
    button jump produced `verticalVelocity:7.666666666`, `jumpsRemaining:1`,
    and `grounded:false`.
  - Reproved aimed shooting after the combined changes: generated look+shoot
    against `enemy.0` reported `shotsFired:1`, `hits:3`, and enemy health
    `100 -> 25`.
  - `render_get_frame_report {"summaryOnly":true}` reported frame `123`, one
    view, 18 mesh draws, `skyboxes:1`, `fogs:1`, 32 draw calls, and diagnostics
    `0`.
- Validation:
  - `pnpm exec vitest run test/app/fps-input-config.test.ts test/app/fps-controls.test.ts test/app/fps-data.test.ts test/app/fps-effects.test.ts test/app/fps-audio.test.ts`
    passed 22 tests.
  - `pnpm exec vitest run test/app/fps-input-config.test.ts test/app/fps-controls.test.ts test/app/fps-audio.test.ts test/app/fps-effects.test.ts`
    passed 21 tests.
  - `pnpm exec vitest run test/app/fps-input-config.test.ts test/app/fps-controls.test.ts test/app/input-state-events.test.ts`
    passed 33 tests.
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `git diff --check`
- Committed implementation:
  - `0164f083` — `Align FPS ray targets and gamepad axes`

## Archived Completed FPS/Tooling Slices

- Aligned Starter Kit FPS shot impacts with upstream
  `references/Starter-Kit-FPS/objects/player.gd`:
  - Source `action_shoot()` instantiates and plays `objects/impact.tscn`
    inside the `for n in weapon.shot_count` pellet loop whenever a raycast
    collides.
  - The port now creates `effect.impact-hit.0`, `.1`, and `.2` from the maximum
    source weapon `shot_count` instead of collapsing a blaster volley to one
    nearest impact sprite.
  - Impact sprites keep the existing source-style four-frame 30fps atlas
    playback, alpha `1` on visible frames, hidden reset state, and disabled
    depth behavior.
- Preserved Starter Kit FPS `objects/platform_large_grass.tscn` child
  decorations:
  - The source packed scene has `grass`, `grass-small`, and `grass2` child
    models under each `platform-large-grass` instance.
  - The port now spawns those three local children under every large grass
    platform root, so all five authored platforms carry the same source grass
    detail.
- Focused coverage:
  - Added `IMPACT_EFFECT_SLOT_COUNT` / `impactEffectKey(...)` coverage so the
    visible impact slot count stays tied to source weapon pellet counts.
  - Added platform-large-grass child decoration key/transform coverage.
- Aperture proof:
  - Restarted the managed FPS app through `pnpm exec aperture dev up
    --headless --host 127.0.0.1 --port 5173` and waited for WebGPU.
  - Used generated `look` input to aim at `enemy.0`, generated `shoot` once,
    and read `fps.state`: `shotsFired:1`, `hits:3`, and `enemy.0` health
    `100 -> 25`.
  - Immediately read `effect.impact-hit.0`, `.1`, and `.2`; each reported
    `renderSprite.color[3] = 1`, `atlasFrame:0`, and distinct impact
    translations around the enemy hitbox.
  - `render_get_frame_report {"summaryOnly":true}` reported frame `6462`,
    one view, 20 mesh draws, `spriteDraws:4`, `skyboxes:1`, `fogs:1`, 37 draw
    calls, and diagnostics `0`.
  - `ecs_find_entities {"tags":["decoration","grass"]}` returned 15 grass
    child entities, including `level.platform-large-grass.0.grass.0` and
    `level.platform-large-grass.4.grass-small.0` with source local transforms.
- Validation:
  - `pnpm exec vitest run test/app/fps-data.test.ts test/app/fps-effects.test.ts test/app/fps-controls.test.ts test/app/fps-audio.test.ts`
    passed 19 tests.
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `git diff --check`
- Committed implementation:
  - `f14a3e1d` — `Align FPS impact and grass details with source`

- Aligned Starter Kit FPS jump/ceiling handling with upstream
  `references/Starter-Kit-FPS/objects/player.gd`:
  - Source `handle_gravity(...)` only clears upward gravity when
    `is_on_ceiling()` is true, and only refreshes jumps on floor contact after
    downward gravity.
  - The port no longer treats any clipped upward character-controller movement
    as a jump block. It cancels upward velocity only when the Rapier character
    controller reports a ceiling-like collision normal.
  - The port now ignores transient controller-grounded reports while
    source-style upward velocity is active, preventing an ascent frame from
    immediately restoring jump count.
- Focused coverage:
  - Added `hasCeilingCollision(...)` and `sourceGroundedAfterMove(...)` tests.
- Aperture proof:
  - Restarted the managed FPS app through `pnpm --dir fps exec aperture dev up
    --headless --port 5173` and waited for WebGPU.
  - Confirmed pause behavior held by reading `fps.state` at version `1371`,
    waiting one second, and reading version `1371` again.
  - Used Aperture CLI `physics_move_character` against live `player.body` with
    upward/forward motion into `level.platform.2.collider`; the Rapier
    character route returned three collisions with `normal[1]` approximately
    `-0.571`, `-0.572`, and `-0.574`, matching the helper's ceiling threshold.
  - `render_get_frame_report {"summaryOnly":true}` reported frame `1891`, one
    view, 16 mesh draws, `skyboxes:1`, 30 draw calls, and diagnostics `0`.
- Validation:
  - `pnpm exec vitest run test/app/fps-controls.test.ts test/app/fps-audio.test.ts test/app/fps-effects.test.ts`
    passed 17 tests.
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `git diff --check`
- Committed implementation:
  - `20866fb3` — `Align FPS jump ceiling handling`

- Aligned two more Starter Kit FPS source fidelity gaps:
  - `references/Starter-Kit-FPS/objects/player.tscn` keeps
    `SoundFootsteps` autoplaying at `volume_db = -5`, while
    `objects/player.gd` pauses/unpauses it based on grounded horizontal
    velocity components exceeding `1`. The port now computes actual horizontal
    velocity after character movement, keeps the walking loop owned by the
    audio facade, and mutes/unmutes it using the source threshold and gain.
  - `references/Starter-Kit-FPS/scenes/main-environment.tres` uses
    `sprites/skybox.png` as a panorama sky with `energy_multiplier = 0.5`.
    The port now loads that texture, derives an ECS cube texture asset through
    a renderer-independent equirectangular-to-cubemap helper, and spawns
    `skybox.main` at source intensity `0.5`.
- Aperture/library work:
  - Added `spawn.skybox(...)` to `@aperture-engine/app/systems`, so generated
    app systems can author skyboxes through the same app spawn facade as
    cameras, lights, fog, meshes, particles, physics, GLTFs, and prefabs.
  - Added `createEquirectangularCubeTextureAsset(...)` in
    `@aperture-engine/render` for byte-backed RGBA 2D panorama sources. The
    helper uses the same +Z-centered equirect UV convention as the existing
    WebGPU equirect-to-cube compute path, but outputs a renderer-independent
    cube `TextureAsset`.
  - Checkpointed a small app input hardening fix: same-frame virtual press plus
    release events now remain visible for one simulation frame before the
    virtual edge is cleared.
- Aperture proof:
  - Restarted the managed FPS app through `pnpm --dir fps exec aperture dev up
    --open --port 5173` and waited for WebGPU.
  - `ecs_find_entities {"key":"skybox.main"}` returned one enabled entity with
    `aperture.render.skybox`.
  - `render_get_frame_report {"summaryOnly":true}` reported frame `1570`,
    one view, 16 mesh draws, `skyboxes:1`, 30 draw calls, and diagnostics `0`.
- Validation:
  - `pnpm exec vitest run test/rendering/equirect-cubemap.test.ts test/app/skybox-spawn.test.ts test/rendering/extraction.test.ts`
    passed 70 tests.
  - `pnpm exec vitest run test/app/fps-audio.test.ts test/app/fps-controls.test.ts test/app/fps-effects.test.ts`
    passed 15 tests.
  - `pnpm exec vitest run test/app/input-state-events.test.ts` passed 17 tests.
  - `pnpm --filter @aperture-engine/render run typecheck`
  - `pnpm --filter @aperture-engine/app run typecheck`
  - `pnpm --filter @aperture-engine/render run build`
  - `pnpm --filter @aperture-engine/app run build`
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `git diff --check`
- Committed implementation:
  - `79136c79` — `Align FPS footstep audio with source`
  - `05c40843` — `Add FPS source panorama skybox`
  - `bec7cb87` — `Preserve same-frame virtual input presses`

- Enemy attack ownership:
- Aligned FPS enemy attack ownership with the upstream per-enemy attack model:
  - `references/Starter-Kit-FPS/objects/enemy.gd` gives each enemy its own
    timer/raycast attack path. The port no longer selects only the nearest
    living enemy on each shared attack tick.
  - `PlayerSystem` now iterates every living enemy within
    `ENEMY_ATTACK_DISTANCE` and line of sight, applying damage/audio and
    triggering that attacker's own per-enemy muzzle effect entities.
  - The attacker filter is exposed as a focused `sourceEnemyAttackers(...)`
    helper with unit coverage for alive/range/line-of-sight filtering.
- Aperture proof:
  - Restarted the managed FPS app through `pnpm --dir fps exec aperture dev up
    --open --port 5173` and waited for WebGPU.
  - `ecs_find_entities {"key":"effect.enemy.0.muzzle.0"}` and
    `ecs_find_entities {"key":"effect.enemy.3.muzzle.1"}` each returned one
    sprite entity with hidden baseline alpha `0`.
  - `render_get_frame_report {"summaryOnly":true}` reported frame `1177`,
    one view, 16 mesh draws, 29 draw calls, and diagnostics `0`.
- Validation:
  - `pnpm exec vitest run test/app/fps-controls.test.ts test/app/fps-effects.test.ts`
    passed 13 tests after the helper extraction.
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `git diff --check`
- Committed implementation:
  - `5bb6b7cb` — `Align FPS enemy attack ownership`
  - `f3c31dc8` — `Extract FPS enemy attacker selection`

- Source basis and enemy muzzle ownership:
- Aligned FPS source-basis control helpers and enemy muzzle ownership with the
  upstream scene model:
  - Camera forward/right helpers now match `quatFromEulerYXZ(...)` rotation of
    local camera axes. The focused tests now prove `yaw = Math.PI / 2` moves
    forward along negative X and strafes right along negative Z, matching the
    camera quaternion basis.
  - Buffered jump consumption is now a testable helper and is checked again
    after ground contact refreshes `jumpsRemaining`, so a just-before-landing
    jump buffer can still consume after the source-style grounded refresh.
  - `references/Starter-Kit-FPS/objects/enemy.tscn` owns two muzzle
    `AnimatedSprite3D` children per enemy. The port now spawns per-enemy muzzle
    effect entities (`effect.enemy.0.muzzle.0` ...
    `effect.enemy.3.muzzle.1`) instead of one global enemy muzzle pair.
- Aperture proof:
  - Restarted the managed FPS app through `pnpm --dir fps exec aperture dev up
    --open --port 5173` and waited for WebGPU.
  - `ecs_find_entities {"key":"effect.enemy.0.muzzle.0"}` and
    `ecs_find_entities {"key":"effect.enemy.3.muzzle.1"}` each returned one
    sprite entity with hidden baseline alpha `0`.
  - `ecs_find_entities {"key":"effect.enemy-muzzle.0"}` returned zero
    summaries, proving the old global enemy muzzle key is gone.
  - `render_get_frame_report {"summaryOnly":true}` reported frame `245`,
    one view, 16 mesh draws, 29 draw calls, and diagnostics `0`.
- Validation:
  - `pnpm exec vitest run test/app/fps-controls.test.ts test/app/fps-effects.test.ts`
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `git diff --check`
- Committed implementation:
  - `85cb569d` — `Align FPS source basis and enemy muzzle ownership`

- Enemy muzzle source-child placement:
- Aligned FPS enemy muzzle flash placement with upstream Godot child-transform
  behavior:
  - `references/Starter-Kit-FPS/objects/enemy.tscn` places `MuzzleA` and
    `MuzzleB` as `AnimatedSprite3D` children of the enemy root at local offsets
    `[-0.45, 0.3, 0.4]` and `[0.45, 0.3, 0.4]`.
  - `references/Starter-Kit-FPS/objects/enemy.gd` rotates the enemy root with
    `look_at(player.position + Vector3(0, 0.5, 0), Vector3.UP, true)`, so
    muzzle offsets inherit both yaw and pitch.
  - The port now routes enemy muzzle offsets through the same source-style look
    quaternion used for the visible enemy root instead of applying yaw-only
    placement.
- Aperture proof:
  - Restarted the managed FPS app through `pnpm --dir fps exec aperture dev up
    --open --port 5173`, waited for WebGPU, and used generated movement toward
    `enemy.0`.
  - The enemy attack path still fired through normal generated input; `fps.state`
    reported health dropping to `90`, and `render_get_frame_report
    {"summaryOnly":true}` reported diagnostics `0`.
  - `ecs_find_entities` read `effect.enemy-muzzle.0` and
    `effect.enemy-muzzle.1`; their random source-style rotations remained in the
    upstream `+/-45 degree` range. The live read missed the short visible muzzle frame
    after pausing, so exact placement is pinned by the focused unit test.
- Validation:
  - `pnpm exec vitest run test/app/fps-controls.test.ts test/app/fps-effects.test.ts`
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `git diff --check`
- Committed implementation:
  - `c6b0fa33` — `Align FPS enemy muzzle placement`

- Sprite effect opacity:
- Aligned FPS shot-effect opacity with upstream Godot `AnimatedSprite3D`
  behavior:
  - `references/Starter-Kit-FPS/objects/impact.tscn` plays a four-frame
    non-looping `shot` animation at `30fps` and queues the node free on
    `animation_finished`; it does not fade modulate alpha over lifetime.
  - `references/Starter-Kit-FPS/sprites/burst_animation.tres` does the same
    source-style discrete frame playback for muzzle flashes, with a final null
    frame for the hidden/resting state.
  - The port now uses a testable `fps/src/lib/fps-effects.ts` helper for
    source-style frame selection and constant visible-frame opacity. Impact,
    player muzzle, and enemy muzzle sprites stay at alpha `1` while their
    current source frame is visible, then hide at the end/null frame.
- Aperture proof:
  - Reloaded the managed FPS app, waited for WebGPU, paused simulation, aimed
    at `enemy.0`, and fired through generated `shoot`.
  - The shot reported `shotsFired:1`, `hits:3`, and `enemy.0` health `25`.
  - Immediate `ecs_find_entities {"key":"effect.impact-hit"}` reported
    `atlasFrame:0`, `uvRect:[0,0,0.5,0.5]`, `color:[1,1,1,1]`, and
    `renderSprite.depthMode:"disabled"`.
  - After the animation elapsed, `effect.impact-hit` reported translation
    `[0,-100,0]`, full fallback UVs, and `color:[1,1,1,0]`.
- Validation:
  - `pnpm exec vitest run test/app/fps-effects.test.ts test/app/fps-controls.test.ts`
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
- Committed implementation:
  - `99aa7fbf` — `Align FPS sprite effect opacity`

- Control proof and CLI client cleanup coverage:
- Reproved the latest reported FPS controls through Aperture MCP/CLI tools on
  the managed `fps/` session:
  - Generated `shoot` input from a paused deterministic step incremented
    `shotsFired` by `1` and set `shotCooldown` to `0.25`.
  - Canvas `input_pointer_click` on the running app incremented `shotsFired`
    by `1`, proving the browser click path still drives shooting.
  - Generated `move` and browser `KeyW` input at yaw `Math.PI / 2` moved the
    player by `+0.083333` on X and `0` on Z, proving movement is relative to
    camera yaw.
  - Browser `Space` input raised the player by `0.127778`, set
    `grounded:false`, `verticalVelocity:7.666667`, and `jumpsRemaining:1`.
  - An aimed shot from spawn toward `enemy.0` registered `3` pellet hits and
    changed enemy health `100 -> 25`, proving fired shots still damage hitboxes.
- Investigated an apparent Aperture tool/browser cleanup concern. Playwright
  `connectOverCDP` cleanup remained the existing `browser.close()` path; added
  `test/cli/tool-client.test.ts` to cover that browser-backed CLI tools close
  their Playwright CDP client after use.
- Validation:
  - `pnpm exec vitest run test/cli/tool-client.test.ts test/app/fps-controls.test.ts`
  - `pnpm --filter @aperture-engine/cli run build`
  - `pnpm --filter @aperture-engine/cli run typecheck`
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run build`

- Impact sprite depth:
- Added first-class sprite depth-mode authoring so ECS-authored sprites can opt
  into source-style no-depth-test rendering without app-local WebGPU plumbing.
- New render API/data path:
  - `SpriteDepthMode.Test` remains the default and preserves existing sprite
    behavior.
  - `SpriteDepthMode.Disabled` validates through authoring, extracts into quad
    batches, survives packed snapshot encoding, and specializes WebGPU sprite
    pipelines with `depthCompare: "always"` while keeping depth writes disabled.
  - App/entity summaries now expose `renderSprite.depthMode` so Aperture tools
    can prove authored depth behavior.
- Aligned FPS `effect.impact-hit` with upstream
  `references/Starter-Kit-FPS/objects/impact.tscn`, where the source
  `AnimatedSprite3D` sets `no_depth_test = true`.
- Aperture proof:
  - Reused the managed FPS session at `http://127.0.0.1:5173/`; WebGPU
    readiness returned `webgpuOk:true`.
  - `ecs_find_entities {"key":"effect.impact-hit"}` reported
    `renderSprite.depthMode:"disabled"`.
  - `ecs_find_entities {"key":"effect.muzzle-burst"}` reported the default
    `renderSprite.depthMode:"test"`.
  - `render_get_frame_report {"summaryOnly":true}` reported frame `357`,
    one view, 16 mesh draws, 29 total draw calls, and `diagnostics:0`.
- Validation:
  - `pnpm exec vitest run test/rendering/extraction.test.ts test/rendering/snapshot-packed-encoding.test.ts test/webgpu/sprite-pipeline.test.ts test/app/developer-api.test.ts`
  - `pnpm --filter @aperture-engine/render run typecheck`
  - `pnpm --filter @aperture-engine/webgpu run typecheck`
  - `pnpm --filter @aperture-engine/app run typecheck`
  - `pnpm --filter @aperture-engine/render run build`
  - `pnpm --filter @aperture-engine/webgpu run build`
  - `pnpm --filter @aperture-engine/app run build`
  - `pnpm --filter @aperture-engine/cli run typecheck`
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `git diff --check`
- Committed implementation:
  - `81ab390e` — `Add sprite depth mode for FPS impacts`

- Source-like HUD:
  - Aligned the visible FPS browser HUD with upstream `scenes/main.tscn` and
    `scripts/hud.gd`: only the crosshair image and large health percentage
    remain visible.
  - Removed the port-only weapon counter, enemy counter, clear banner, hit
    flash, damage flash, and enemy-destroyed overlay from the DOM/CSS/browser
    HUD layer.
  - Kept generated gameplay signals/resources intact for proof and future
    tooling; this is only a visible HUD parity change, not a simulation-state
    removal.
  - Aperture proof:
    - Fresh managed FPS session at `http://127.0.0.1:5173/`, WebGPU healthy.
    - `render_get_frame_report {"summaryOnly":true}` reported one view, 16 mesh
      draws, 29 total draw calls, and `diagnostics:0`.
    - `browser_screenshot` wrote `/tmp/fps-source-like-hud.png`; visual
      inspection showed only crosshair plus bottom-left `100%` health over the
      WebGPU scene.
    - `browser_console_logs {"lines":20}` showed only Vite reconnect/debug lines
      plus the known deprecated-parameter warning.
  - Validation:
    - `git diff --check -- fps/index.html fps/src/hud.ts`
    - `pnpm exec vitest run test/app/fps-controls.test.ts`
    - `pnpm --dir fps run typecheck`
    - `pnpm --dir fps run build`
    - `pnpm --dir racing run typecheck`
    - `pnpm --dir racing run build`
    - `pnpm --dir shadow-lab run typecheck`
    - `pnpm --dir shadow-lab run build`
  - Committed implementation:
    - `f293ecdf` — `Align FPS HUD with source`

- Enemy hitbox and look target:
  - Aligned enemy hitboxes with upstream `objects/enemy.tscn`: the source
    `CollisionShape3D` sphere is offset by local `y=0.25`, and the port now
    applies the same offset to each keyed ECS hitbox entity at spawn time and
    during per-frame enemy hover updates.
  - Aligned enemy facing with upstream `objects/enemy.gd`: enemies now pitch/yaw
    toward `player.position + Vector3(0, 0.5, 0)` instead of yaw-only look.
  - Kept gameplay authority in ECS by writing `LocalTransform` on the visible
    enemy roots and `${enemy}.hitbox` physics entities; no renderer-owned
    collision or aim state was introduced.
  - Committed implementation:
    - `684ccc2f` — `Align FPS enemy hitbox and look target`

- Player damage threshold:
  - Aligned player damage/reload semantics with upstream
    `objects/player.gd::damage(amount)`: player health now reaches exactly `0`
    without resetting, and the scene-style reset only happens once health drops
    below `0`.
  - Removed the enemy attack damage clamp, so source-style repeated
    `collider.damage(5)` calls can move health from `0` to `-5` instead of
    sticking at zero.
  - Committed implementation:
    - `f3ed9e1f` — `Align FPS player damage threshold`

- Weapon viewmodel motion:
  - Replaced the FPS weapon-view cooldown recoil approximation with a source-like
    viewmodel offset from upstream `objects/player.gd`: the active weapon now
    lerps toward `-localVelocity / 30`, and shooting adds a transient `+0.25`
    local-Z kick before smoothing back.
  - Kept this ECS-owned by writing `LocalTransform` on the keyed weapon entities
    (`weapon.0`, `weapon.1`). No renderer-owned first-person weapon container was
    introduced.
  - Extracted `weaponViewmodelOffsetTarget(...)` into `fps/src/lib/fps-controls.ts`
    and covered forward, strafe, and diagonal normalization in
    `test/app/fps-controls.test.ts`.
  - Committed implementation:
    - `582cfed3` — `Add FPS weapon viewmodel kick`
    - `60df8919` — `Cover FPS weapon viewmodel offset`

- Input hardening and impact placement:
  - Hardened the browser-facing FPS shoot path by forwarding primary
    `pointerdown` / `pointerup` events through the same generated `shoot`
    action used for pointer-lock mouse input.
  - Added a short `0.12s` jump buffer and prevented lingering grounded contact
    from cancelling the jump frame.
  - Added source-like impact placement from upstream `objects/player.gd`:
    impact sprites now use nearest raycast hit point plus `normal / 10`.
  - Committed implementation:
    - `f64cb627` — `Harden FPS input handling`

- Generated `resource_set` proof tooling:
  - Added schema-validated generated-worker `resource_set` support so Aperture
    CLI/MCP tools can patch initialized app resources by id during deterministic
    proof setup.
  - Registered `resource_set` in the CLI/MCP tool surface and documented the
    now-current resource get/set decision.
  - Used the new tool in the FPS proof instead of app-specific debug hooks:
    `resource_set` fixed the player yaw for deterministic setup, generated
    `move` input drove the real character controller into enemy range, health
    changed `100 -> 95`, and `ecs_find_entities` read enemy muzzle sprite
    rotations `-0.363` and `-0.516` radians, both inside the upstream `±45°`
    roll range.
  - Committed implementation/tooling:
    - `2f4773e7` — `Add generated resource set tool`

- Muzzle flash random style:
  - Added source-style muzzle flash randomization from upstream
    `objects/player.gd` and `objects/enemy.gd`.
  - Player shots now sample the authored `randf_range(-45,45)` sprite roll and
    `randf_range(0.40,0.75)` sprite scale for `effect.muzzle-burst`.
  - Enemy attacks now sample independent source-like Z rolls for both
    `effect.enemy-muzzle.0` and `effect.enemy-muzzle.1`.
  - Kept the effect state ECS-owned by writing `Sprite.rotation` and
    `LocalTransform.scale`; no renderer-owned effect objects or gameplay state
    were introduced.
  - Validation:
    - `pnpm exec vitest run test/app/fps-controls.test.ts`
    - `pnpm --dir fps run typecheck`
    - `pnpm --dir fps run build`
    - `pnpm run typecheck`
    - `pnpm run typecheck:test`
    - `pnpm --dir racing run typecheck`
    - `pnpm --dir racing run build`
    - `pnpm --dir shadow-lab run typecheck`
    - `pnpm --dir shadow-lab run build`
    - Aperture CLI/runtime proof from `fps/`: `browser_reload`,
      `browser_wait_for_webgpu`, generated `input_action_set`, `ecs_step`,
      `ecs_find_entities`, `ecs_get_entity`, and `resource_get`.
    - Proof observed player muzzle `shotsFired:1`, sprite scale
      `[0.4168,0.4168,0.4168]`, `Sprite.rotation:-0.2156`, and alpha `0.8333`.
    - Proof observed enemy range still gated correctly (`farHealthDelta:0`,
      `nearHealthDelta:-5`) and both enemy muzzle sprites had source-like roll:
      `0.213` and `-0.0584`.
  - Committed implementation:
    - `861368bd` — `Randomize FPS muzzle flash style`

## Earlier Completed FPS Slices

- Player shadow proof cleanup:
  - Extracted FPS `player.shadow` setup into `#spawnPlayerShadow()` while
    keeping the existing upstream-textured blob material/sampler path intact.
  - Reproved the textured blob after an explicit Aperture `browser_reload`.
    Important tooling note: proof screenshots written under `fps/.aperture/`
    triggered Vite reloads during this run; write inspection screenshots to
    `/tmp` when the app must stay stable.
  - Close inspection proof used a low-priority Aperture agent camera fitted to
    `player.shadow`, disabled frustum culling only on that proof camera, and
    compared normal scale against a temporary scale-zero shadow. The visible and
    hidden captures differed (`43825` vs `35395` bytes), with local PNG
    analysis reporting `207995` changed pixels and max channel-distance `26`.
    The shadow scale was restored to `[1,1,1]` afterward.
  - Committed implementation cleanup:
    - `e884df65` — `Extract FPS player shadow setup helper`
- Canvas shooting and enemy attack range:
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

- `git diff --check -- fps/index.html fps/src/hud.ts`
- `pnpm exec vitest run test/app/fps-controls.test.ts`
- `pnpm --dir fps run typecheck`
- `pnpm --dir fps run build`
- `pnpm --dir racing run typecheck`
- `pnpm --dir racing run build`
- `pnpm --dir shadow-lab run typecheck`
- `pnpm --dir shadow-lab run build`
- Aperture CLI/runtime proof from `fps/`:
  - Restarted managed FPS at `http://127.0.0.1:5173/`;
    `browser_wait_for_webgpu` succeeded with `webgpuOk:true`.
  - `render_get_frame_report {"summaryOnly":true}` reported `diagnostics:0`.
  - `browser_screenshot` wrote `/tmp/fps-source-like-hud.png`; visual
    inspection confirmed the source-like visible HUD: crosshair plus bottom-left
    health only.
  - `browser_console_logs {"lines":20}` showed only Vite reconnect/debug lines
    plus the known deprecated-parameter warning.
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

- No managed FPS session should be left running after final cleanup. If a future
  proof needs the app, start it with
  `pnpm --dir fps exec aperture dev up --headless --port 5173`.
- The latest HUD slice deliberately removed browser-only visible status
  elements, but generated `fps.state` values and signal summaries still expose
  `weaponName`, `enemiesRemaining`, `gameStatus`, hit/damage pulses, and related
  proof data to Aperture tools.
- The generated-input full-clear proof now has a working platform-aware route.
  The earlier failed straight-line route fell below the level after `enemy.2`;
  the successful proof instead uses explicit platform waypoints and jump arcs
  before claiming `gameStatus:"cleared"`.
- Pre-existing untracked screenshots,
  racing parity artifacts, and `racing/parity/` remain outside commits.
- Muzzle flash proof reads should use `ecs_find_entities` / `ecs_get_entity`
  immediately after the shot/attack frame; reset correctly hides the effect
  sprites and restores baseline scale/rotation.
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
next options are improving enemy attack polish, adding more source-like
weapon/player detail parity, filling any remaining impact-rendering differences
such as depth behavior, or packaging the platform-aware full-clear route into a
reusable smoke script so future regressions can re-run the proof without
retyping the route.

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
