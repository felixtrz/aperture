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
