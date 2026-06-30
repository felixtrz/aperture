# Aperture headless-mode battle-test report

**Author:** Claude (automated dogfooding session)
**Start:** 2026-06-30T19:08:00Z
**Environment:** Node v22.22.2, pnpm 10.x, Linux 6.18.5 x86_64, 4 vCPU, **no hardware GPU** (Chromium falls back to SwiftShader/Vulkan)
**Engine under test:** `@aperture-engine/*` v0.2.0, installed **from freshly-built tarballs** (not the workspace), to mirror a real npm consumer.

---

## 1. What I did

The goal: stand up a sub-directory, build the engine packages to `.tgz`, install them like a published consumer would, then **develop a real application using headless mode**, battle-test the headless flow, and compare it against the headed (browser) flow.

1. **Built + packed** all 12 publishable packages (`pnpm run build` → `pnpm --filter <pkg> pack`) into `headless-battletest/packs/`.
2. **Installed the packed CLI** into a `toolbox/` (using `pnpm.overrides` to point every `@aperture-engine/*` at its tarball) and used it to scaffold an app: `aperture create app --template game`.
3. **Installed the app from tarballs** and developed three new gameplay systems entirely through the headless loop:
   - `hazard.system.ts` — deterministic patrol hazard driven by `this.time`.
   - `spawner.system.ts` — coin spawner using `this.random` (seeded RNG) with runtime spawn/despawn.
   - jump + gravity added to `player.system.ts` — a `button`-action mechanic.
4. **Verified each feature headlessly** via `aperture headless` (one-shot) and `aperture headless serve` (warm NDJSON session), the MCP server (`aperture mcp stdio`), entity/camera/input/resource tools, determinism gating, and replay digests.
5. **Built two more original apps headless-first** — (a) a deterministic **boids/flocking sim** (`boids/`, 36 agents, O(N²) steering) rendered under xvfb (`app/artifacts/boids.s1.xvfb.png`), determinism held (seed 1 → `733e4e71` twice; seed 2 → `9f5890c2`); (b) a **Conway's Game of Life** (`life/`, a non-3D grid cellular automaton) verified against classic invariants headlessly (block still-life: liveCount conserved; blinker: period-2 oscillation); and (c) a complete **side-scrolling platformer level** (`platformer/`) with vertical geometry — solid platforms, a **pit with fall-death**, double-jump traversal, coins, and a goal — whose crossing strategy I *debugged via a headless state trace*, verified with 6 invariants and rendered under xvfb.
6. **Compared against the headed flow**: `aperture render` (bundle → PNG via real WebGPU), MCP `frame_capture`, the live `aperture dev` session, and `vite build`.

All reproduction artifacts live under `headless-battletest/` (`packs/`, `app/`, `app/artifacts/*.bundle.json`, `app/artifacts/*.png`, `serve-driver.mjs`, `mcp-driver.mjs`, `FINDINGS.md`).

---

## 2. Headline verdict

**The headless flow is the strong, trustworthy part of this toolchain and is genuinely usable as a primary development loop.** I built and validated real ECS gameplay — input, movement, collisions, RNG spawning, deterministic time — without ever opening a browser, with sub-millisecond steps and bit-identical replay. Determinism enforcement (`--determinism error`) is a real, headless-exclusive superpower.

**The headed *pixel* path is the fragile part — and worse, it fails silently in this (very common) GPU-less/headless-browser configuration.** `aperture render` and the CI render smoke happily report success while producing a 100%-white frame. Every path that has a real display (xvfb, `aperture dev`) renders correctly, so the engine's rendering is fine; the gap is in the headless-browser *capture* path and its blank-detection.

This is exactly the thesis the architecture docs sell ("headless is the default loop; the browser is the pixel gate") — but the pixel gate is currently a gate that's stuck open.

### Findings at a glance

| # | Sev | One-liner |
|---|-----|-----------|
| F1 | High | `aperture render` (headless browser) outputs an all-white frame yet reports success |
| F2 | High | `isPngBlank` only detects black → blank-white renders pass CI (`check:pack-cli:render`) |
| F12 | High | A `physics` block in a headless config is silently ignored; `fixedUpdate` never fires headlessly (wiring gap — proven to work in Node) |
| F3 | Med | `ecs_get_entity` silently ignores `{key}`, falls back to last query's first result |
| F4 | Med | `ecs_query` singular `tag` / un-injectable axis actions silently no-op |
| F5 | Med | MCP `frame_capture` launches a headed browser with no auto-xvfb → crashes headless |
| F11 | Med | Determinism hard-gate is one-shot-only; warm serve never enforces it |
| F16 | Med | Command bus is host-driven; serve/MCP can't dispatch app commands |
| F17 | Med | Headless loads systems with no type-checking → misplaced options silently ignored |
| F6 | Low | Render-bundle digest folds in `createdBy` → not a pure-sim digest |
| F7 | Low | `reset {seed}` re-seeds correctly but reports `seed: undefined` |
| F8 | Low | One-shot `headless` has no `--seed` (pinned to 0) |
| F9 | Low | Asset/runtime errors leak raw messages vs the great determinism diagnostics |
| F10 | Low | `#aperture-canvas` screenshot includes page chrome (scrollbars) |
| F13 | Low | `reference` CLI subcommand is `search` but docs/API say `query` |
| F14 | Low | `ecs_list_systems` omits the numeric priority |
| F15 | Low | SessionSnapshot capture/restore works but is library-only (not in serve/MCP) |
| F18 | Low | No step-without-extract; serve `step {frames:N}` does N+1 full extractions (~99.8% of per-step cost at scale) |

Everything else — packing, scaffolding, type closure, the headless dev loop, determinism, replay, input, entities, resources, hierarchy, audio, strict assets, headless↔headed sim parity — **works** (details below).

---

## 3. The packing → install → scaffold flow (works)

| Step | Result |
|------|--------|
| `pnpm run build` (tsc -b) | clean |
| `pnpm --filter <pkg> pack` ×12 | clean; tarballs in `packs/` |
| `workspace:^` rewriting | ✅ rewritten to `^0.2.0` inside tarballs — so a consumer install needs `pnpm.overrides` mapping each `@aperture-engine/*` → its tarball |
| Install packed CLI (toolbox) | ✅ |
| `aperture create app --template game` (from packed CLI) | ✅ generated config split, 3 systems, GLB asset, AI adapter files |
| Install app from tarballs | ✅ `node_modules/.bin/aperture` runs |
| `tsc --noEmit` of app vs **packed** `.d.ts` | ✅ exit 0 under `strict` + `NodeNext` + `exactOptionalPropertyTypes` |
| `vite build` via **packed** vite-plugin | ✅ 603 modules, emits worker-entry + main + audio chunks, copies the GLB |
| Repo gates `check:pack-cli`, `check:headless-boundaries`, `check:render-bundles` | ✅ all pass |

**Takeaway:** the publish/consume story is sound. The packed type-declaration closure and the vite-plugin worker split both work from tarballs. The one thing a real consumer must know is the `workspace:^ → ^0.2.0` rewrite means unpublished local installs need overrides (the repo's own `check-pack-cli.mjs` does exactly this).

---

## 4. Developing with headless mode (the good part)

### 4.1 The inner loop is fast and introspectable
- Warm `serve` session: **~0.6 ms/step** for the game app (7 entities) after a one-time ~1.4–2.4 s boot. One-shot `aperture headless` is ~1.4 s including boot; +600 frames adds only ~0.38 s.
- Full state introspection from Node: `get-status` (entities w/ keys, tags, component ids; signals; resources; input; diagnostics), `ecs_query`/`ecs_get_entity` (transforms), `ecs_snapshot`/`ecs_diff`, `extract` counts (`views/meshDraws/lights/bounds`), and render `bundle` with a stable digest.

### 4.2 I verified real gameplay headlessly
- **Deterministic patrol** (`this.time`): the hazard's X matched the analytical `1 + 2.5·sin(elapsed·1.6)` curve to **6 decimal places**, confirming `step` uses *time-at-start-of-step* = `(frame−1)·delta`.
- **Movement + win condition**: driving `move.x=1` for 200 steps → `playerX=4.2`, `score=1` (gem collected), `goalReached=true`. The closure then included `finish.flag` once the follow-camera caught up.
- **Jump arc** (`button` action via `inject`): player Y traced a clean parabola (0.55 → 1.50), velocity decaying by exactly `gravity·dt² = 0.005`/frame.
- **Seeded RNG spawning** (`this.random`): coin layouts were reproducible per seed and seed-sensitive.

### 4.3 meshDraws reflect *real* render extraction, not entity counts
`extract` reported `meshDraws=2` for a 7-entity scene. This is **correct**: the renderer's frustum culling plus the `camera-follow` system push off-screen meshes (e.g. `finish.flag` at x=3.8) out of the draw list. Driving the player right brought it back. The headless extraction reproduces the actual render-graph culling — a real fidelity win, and the closure roots are an authoritative "what would actually draw" list.

### 4.4 Determinism enforcement — the headless killer feature
- `--determinism warn` → warnings, exit 0; `--determinism error` → errors + `aperture.headless.determinismViolation`, exit 1.
- Diagnostics name the **system, API, phase, and suggested fix**. A deliberately-bad system using `Math.random()`/`Date.now()` was caught precisely; my real systems (using `this.time`/`this.random`) pass.
- **Replay is bit-identical**: seed 1 produced byte-for-byte identical bundle digests across runs (`8a19ecd1`, 32394 bytes); seed 2 differed (`b750fc82`). `reset {seed}` re-seeds deterministically and matches boot-`--seed` layouts.

This is something you fundamentally cannot get cheaply in a browser RAF loop, and it's the best argument for the whole headless approach. **Caveat (F11):** this hard gate only fires in the *one-shot* command — the warm `serve` session never aborts on `--determinism error` and only exposes violations via `get-status.diagnostics`.

### 4.5 Input, camera, and template coverage (all work)
- **Driving an `axis2d` action:** `input_gamepad_set {axes:[x,…]}` drives the `move` action through its `gamepadStick("left")` binding and the value *persists* across steps (verified: left-stick X=1 → +3.0 units / 60 frames). This is the clean way to hold an analog input; `input_action_set {x,y}` queues a one-shot virtual event instead.
- **Pointer:** `input_pointer_move/set` are browser-only (`toolUnavailable` in headless); use `inject {pointer}`. Pointer position is **normalized [0,1]** and clamped (`[0.5,0.25]`→as-is, `[-3,9]`→`[0,1]`).
- **Camera:** `camera_set_transform` mutates the authoritative ECS camera; `camera_save`/`camera_restore` round-trip exactly ([0,3,7]→[0,99,0.1]→[0,3,7]).
- **All three scaffold templates** (`minimal`, `game`, `glb-viewer`) scaffold from the packed CLI and run headlessly; `glb-viewer` loaded its GLB in strict mode (provenance real:4).

### 4.6 A headless test harness caught a real regression (the loop's whole point)
I wrote a ~60-line client over the `serve` NDJSON protocol (`app/test/headless-harness.mjs`) and a gameplay-invariant suite (`app/test/game.test.mjs`, **17 assertions, all green**). It immediately earned its keep: when I added the patrol hazard, the suite showed the level had become **unwinnable** — the hazard's collision was Y-agnostic, so jumping couldn't avoid it and `goalReached` never flipped under any input. I made the hazard only catch a *grounded* player; the suite's `winnableByJumping` test then passed (`hits=0`, `goalReached=true`) while `hazardBlocksGrounded` still documents the obstacle. That's the full write→detect-regression→fix→confirm loop, run in **pure Node in seconds**, no browser — exactly what headless mode is for. The same harness drives a boids suite too (`app/test/boids.test.mjs`: containment, speed-clamp, determinism). I also added a **double-jump mechanic test-first** (`app/test/double-jump.test.mjs`): wrote the invariant, watched it go RED against the single-jump code, implemented `#jumpsRemaining`, watched it go GREEN — and the loop immediately flagged that double-jump changed the `winnableByJumping` trajectory (a now-too-strict `hits===0`), which I relaxed. That's real TDD in pure Node. I then added a **dash** ability the same way — including defining a *new* `dash` input action in `aperture.shared-config.ts` and driving it through `inject` — RED→implement→GREEN, no regressions. The same harness also drives the Game of Life suite (block/blinker invariants + determinism). Across all four apps it runs **38 green assertions + 3 capability probes** via one `node test/all.mjs` (9/9 checks) — including a complete platformer level whose pit-crossing I debugged purely from headless state traces. This is the single most convincing thing I can say about the headless flow: it is good enough to be your gameplay test/TDD harness.

### 4.7 Engine features that work headlessly (verified)
A consolidated list of what I confirmed runs in pure Node (no browser), since the boundary is broader than the docs spell out:

- **Core:** ECS authoring, fixed-step stepping, render extraction (with real frustum culling), render bundles + stable digests, multi-camera (2 cameras → 2 views).
- **Determinism:** `context.random`/`context.time`, bit-identical replay, the determinism gate (all 4 nondeterministic globals across init/update), SessionSnapshot capture/restore (library API).
- **Input:** button/axis (via gamepad)/pointer injection; **pointer picking** (`interaction.onClick/onDown/hoveredEntity` fire from injected pointer raycasts).
- **Queries:** `ecs_query`/`get_entity`/`snapshot`/`diff`/`hierarchy`/`component_schema`; **spatial queries** (`raycastFirst`/`overlapSphere`/`closestPoint` — exact, BVH-backed); hierarchy parenting + recursive despawn.
- **Resources & signals:** `defineResource` + `resource_get`/`set`; signals.
- **Assets (strict, real bytes in Node):** glTF/GLB (incl. **animation** playback), RGBE **HDR** environment maps, audio clips.
- **ECS render features (authored as entities):** fog, procedural sky, particles, audio emitters (`audio.loop`/`playOneShot`), and **custom WGSL materials** (inline-shader source captured as an asset; GPU compilation deferred to render).
- **Physics:** rapier **simulates** in Node via the low-level API (a body falls under gravity) — just not wired to the headless CLI (F12).

The genuinely browser-only parts are: real WebGPU **pixels** (the headed render/`frame_capture`/`dev` paths), DOM/native input, audio **device** playback, and host-dispatched **commands** (F16).

---

## 5. Headless vs headed: the comparison

| Dimension | Headless (`aperture headless [serve]`, MCP) | Headed (`aperture render`, `frame_capture`, `aperture dev`) |
|---|---|---|
| Clock | **Explicit fixed-step** (paused; advances only on `step`); `time=(frame−1)·dt` | **Free-running RAF/wall-clock** — the live `dev` app reached frame **7725 / 32.4 s** before I paused it |
| Determinism | Enforced + replayable (digests) | Not enforced; wall-clock + real input |
| Speed | ~0.6 ms/step (7 ent), no browser | Browser boot ~3.6 s; render path needed |
| Pixels | None (structural snapshot only) | Real WebGPU pixels **only with a display** |
| Setup in this env | Just Node | Needs xvfb/GPU; `dev` auto-provisions xvfb, `render`/`frame_capture` do not |
| Reliability here | **Rock-solid** | Headless-browser capture → blank-white; xvfb/dev → correct |

### 5.1 The structural↔pixel bridge is real and accurate
The headless bundle's closure for a mid-field frame listed exactly six meshes — `level.ground`, `player`, `goal:mesh:0:primitive:0` (the GLB gem), `hazard.patrol`, `finish.flag`, `coin.2`. Rendering that same bundle under **xvfb** produced an image with exactly those six objects (green ground, blue player, teal gem, brown hazard, red flag, gold coin). **Headless structural truth and headed pixels agree.** (`app/artifacts/midfield.xvfb.png`, `app/artifacts/frame_capture.xvfb.png`.)

### 5.2 Asset mode is consistent across the headless↔headed boundary
Rendering the same game state from a **strict** bundle vs a **placeholder** bundle (both under xvfb) differs exactly as the headless closures predict: the strict closure has the GLB `goal:mesh:0:primitive:0` and the rendered image shows the teal gem; the placeholder closure drops it (5 vs 6 meshes) and the rendered image has no gem — everything else identical. So "placeholder mode" omits unsupported geometry consistently in both the structural snapshot and the pixels. (`app/artifacts/midfield.xvfb.png` vs `…/midfield.placeholder.xvfb.png`.)

### 5.3 Headless and headed run the *same* simulation
I checked the core "headless mirrors the sim" promise directly. The hazard's position is a pure function of sim time: `x = 1 + 2.5·sin(elapsed·1.6)`. Headless matched that analytical curve to **6 decimals** (against `elapsed=(frame−1)·dt`). I then started the live `aperture dev` browser, paused it, stepped it, and read the hazard entity — its X matched `1 + 2.5·sin(elapsed·1.6)` for the *browser's own* elapsed to **1.26e-8** (float-exact). Same system module, same result. The only difference is the **time source**: headless drives a clean fixed-step clock; the browser accumulates wall-clock/RAF time (so its `elapsed` values differ, and bit-identical cross-runtime replay requires stepping the browser with a fixed clock + identical seed/input — which `ecs_step` does). For routine logic/3D-math/replay work, headless genuinely *is* the simulation.

### 5.4 One-shot and serve are the same simulator
For an identical 12-frame jump schedule, `aperture headless --inject` and `serve` `inject` produced **byte-identical** `snapshot.value`, `closure`, and `assetProvenance`. The only difference was the full-bundle digest — because `engine.createdBy` ("aperture headless" vs "aperture serve") is folded into the digest (see Finding F6).

---

## 6. Findings (severity-ranked)

### High

**F1 — `aperture render` produces an all-white frame in the headless-browser path, and reports success.**
With `APERTURE_RENDER_HEADLESS=1` (the default the CI render smoke uses), the rendered PNG is **100% `255,255,255`** for *every* bundle (mine and the repo's own `headless-procedural` fixture). The same bundles render correctly under `xvfb-run` (165–278 distinct colors, materials visible). Root cause: the CLI captures via Playwright `#aperture-canvas` element screenshot (`render/driver.ts:176`) with no GPU-readback fallback; the project's own `docs/BROWSER_E2E_RENDERING.md` (lines 112–130) already documents that headless screenshot captures come back blank and that the e2e suite trusts **GPU readback** instead. The CLI render path never got that treatment.
*Repro:* `APERTURE_RENDER_HEADLESS=1 aperture render <bundle> --out f.png` → inspect: all white. See `app/artifacts/F1-side-by-side.png` (same bundle: blank-white headless browser vs correct scene under xvfb).

**F2 — `isPngBlank` only detects all-black, so blank-white renders pass as "ok" (false positive).**
`tools/png-readback.ts`: `blackCoverage >= 0.995 && maxLuma <= 4`. An all-white frame has `maxLuma=255`, so it is never flagged. Combined with F1, this means **`check:pack-cli:render` passes on a completely blank render** — I confirmed the gate's exact 64×64 path is 100% white yet exits 0. CI "pixel confidence" is illusory in any GPU-less/headless-browser environment (CI, dev containers, this sandbox).
*Fix:* detect low-variance/near-uniform frames in general (white, single-color, NaN→white), not just black; and/or adopt GPU readback in the render CLI as the e2e suite does. I included a drop-in detector (`headless-battletest/detect-blank-render.mjs`) that does the near-uniform check — it flags the white capture (`distinctColors:1, dominantFraction:1` → exit 1) and passes a real render (`332` colors → exit 0); it's exactly the guard `isPngBlank` should be.

**F12 — A `physics` block in a headless config is silently ignored; `fixedUpdate` never fires headlessly.**
`fixedUpdate()` never ran through `aperture headless` (one-shot or serve): `fixedTicks=0`, `fixedStepClock=null`, while `update()` ran every step. Adding `physics: { backend: "rapier", gravity }` to the headless config changed nothing — no fixed-step, no diagnostic, exit 0. Root cause: `createApertureApp` (`advanced.ts:142`) derives physics/fixed-step from `options.physics`, never `options.config.physics`. The **worker/browser** loop translates `config.physics → options.physics` (`worker/loop.ts:63,82`); the **headless runner** (`headless.ts`) calls `createApertureApp({ ...options, config })` *without* that translation, so `config.physics` is dropped. Consequences: (a) physics-based games and any `fixedUpdate` system **cannot be validated headlessly**; (b) a **shared config** with a physics block (the scaffold pattern!) silently diverges — physics on in the browser, off in headless — with no warning, which directly undermines the "headless mirrors the sim" promise. Corroboration: only the physics-free `city-builder` showcase ships a headless config; `fps`/`platformer`/`racing` don't. **Proof it's purely a wiring gap (not a Node limitation):** calling the low-level `createApertureApp` with explicit `physics: { backend: "rapier", gravity }` + `fixedStep` in pure Node ran `fixedUpdate` 10/10 steps, populated `fixedStepClock`, and **initialized rapier 0.19.3 in Node** (`edge/physics-capability-probe.mjs`). Rapier doesn't just init — it **simulates**: a dynamic body dropped from Y=10 fell to Y=5.24 over 60 fixed steps (≈ ½·g·t², `bodyCount:1`, `edge/physics-sim-probe.mjs`). So full physics gameplay *could* be headless-validated; only the headless CLI's `config.physics` translation is missing. *Fix:* have the headless runner mirror `resolveConfigPhysicsOption(config.physics)` like the worker loop, or at minimum emit a diagnostic when `config.physics` is present but dropped.

### Medium

**F3 — `ecs_get_entity` silently ignores `{key}` and falls back to the last query's first result.**
`entityRefFromPayload` accepts an explicit `{index,generation}` or reuses `lastFind[0]`/`lastGet`. Passing `{key:"player"}` "works" only if you happened to `ecs_query` that key first; otherwise it errors (no prior find) or, worse, returns a **different** entity (whatever was queried last). This is a real footgun for agents/scripts. *Fix:* either resolve `{key}` directly in `ecs_get_entity`, or reject unknown payload keys instead of silently falling back.

**F4 — `ecs_query`/`input inject` have silent-no-op parameter mismatches.**
`ecs_query` filters on `tags: [...]` (an array); the singular `tag: "coin"` is silently ignored and returns *everything* (up to the limit). Similarly, `inject`/`--inject` only support `pointer` + `button` actions — an `axis2d` action like `move` cannot be injected through `inject` at all (you must use the `input_action_set` tool with `{x,y}`). Both are "silent wrong-result" rather than "loud error" ergonomics. *Fix:* reject unknown filter keys; document/extend `inject` to cover axis actions, or error when handed one.

**F5 — MCP `frame_capture` launches a *headed* browser with no auto-xvfb, so it dies without a display.**
`frame_capture` → `browserType.launch: ... launched a headed browser without having a XServer running`. By contrast `aperture dev` auto-provisions its own xvfb (`:99 1280x800x24`) and works. So three headed entry points behave three different ways in a GPU-less env: `dev` (auto-xvfb, works), `render` (headless browser, white), `frame_capture` (headed, crashes). Under `xvfb-run`, `frame_capture` produces correct pixels (278 colors). *Fix:* make `frame_capture`/`render` share `dev`'s display-provisioning and GPU-mode logic.

**F11 — The determinism hard-gate is one-shot-only; warm serve never enforces it.**
`aperture headless --determinism error` aborts with exit 1 on a violation (`assertDeterminismPolicy`). The warm `serve` session has no equivalent — with `--determinism error` it kept stepping happily on a system calling `Math.random()`/`Date.now()`. Worse, serve surfaces the diagnostics **only** in `get-status.diagnostics` — not in `step` results and not on stderr — so an agent watching `step` output sees nothing. Since `serve`/MCP is the *recommended* interactive loop (per the scaffolded `CLAUDE.md`), the determinism feature is effectively off in the loop people will actually use. *Fix:* honor the determinism mode in serve (either fail the offending `step`, or at least echo diagnostics in every `step` result).

### Low / polish

**F6 — The render-bundle digest is not a pure-simulation digest.** `engine.createdBy` (and other provenance metadata) is inside the digested object (`headless/bundle.ts:165–201`), so identical simulations produced by different commands (`headless` vs `serve`) get different digests. Anyone using the bundle digest to assert "same sim across tools" will get false mismatches. Consider a separate `snapshotDigest` over `snapshot.value` only.

**F7 — `reset {seed}` works but doesn't report the new seed.** RNG is correctly re-seeded (verified via coin layouts), but the `reset`/`get-status` response shows `seed: undefined`. Cosmetic, but misleading when scripting.

**F8 — One-shot `aperture headless` has no `--seed`** (only `serve` does). The one-shot is effectively pinned to seed 0 (confirmed: its 85-frame snapshot equals `serve --seed 0`). Any RNG-dependent one-shot validation can't vary the seed. *Fix:* add `--seed` to the one-shot command for parity.

**F17 — Headless loads systems with no type-checking, so option-shape mistakes are silently ignored.**
The headless config-loader strips types natively (fast, no `tsc`), which means authoring mistakes that `tsc` would reject pass silently and produce wrong behavior with no error. Concrete bite I hit: `spawn.mesh`'s parent goes in `transform: { parent }` (it's a `SystemTransformInput` field), but I wrote a top-level `parent` — it was silently dropped, so children spawned unparented, `ecs_get_hierarchy` showed them as roots, and `despawnRecursive` didn't cascade. With the option in the right place, all three work perfectly (parent → 3 children; recursive despawn removes the whole subtree). I hit it again authoring render effects — `spawn.fog({ kind })` (should be `mode`) and `spawn.particles({ effect: { kind: "burst" } })` (should be `"particle-effect"`) both ran headlessly and created entities, while `tsc` flagged both (`TS2353`/`TS2322`). The scaffold's `pnpm typecheck` catches all of these, but `aperture headless` itself never will. *Fix/guidance:* pair headless runs with `tsc --noEmit` in CI (the scaffold already provides the script), and/or have the loader validate known option shapes and warn on unknown keys.

**F9 — Error surfaces are uneven (two rough spots in an otherwise good set).** Most failures are excellent: missing config → `configNotFound`; non-erasable TS / config-eval throw → actionable `configLoadFailed`; a **corrupt** GLB → a precise `GLB declared length 2160468 does not match source length 200`; HTTP asset blocked; bad render bundle → structured `invalidBundle`; and the loader even **warns on an empty system glob** (`aperture.systemGlob.empty`). The two rough spots: a **missing** strict asset leaks a raw `ENOENT … realpath`, and an **uncaught system exception** (in `init` or `update`) surfaces a generic `aperture.cli.failed: <message>` with no system/phase attribution. The determinism diagnostics show how good these *can* be; those two should match.

**F10 — `#aperture-canvas` screenshots include page chrome.** The xvfb render captured page scrollbars around the canvas, implying the harness page overflows the viewport. Cosmetic, but it pollutes any future screenshot-diff baseline.

**F13 — `reference` subcommand is `search`, but the package README + programmatic API call it `query`** (`searchApertureReferences`, "Warm and query"). `aperture reference query …` → `unknownSubcommand`. Align the docs or add a `query` alias.

**F14 — `ecs_list_systems` lists systems in execution order but omits the numeric `priority`.** Minor, but priority is the thing you actually want when debugging ordering.

**F18 — No step-without-extract; the warm `serve` loop pays full render extraction every frame (N+1 extractions per `step`).**
The headless runner's `step` is `stepAndExtract`, and `serve`'s `step {frames:N}` extracts once up front *and* once per frame. Since extraction is ~99.8% of per-step cost at scale (§7), the warm interactive loop — the recommended one — is needlessly slow for large scenes, and there's no escape hatch. *Fix:* a runner-level `step()` that doesn't extract, plus a serve flag to extract only on demand.

**F15 — SessionSnapshot capture/restore works and is deterministic, but is library-only — not exposed to serve/MCP.** `createApertureSessionSnapshot(runner)` + `runner.restoreSessionSnapshot()` round-trip exactly (restored to frame-30 state; continuation bit-identical, RNG+time captured — `edge/session-snapshot-probe.mjs`). But the warm `serve`/MCP protocol only offers `reset` (full rebuild), so an agent-driven loop can't checkpoint/branch a session. This is the single biggest *missing* lever for the recommended interactive loop — exposing `snapshot`/`restore` serve commands would enable "explore a branch, roll back, try another" without re-stepping from frame 0.

---

## 7. Performance notes
- Warm-serve per-step cost scales ~**linearly at ~28 µs/entity/step** (sim + full render extraction). Measured across a swarm scene:

  | entities | per-step | real-time headroom |
  |---|---|---|
  | 10 | 0.40 ms | ~2500 fps-equiv |
  | 100 | 2.5 ms | ~400 fps |
  | 500 | 12.5 ms | ~80 fps |
  | 1000 | 27.5 ms | ~36 fps |
  | 2000 | 57.5 ms | ~17 fps |

  So the warm interactive loop sustains real-time up to ~1000 entities; boot also grows with entity count (1.48 s → 2.32 s for 10 → 2000).

  **The cost is extraction, not simulation.** A one-shot run (which extracts only the final frame) steps the same 2000-entity scene at **~0.1 ms/step** — so render extraction is **~99.8 %** of the warm-serve per-step cost at scale; the ECS sim itself is nearly free. This is why one-shot `headless --frames N` is so much faster, and why a **step-without-extract option for the warm `serve` loop** (extract on demand) would be the single highest-leverage perf win for large-scene headless validation. Concretely: the runner's `step` *is* `stepAndExtract` (`headless.ts`), and the serve `step {frames:N}` command extracts once up front *and* once per frame — **N+1 extractions** — even though only the final one feeds the returned counts. A runner-level step-without-extract + a serve flag to skip per-frame extraction would remove ~99.8% of the per-step cost at scale.
- For the small game app, one-shot runs **5000 frames in 2.98 s** (~0.3 ms/frame incl. boot) — the extract-once path scales to long replays effortlessly.
- A 2000-entity scene authored with per-entity `mesh.box(...)`/`material.standard(...)` produced **4000 distinct source assets** and a 9.5 MB bundle — there's no automatic mesh/material dedup, so authoring guidance should emphasize sharing asset handles.

---

## 8. Recommendations (prioritized)

1. **Fix the blank-render false-positive (F1+F2).** This is the one that erodes trust: make `render` use GPU readback (the e2e path already proves it works) or, at minimum, make `isPngBlank` reject near-uniform frames and have the render smoke assert non-blank pixels. Today a green CI render check means nothing in GPU-less envs.
2. **Wire `config.physics` into the headless runner, or warn loudly (F12).** Right now a physics/`fixedUpdate` game silently behaves differently headless vs headed. Mirror `resolveConfigPhysicsOption(config.physics)` in `headless.ts`; if headless physics is intentionally out of scope, emit a diagnostic when a dropped `physics` block is detected.
3. **Unify headed display/GPU provisioning (F5).** `render` and `frame_capture` should reuse `dev`'s auto-xvfb + `--gpu auto` so "it renders" doesn't depend on which entry point you picked.
4. **Make tool inputs strict (F3, F4).** Resolve `{key}` in `ecs_get_entity`; reject unknown query filter keys and un-injectable action kinds. Silent wrong-results are the worst failure mode for an agent-driven loop.
5. **Enforce determinism in serve/MCP (F11),** the loop people actually use — fail the step or echo diagnostics per-step, not only in `get-status`.
6. **Add `--seed` to one-shot `headless` (F8)** and surface the active seed in `reset`/status (F7).
7. **Level up asset/runtime error diagnostics (F9)** to match the (excellent) determinism diagnostics.
8. **Guard against the no-typecheck footgun (F17):** document that `aperture headless` does not type-check (pair it with the scaffold's `pnpm typecheck`), and/or have the loader warn on unknown spawn/option keys.
9. **Expose session snapshot/restore (F15) and command dispatch (F16) in serve/MCP** so the interactive loop can checkpoint/branch and drive command-channel gameplay.
10. **Smaller polish:** sim-only `snapshotDigest` (F6), step-without-extract for the warm loop (F18 — biggest perf lever at scale), `reference query` alias (F13), priority in `ecs_list_systems` (F14).

None of these block using headless mode for real development today — I did exactly that. They're about making the *headed pixel gate* honest, the *headless/headed parity* complete (F12), and the *tool ergonomics* strict.

---

## 9. Appendix — reproduction

```sh
# from repo root
pnpm run build
# pack (see headless-battletest/ for the overrides.json + toolbox/app layout)
pnpm --filter @aperture-engine/cli pack --pack-destination headless-battletest/packs   # ...etc for all 12

cd headless-battletest/app
# headless one-shot (strict assets) + bundle
node_modules/.bin/aperture headless aperture.headless.config.ts --out artifacts/f.bundle.json \
  --frames 12 --asset-mode strict --public-dir public --determinism error

# warm serve loop (NDJSON over stdin) — see ../serve-driver.mjs
echo '[{"cmd":"step","params":{"frames":85}},{"cmd":"tool","params":{"name":"ecs_query","arguments":{"tags":["coin"]}}},{"cmd":"shutdown"}]' \
  | node ../serve-driver.mjs . aperture.headless.config.ts --seed 1

# headed render — blank-white here (F1); correct under xvfb
APERTURE_RENDER_HEADLESS=1 node_modules/.bin/aperture render artifacts/f.bundle.json --out artifacts/f.png   # white
xvfb-run -a node_modules/.bin/aperture render artifacts/f.bundle.json --out artifacts/f.xvfb.png             # correct
```

Key artifacts committed: `headless-battletest/app/artifacts/midfield.xvfb.png` (correct headed render), `…/jump.serve.png` (blank-white headless-browser render), `…/*.bundle.json`, and `headless-battletest/FINDINGS.md` (raw running log).
