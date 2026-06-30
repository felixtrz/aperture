# Aperture headless battle-test — running findings log

Start: 2026-06-30T19:08:00Z. Env: Node v22.22.2, pnpm 10.x, Linux 6.18.5 x86_64, 4 CPUs, no real GPU (SwiftShader).

## Packing & install (PASS)
- Built workspace with `pnpm run build` (tsc -b), packed 12 pkgs via `pnpm --filter <name> pack`.
- `workspace:^` specs correctly rewritten to `^0.2.0` in tarballs → install needs pnpm.overrides → file: tgz.
- Toolbox install of packed CLI worked; `aperture create ../app --template game` scaffolded.
- App install from tgzs (overrides) worked; `node_modules/.bin/aperture` present and runnable.
- `tsc --noEmit` of the app against PACKED .d.ts: exit 0 (strict, NodeNext, exactOptionalPropertyTypes). Packed type closure is sound.

## Headless one-shot `aperture headless` (PASS)
- placeholder/hybrid/strict asset modes all work. strict loads + parses the real GLB in pure Node (assetProvenance real:10, placeholders:0).
- Bundle format aperture.render-bundle; snapshot codec json-typed-array-v1; closure roots = referenced mesh/material assets.
- meshDraws reflect REAL frustum culling + camera-follow system (not naive entity count). Verified: finish.flag (x=3.8) culled at camera x=0/-3.5; enters frustum after camera follows player right. Positive fidelity finding.
- NO `--seed` flag on one-shot (only serve has it) → one-shot RNG seed is fixed. LIMITATION.

## Headless serve `aperture headless serve` (PASS)
- NDJSON protocol works: ready → step/extract/inject/get-status/bundle/tool/reset/shutdown.
- `step {frames:N}` supported. Per-step time = (frame-1)*delta ("time at start of step"). Verified hazardX oscillation matches analytical sin to 6 decimals.
- get-status exposes entities(summaries: key,name,componentIds,tags), signals, resources, input, assets, diagnostics, fixedStepClock.
- extract returns compact counts {views,meshDraws,lights,bounds,diagnostics}.

## Input injection
- `inject` / `--inject` support ONLY pointer + BUTTON actions (pressed/released). axis2d (e.g. `move`) NOT injectable via inject. FINDING/asymmetry.
- axis2d drivable via serve `tool input_action_set {action,x,y}`. Note: tool's synchronous echo shows pre-drain value (x:0) because the event is queued for next step; it DOES apply on step. Minor echo nuance.
- Button jump via serve inject works (edge-detected .down()); produced correct deterministic parabola (gravity*dt^2 = 0.005/frame).

## Entity tools
- `ecs_get_entity` does NOT accept `{key}` — resolves by explicit {index,generation} or falls back to LAST query's first result. Passing {key} is silently ignored → can return WRONG entity. FOOTGUN.
- Idiomatic: `ecs_query {key}` (filters correctly) then `ecs_get_entity` (uses lastFind[0]).
- ecs_query filters: key, namePattern, withComponents, `tags`(ARRAY), source, limit. Singular `tag` silently ignored → returns everything. FINDING.
- ecs_set_component_field needs `{component, field, value}` (NOT componentId). Works.
- ecs_snapshot + ecs_diff work (diff lists changed entities/fields after stepping).
- camera tools: camera_get/list/look_at/orbit/fit_entity/save/restore/set_transform/create_agent/use_agent_view. camera_list works.
- resource_get works (0 resources). resource_set on missing id → graceful aperture.resource.notFound. unknown tool → aperture.headless.toolUnavailable. bogus command → "Unknown command".

## Determinism (PASS — headless-exclusive strength)
- `--determinism warn` warns + exit 0; `--determinism error` errors + exit 1 (aperture.headless.determinismViolation).
- Diagnostics precisely name system/api/phase/suggestedFix. Caught Math.random + Date.now in BadDeterminismSystem.
- App systems using this.time/this.random pass the gate.
- Replay determinism: seed 1 run A vs run B → IDENTICAL bundle digest 8a19ecd1 / byteLength 32394. seed 2 → b750fc82 (different layout). 
- reset {seed} IS functional (deterministically re-seeds; matches boot --seed layouts) but status reports seed=undefined. Minor reporting gap.
- One-shot `--inject` vs serve `inject` for identical schedule → IDENTICAL snapshot.value/closure/assetProvenance. Full-bundle digest differs ONLY due to engine.createdBy metadata. Bundle digest is NOT a pure-sim digest. FINDING.

## MCP stdio `aperture mcp stdio` (PASS) — documented primary loop
- initialize → server {aperture 0.2.0}, protocol 2025-06-18; tools/list = 46 tools.
- app_start(headless), ecs_step{frames}, ecs_query{tags}, app_status, logs_read all OK.
- logs_read surfaces app diagnostics (game.coin.spawned/collected). Diagnostics pipeline works.

## Headed render `aperture render` (NUANCED)
- Boots real Chrome + WebGPU (SwiftShader/Vulkan); reports ok + adapter features.
- HEADLESS browser (APERTURE_RENDER_HEADLESS=1): output is 100% WHITE (255,255,255). Broken canvas screenshot capture under headless WebGPU. Repo docs (BROWSER_E2E_RENDERING.md) confirm headless screenshot captures are blank; e2e trusts GPU READBACK, CLI render only screenshots (no readback fallback).
- `isPngBlank` only catches all-BLACK (blackCoverage>=0.995 && maxLuma<=4); all-WHITE passes as success → FALSE-POSITIVE "ok" on a blank render. BUG.
- Under xvfb-run (headed, real X server): renders CORRECTLY. 165 distinct colors; dark-green ground (43,69,59), blue player, teal goal GLB gem, brown hazard, red finish flag. Visual matches headless closure (6 meshes) EXACTLY.
- Capture shows page scrollbars (screenshot of #aperture-canvas includes page chrome). Minor cosmetic.

## Headed MCP frame_capture (FINDING)
- Launches a HEADED browser by default → fails without X server: "launched a headed browser without having a XServer running". No auto-xvfb. Different failure mode than `aperture render`.

## Headed live `aperture dev` (PASS)
- dev up --headless --gpu software: started daemon + Vite + browser. AUTO-PROVISIONS its own xvfb (:99 1280x800x24) — unlike render/frame_capture.
- dev status/logs/down all work. browser_status, ecs_step against LIVE browser work.
- Live app FREE-RUNS in real-time (RAF): reached frame 7725 / elapsed 32.4s before ecs_step paused it. Core contrast vs headless paused/explicit-step clock.

## Timing
- headless boot ~1.4s; +1 frame vs +600 frames = +0.38s → ~0.6ms/frame. Warm serve amortizes boot.
- headed render ~3.6s (browser+WebGPU boot).

## Edge cases / error handling
- Missing config → aperture.headless.configNotFound (exit 1). Clean.
- strict mode, missing local asset → aperture.cli.failed: ENOENT realpath (exit 1). Raw fs error, not a structured asset diagnostic. Minor finding.
- HTTP asset without --allow-http-assets → "Node asset loader does not fetch 'https:' assets unless allowHttp is enabled" (exit 1). Security default enforced.
- System throws in update → aperture.cli.failed: <message> (exit 1). Surfaces error, generic code.
- Non-erasable TS (enum) → aperture.headless.configLoadFailed with precise "enum not supported in strip-only mode" + erasable-TS guidance. Excellent.

## Scale / performance
- 2000 entities, 120 frames one-shot: ~10.9s wall, determinism=error passed, 9.5 MB bundle, 4000 asset entries (each box mesh + material is a DISTINCT asset; no auto-dedup — authoring should share assets).
- Per-step (warm serve): 7-entity game app ~0.6 ms/frame (~1666 fps-equiv); 2000-entity swarm ~65.9 ms/frame (~15 fps-equiv). Per-step cost scales with scene complexity because each step also extracts a full RenderSnapshot.
- Boot+teardown of a warm serve session ~2.4s.

## Repo regression gates (all PASS in this env)
- check:headless-boundaries: passed (11 files).
- check:render-bundles: passed (1 fixture).
- check:pack-cli: passed.
- check:pack-cli:render: passed WITH render smoke — but the smoke only checks exit-code + PNG existence; the produced 64x64 headless render is 100% white (confirmed). CI pixel-confidence is illusory in headless/software-WebGPU. Concrete consequence of the isPngBlank white gap + screenshot-capture path.

## Cross-checks
- one-shot default seed == 0 (one-shot 85-frame snapshot.value identical to serve --seed 0). 
- frame_capture under xvfb-run: WORKS, real pixels (278 colors, green ground present). Without a display: fails to launch (headed browser). So the only broken pixel path is the HEADLESS-browser screenshot capture (APERTURE_RENDER_HEADLESS=1); every real-display path renders correctly.
- aperture dev auto-provisions xvfb; aperture render/frame_capture do not.

## Headed build pipeline
- vite build (packed @aperture-engine/vite-plugin): PASS. 603 modules, 789ms. Emits worker-entry chunk (worker/main split), main+audio chunks, copies goal-cube.glb. Packed plugin produces a working production bundle.

## Determinism enforcement is one-shot-only (F11)
- Serve mode does NOT abort on --determinism error (no assertDeterminismPolicy in serve). Session keeps running.
- Serve surfaces determinism diagnostics ONLY in get-status.diagnostics (count 2 for Math.random+Date.now) — NOT in step results and NOT on stderr. Easy to miss.
- One-shot `aperture headless --determinism error` is the only hard gate (exit 1).

## Input paths (detailed)
- input_gamepad_set {index,axes:[x,y,..]} drives axis2d move via gamepadStick("left"). Stick value PERSISTS across steps (cleaner than input_action_set which queues a one-shot virtualAction). Verified: left-stick X=1 → player +3.0 units / 60 frames.
- input_pointer_move / input_pointer_set: UNAVAILABLE in headless (aperture.headless.toolUnavailable) — browser-only. Use inject {pointer} instead.
- inject pointer position is NORMALIZED [0,1] (not pixels) and CLAMPED: [0.5,0.25]→as-is, [-3,9]→[0,1], [10,20]→[1,1]. Help text doesn't say this. Minor doc gap.
- input_get_state, input_reset: available in headless.

## fixedUpdate / physics NOT wired in headless (F12 — significant)
- A system's fixedUpdate() never fires through `aperture headless` (one-shot OR serve). fixedTicks=0, fixedStepClock=null after stepping; update() fires normally.
- Adding `physics: { backend:"rapier", gravity }` to the headless config changes NOTHING (still fixedStepClock=null, no diagnostic, exit 0).
- Root cause: createApertureApp (advanced.ts:142) reads physics from `options.physics`, never `options.config.physics`. The worker/browser loop (worker/loop.ts:63,82) translates config.physics → options.physics; the headless runner (headless.ts) calls createApertureApp({...options, config}) WITHOUT that translation, so config.physics is silently dropped.
- Consequence: physics-based games + any fixedUpdate system can't be validated headlessly; and a SHARED config with a physics block diverges silently between browser (physics on) and headless (physics off). No warning.
- Corroboration: only the non-physics city-builder showcase has a headless config; fps/platformer/racing (all physics) do not.
- Suggested fix: headless runner should mirror resolveConfigPhysicsOption(config.physics) like worker/loop.ts, or at minimum emit a diagnostic when config.physics is present but dropped.

## Misc CLI surfaces
- reference status/search work; unwarmed search fails gracefully ("corpus is not warmed"). CLI subcommand is `search`, but package README/programmatic API call it `query` (naming mismatch).
- adapter sync: clean dir writes 7 files; re-run is idempotent (Unchanged:7, no conflicts).
- ecs_list_systems lists systems in execution/priority order (Setup,Player,Spawner,Hazard,CameraFollow) but does NOT expose the numeric priority value.
- render of a placeholder bundle without --allow-placeholders SUCCEEDS when the placeholder asset isn't in the draw closure (closure validates REFERENCED assets only — correct behavior).

## SessionSnapshot capture/restore (PASS, but library-only) — F15
- createApertureSessionSnapshot(runner) + runner.restoreSessionSnapshot(snap) work and are DETERMINISTIC: restore returns exact frame-30 state (acc30==acc30_restored), and continuation after restore is bit-identical (acc50_a==acc50_b). RNG + time state captured. (edge/session-snapshot-probe.mjs)
- BUT this powerful checkpoint/continuation capability is NOT exposed in the `aperture headless serve` / MCP protocol — serve only offers `reset` (full rebuild). An agent-driven loop can't branch/checkpoint a session. Recommend exposing snapshot/restore as serve commands.

## Physics capability in Node (F12 proof)
- createApertureApp with explicit physics:{backend:rapier,gravity}+fixedStep ran fixedUpdate 10/10 steps, populated fixedStepClock (maxSubsteps 4), initialized rapier 0.19.3 in pure Node. Confirms F12 is wiring-only. (edge/physics-capability-probe.mjs)

## Resources + query filters (PASS)
- defineResource("id", {field: resource.number/string/vec3/...}) works. resource_get exposes field schema (name+kind) + values + version. resource_set live-mutates fields (set ticks=999, version bumps, system update continued from 999→1000). Earlier resources=0 was just because the game app defined none.
- this.resources.read(R) / this.resources.write(R, next => {...}) — clean API; init-time write + per-step write both work.
- ecs_query filters all work: key, tags[array], withComponents[array] (mesh-only returned ground/player/finish/hazard), namePattern ("Light"→Key/Fill Light), limit. Only the singular `tag` typo silently no-ops (F4).

## Command bus is host-driven; not dispatchable in headless (F16)
- System CommandAccess is drain-only (drain<T>(channel)); systems can't dispatch. App commands originate from the browser host/HUD (e.g. city-builder hud.ts dispatchCommand → worker postMessage).
- The headless serve/MCP protocol has NO command-dispatch path (only input `inject` + devtools `tool`s). So command-driven gameplay (city-builder builder/camera) can't be exercised headlessly. Input-ACTION-driven gameplay is fine (injectable); command-CHANNEL-driven is not.
- Suggestion: add a serve `command`/`dispatch` verb (and MCP tool) to post app commands to the headless runner.

## Hierarchy + cascade despawn (PASS) and the no-typecheck footgun (F17)
- transform:{ parent } parenting works: ecs_get_hierarchy shows tree.parent -> [child.0,1,2]; despawnRecursive(parent) cascades (all tree entities removed).
- FOOTGUN: `parent` is a field of transform (SystemTransformInput), not a top-level spawn option. I initially passed top-level `parent` to spawn.mesh — silently IGNORED (children unparented, no cascade, no error). Because the headless loader uses native TS stripping with NO type-checking, option-shape mistakes that tsc would reject pass silently and produce wrong behavior. The scaffold's `pnpm typecheck` catches it, but `aperture headless` itself does not. Recommend pairing headless runs with tsc, or validating known spawn option shapes.

## Determinism gate completeness + audio (PASS)
- Determinism gate catches ALL 4 documented globals across init AND update: Math.random, Date.now, performance.now, new Date (verified new Date in init + performance.now in update → both errored, exit 1).
- Audio authoring works headlessly: this.audio.loop / playOneShot create ECS emitter entities (audio.loop.test.loop, audio.oneshot.test.oneshot) with no audio device; audio assets are tracked (ready:false, not played). Confirms the documented boundary: ECS audio authoring is headless-validatable; device playback is browser-only.

## Strict-mode advanced assets in Node (PASS)
- RGBE HDR environment map (asset.hdr): strict mode loaded it for real in pure Node (assetProvenance real:1, placeholderCount:0). Confirms the documented strict-asset capability (GLB/glTF verified earlier; HDR here). KTX2/Draco/meshopt require --decoder-assets-dir (not exercised; no local decoder set).

## ECS render-feature authoring works headless (PASS) + more F17 evidence
- spawn.fog, spawn.proceduralSky, spawn.particles all create ECS entities headlessly. These are renderer-independent ECS entities, so structural authoring is validatable in Node (pixels still need the headed path).
- F17 again: my first attempt used type-INVALID options (spawn.fog {kind} should be {mode}; spawn.particles effect kind "burst" should be "particle-effect"). Headless ran them silently and created entities; tsc flagged both (TS2353/TS2322). Fixed to correct types -> tsc clean + headless clean. tsconfig.battletest.json typechecks all authored systems.

## glTF animation works headless (PASS)
- Animated cube glb loaded in strict Node mode (clips=1). this.spawn.animation(model).playClip advances during headless step: Cube rotation interpolated [-0.7071,...] (f3) -> [-0.7052,0.0514,...] (f43). The runtime animation driver runs headlessly; playback is time-driven (deterministic). So skeletal/node animation logic is headless-validatable.

## Rapier physics SIMULATES in Node (F12 strengthened)
- Beyond init: a dynamic rigid body dropped from Y=10 fell to Y=5.24 over 60 fixed steps (drop 4.76m ~= 0.5*9.81*1^2; bodyCount=1, colliderCount=1). Full rapier dynamics work in pure Node via low-level createApertureApp. Confirms F12 is purely the missing config.physics wiring in the headless CLI; the capability is complete.

## Camera tools + ecs_diff (PASS, complete tool coverage)
- camera_look_at (rotation re-aimed), camera_orbit (yaw/pitch/radius/target → repositioned to [4.31,2.74,6.16]) work. camera_fit_entity's {key} selects the CAMERA, not the entity to frame (minor arg nuance; returned camera.notFound for key:player).
- ecs_diff is precise: snapshot -> ecs_set_component_field(player translation) -> diff reports exactly 1 changed entity with fields:["localTransform"] + before/after. Structure: added/removed/changed/unchanged/counts.
- Full devtools tool surface now exercised: ecs_query/get_entity/set_component_field/snapshot/diff/get_hierarchy/get_component_schema/list_systems/pause/resume/step, input_action_set/gamepad_set/get_state/reset (pointer_move/set browser-only), resource_get/set, asset_list, camera_get/list/save/restore/set_transform/look_at/orbit/fit_entity.

## Render bundle input validation (PASS, exemplary)
- aperture render gives clean structured errors for bad input (all exit 1): nonexistent -> aperture.render.snapshotNotFound; malformed JSON / truncated -> aperture.render.invalidBundle (not valid JSON); valid JSON wrong shape -> invalidBundle (expected format "aperture.render-bundle"). Contrast with F9: render INPUT validation is exemplary even though render OUTPUT capture is broken headless (F1).

## Long-run stability + arbitrary delta (PASS)
- Boids 5000 steps: all signals finite (no NaN/explosion), avgSpeed in [MIN,MAX], center bounded. Stable over long runs.
- Non-default fixed delta (1/30): hazardX matches 1+2.5*sin(elapsed*1.6) with elapsed=(frame-1)*delta to <1e-4. The sim handles arbitrary fixed deltas deterministically; the time-at-start-of-step convention holds for any delta.

## reset is a clean rebuild (PASS)
- After stepping the game 200 frames (score 1, hits 3, coins 3), reset {seed} returns frame 0 with all signals at initial (score/hits/coins 0, goalReached false) and the player entity back at spawn (-3.5). System private state (jump count, dash cooldown, velocity) resets because systems are reconstructed. Only issue: reset doesn't report the applied seed (F7).

## Multi-camera + devtools mutation guard (PASS)
- Multi-camera extraction: 2 cameras -> extract views:2 (multi-view works headlessly; each view culls independently).
- ecs_set_component_field is allow-listed to mutable components: it mutates LocalTransform.translation fine, but rejects aperture.metadata.enabled with a clear structured error (aperture.entityLookup.componentMutationUnsupported, "not mutable through the developer entity helper"). Sensible guard against corrupting structural/metadata state; entity enable/disable must be done in a system, not via the devtools tool.

## Pointer picking / interaction works headless (PASS)
- this.interaction.onClick/onDown/hoveredEntity() fire headlessly: injecting a normalized pointer [0.5,0.5] over a centered cube + press/release fired onDown (downs=1) and onClick (clicks=1), and hoveredEntity() resolved. runInteractionFrame runs in the app step path (advanced.js:140); raycasting from the injected pointer through the camera against mesh bounds works in pure Node. Meshes are pickable by default (no special component). One-frame hover latency observed (hover registered by the press frame). So click-to-select / UI interaction logic is headless-validatable.

## Spatial queries work headless (PASS)
- this.spatial.raycastFirst/overlapSphere/closestPoint work EXACTLY in pure Node against BVH-backed box meshes: raycast from (0,0,5) toward -Z hit the 2x2x2 box at distance 4 (face at z=1); overlapSphere([0,0,0],2) found 1 entity; closestPoint([5,0,0])=4 (face at x=1). BVHs are built headlessly. So core gameplay queries (AI line-of-sight, area-of-effect, targeting, collision) are headless-validatable.

## Custom WGSL material authoring works headless (PASS)
- material.customWgsl with shader.inlineWgsl authors headlessly: the custom material + inline shader source are captured as real assets (provenance real:2, mesh+material in closure), exit 0, no GPU needed. Shader COMPILATION is deferred to render time (browser); AUTHORING the shader source is headless. Confirms the boundary: all authoring (even custom shaders) is headless; only pixel production is browser-only.

## Skinned/skeletal character works headless (PASS)
- A rigged Soldier.glb (2.1MB) loaded strict in Node: 4 animation clips, playClip → playing=true, and the full skeleton instantiated as a 50-entity ECS subtree (bones). Skeletal animation advances on the CPU headlessly; GPU skinning happens at render. So even complex rigged characters are headless-validatable for logic/animation-state. (2.1MB GLB gitignored.)

## Extreme-value robustness (graceful, minor codec nuance)
- Injecting an absurd transform (scale 1e308) doesn't crash extraction/bundling: bundle stays valid JSON, deterministic digest, no NaN/Infinity strings. But the value overflows float32 -> Infinity -> the json-typed-array snapshot codec serializes it as `null` (1 null entry observed). So a strict bundle consumer should know non-finite snapshot values are encoded as null. Edge case (needs absurd input); pipeline is graceful. Systems that own an entity (player/hazard) overwrite injected extremes on the next step (self-sanitizing).

## Rapier determinism in Node (PASS) + a collider-config note
- Rapier physics is DETERMINISTIC in Node: single-body free-fall identical across runs (endY 5.237042427062988); an 8-body contact stack produced identical position digests (96516c7b) across runs. So IF config.physics were wired to the headless CLI (F12), physics validation would be reproducible/trustworthy.
- Open observation (root cause UNDETERMINED): dynamic boxes free-fell straight THROUGH a fixed ground (y -> -42 over 3s = pure free-fall, no contact). This persisted even with EXPLICIT box collider shapes on both ground and boxes (identical digest), so it is NOT a missing-shape issue. So gravity integrates but dynamic-vs-fixed contact resolution does not happen in this low-level headless setup. Could be a missing physics-step/solver wiring in the bare createApertureApp path, CCD, collision groups, or a real bug — needs deeper investigation. Caveat: physics is unreachable via the headless CLI anyway (F12); determinism (above) holds regardless. Flagging because if F12 is fixed, contact resolution must also work for headless physics validation to be meaningful beyond free-fall.
