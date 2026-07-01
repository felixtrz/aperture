# Aperture Headless Battle-Test — Running Findings Journal

Started: 2026-07-01 15:04 UTC. Model: claude-opus-4-8.

This is the raw running journal. The polished report is in `REPORT.md`.

## Environment
- Repo: felixtrz/aperture @ branch `claude/headless-mode-testing-g8cruw`
- All 12 code packages packed to `.tgz` and installed into `app/` via `pnpm.overrides` (file:// tarballs) — a faithful "installed from npm" simulation.
- Isolated pnpm root (`pnpm-workspace.yaml: packages: []`) so the monorepo workspace does not interfere.
- Node v22.22.2, pnpm 10.33.0 (isolated), vite 8.1.2.

## Baseline facts
- Scaffold: `aperture create app --template game` → clean tree, AI adapter files generated.
- `pnpm run typecheck` (tsc --noEmit): PASS
- `pnpm run build` (vite browser bundle): PASS (822 modules; worker + main chunks emitted)

## Findings log (chronological)

### OBSERVATION O1 — headless extraction performs frustum culling (correct, worth knowing)
- Baseline `aperture headless` on the `game` template (60 frames, no input) reports `meshDraws: 2` / `bounds: 2` even though 3 box-mesh entities exist (ground, player, finish.flag).
- Root cause: the camera-follow system keeps the camera at the player's x (−3.5). The finish flag at x=3.8 falls outside the view frustum, so extraction drops it. Verified visually: `aperture render baseline.bundle.json` shows only the green ground + blue player cube; the flag and (placeholder) goal gem are absent.
- Implication for agents: headless `meshDraws`/`bounds` are **view-dependent**. An agent "counting objects" via a render bundle sees culled counts, not authored counts. Use `ecs_*` / entity summaries for authored counts, snapshot draws for what's visible. This is correct behavior but a real footgun for automated inspection — worth a doc note.

### FINDING F1 (MEDIUM) — `render.clearColor` config field is completely unwired (no-op) in both headed and headless
- The `game` scaffold ships `render: { clearColor: [0.08, 0.12, 0.16, 1], ... }` in `aperture.shared-config.ts`, implying a dark slate background.
- Rendered background is pure **black** ([0,0,0,1]) instead. The extracted view's `clearColor` is `[0,0,0,1]` in the bundle.
- Traced through source: `ApertureRenderDefaults.clearColor` is defined in `packages/app/src/config/index.ts:387` but is **never read anywhere** in the repo. `installRenderDefaults` (`packages/app/src/advanced.ts:488`) spawns the default camera without a clearColor, and `resolveGeneratedRenderSettings` (browser path) ignores it too. Only the `Camera` ECS component's `clearColor` (default `[0,0,0,1]`) reaches the renderer.
- Affects BOTH paths, but a headless-render user hits it first (black PNG that contradicts the config).
- Working path: set it per-camera — `spawn.camera({ clearColor: [...] })` (`CameraInput.clearColor` exists and is honored).
- Recommendation: either wire `render.clearColor` into `installRenderDefaults` + the browser presentation clear, or remove it from the type and the `game` template so the scaffold does not ship a dead knob.

### FINDING F2 (MEDIUM) — generated action types don't resolve a factory/shared config (the scaffold's own pattern)
- `.aperture/generated/aperture-env.d.ts` (written by the vite plugin) is what strongly types `this.actions.*`. It is produced by `writeApertureGeneratedActionTypes`, which parses `aperture.config.ts` **as an AST** and reads `input.actions` from the literal.
- The `game` scaffold (and most real apps) define `input` inside `aperture.shared-config.ts` via a `createApertureAppConfig()` factory and call it from `aperture.config.ts`. The generator cannot see through the function call, so it emits an **empty** `ApertureGeneratedActionMap {}` — verified: the file listed zero actions for a config that declared move/jump/reset.
- Consequence: `this.actions.move` falls back to the loose `Record<string, InputAction>` index type; combined with `noUncheckedIndexedAccess` you must null-check + narrow every action (`move?.kind === "axis2d"`). The scaffold's own generated systems already do this, masking the gap.
- Recommendation: evaluate the config through the module loader (as `aperture headless` already does) instead of shallow AST parsing, or document that actions must be inline in `aperture.config.ts` to get generated types.

### FINDING F3 (LOW) — `this.signals.*` is never strongly typed; headless flow never regenerates env types
- `SignalStore = Record<string, Signal<unknown>>`. Nothing generates per-signal types (the generator only handles actions), so `this.signals.score.value` is `unknown` and — under `noUncheckedIndexedAccess` — `this.signals.score` is `Signal<unknown> | undefined`. Every signal read needs `Number(x?.value ?? 0)` and every write needs an `!== undefined` guard.
- Also: `.aperture/generated` is only refreshed by a **vite** (browser) build/dev. A pure headless workflow (`aperture headless`/`serve` + `tsc`) never refreshes it — there is no `aperture generate-types` command. After editing signals/actions you must run a browser-oriented `vite build` to refresh types, which cuts against the "simulation-first, headless-first" story in the scaffold's own CLAUDE.md.
- Recommendation: generate a typed signal map too, and add a headless-friendly `aperture types`/`aperture codegen` command (or emit types as a side effect of `aperture headless`).

### WIN W1 — determinism guarantees hold for a real app
- Starfall (custom components + `context.random` cadence/traits + `context.time` sway + runtime spawn/despawn) replays **byte-identically** across two `--seed 1` runs (full-file compare true; digest `1afb1fe2`). `--seed 2` diverges (`20531f53`). `--determinism error` exits 0. Custom elics components (`Star`, `Basket`) round-trip through the headless runner with no registration boilerplate (auto-registered via query/addComponent).

### WIN W2 — `headless serve` boot-once inner loop drives a full autopilot
- `serve-play.mjs` opens two warm serve sessions (seed 1) and issues 120 ticks each of `get-status → input_action_set(move,x) → step(4)`.
- PASSIVE (no input): score 5, missed 5, basketX 0. AUTOPLAY (steer basket toward lowest star): **score 8, missed 3, basketX 2.81**. Input demonstrably changes the sim; the read→decide→act→step loop an agent would use works end-to-end over stdin NDJSON.
- `input_action_set` correctly drives the `axis2d` move action in serve mode (the path the one-shot `--inject` cannot reach — see F4).

### FINDING F5 (HIGH) — `reset` / second runner boot crashes for apps with module-scope custom components
- `aperture headless serve` → `{"cmd":"reset"}` returns `{ok:false, error:"Cannot read properties of null (reading 'id')"}`. The MCP `app_reset` tool and the scaffold's recommended loop ("Use `app_reset` for rebuild/reset") drive the same `bootRunner` path.
- Isolated with an in-process repro (`app/repro-reset.mjs`): calling `createApertureHeadlessRunner` **twice** in one process with the SAME module-singleton `defineComponent` crashes on the second boot's first entity-summary read. With no custom component, the double boot is clean.
- Stack (packed app 0.2.0):
  ```
  entityHasComponentId (dist/entities/lookup/summary.js:224:40)  // reads `.id` of a null component
  entitySummary        (dist/entities/lookup/summary.js:30:25)
  findApertureEntities (dist/entities/lookup/query.js:14:10)
  createApertureEntityLookupSnapshot (dist/entities/lookup/snapshot.js:7:20)
  ```
- Mechanism: app components are re-registered uniformly every boot by `registerApertureAppComponents` (stable typeIds across worlds), but a user `defineComponent` is a module singleton registered *lazily* (via query/addComponent). Its `typeId`/`bitmask`, mutated by world #1, are stale on world #2's fresh component manager, so a typeId in an entity's bitmask resolves to `null` in `getComponentByTypeId`, and `entityHasComponentId` dereferences `null.id`.
- Impact: `reset`/`app_reset` — a core inner-loop command — is unusable for the common case (any app with a custom component defined at module scope). One-shot `aperture headless` is unaffected (single boot per process).
- CONFIRMED on the MCP surface: `app_reset` (the tool the scaffold's CLAUDE.md tells agents to use for "rebuild/reset") returns JSON-RPC `-32000: Cannot read properties of null (reading 'id')`, and a follow-up `app_status` comes back empty — the reset both fails and leaves the headless session in a broken state.
- **ROOT CAUSE (verified):** elics `Entity.addComponent` (`elics@3.4.2/lib/entity.js:20`) re-registers a component only when `component.bitmask === null`. A module-singleton `defineComponent` keeps a non-null `bitmask`/`typeId` from world #1, so on world #2 (`reset`) `addComponent` **skips** re-registration and `orInPlace`s the STALE world-1 typeId bit into the new entity's bitmask. That typeId resolves to `null` on world #2's component manager (`getComponentByTypeId`), and `entityHasComponentId` → `getComponents().some(c => c.id === …)` dereferences `null.id`. App components avoid this only because `registerApertureAppComponents` explicitly re-registers them (fresh bitmask/typeId) in a stable order before use.
- **VERIFIED FIX (one line):** change the guard to consult the *current* world — `if (!this.componentManager.hasComponent(component))`. I patched the app's `elics@3.4.2` copy and re-ran `repro-reset.mjs`: **"boot2 (simulated reset) ok … RESULT: no crash"**; reverting restores the crash.
- Fix path for Aperture: upstream the elics guard fix and bump, OR work around in the `reset`/`bootRunner` path by resetting each user component's `typeId=-1`/`bitmask=null` (or re-registering user components through the stable app path) when constructing the new world. (An earlier candidate — patching only the `addComponent` guard on the *monorepo* elics copy — appeared not to help until I found the packed app resolves its own `app/node_modules/.pnpm/elics@3.4.2` copy; patching that confirmed the fix.)

### FINDING F6 (MEDIUM) — session snapshot restore silently drops custom components & resources
- `snapshot` (save) + `restore` on Starfall at frame 90 returns `{ok:true, result:{ok:false, restore:{ok:false, scene:{ok:false, diagnostics:[...]}}}}`.
- Diagnostics: `aperture.serialization.unregisteredComponent` — "No registered component for id 'starfall.basket'/'starfall.star'; component skipped" (once per affected entity), and `resources:{restored:0, missing:["starfall.director"]}`.
- So restored entities load their transforms but **lose all custom-component state** (`Star.fallSpeed`, `Basket.speed/halfWidth`) and the custom **resource** resets. Signals (6), RNG, and fixed-step clock DO restore. Docs claim SessionSnapshot v1 "captures the component registry ids" and supports opt-in system state — but user components/resources defined via `defineComponent`/`defineResource` are not resolvable at restore.
- Secondary ergonomics bug: the serve `restore` response is `ok:true` at the top level while the payload is `ok:false`. A caller that checks only the top-level flag treats a failed restore as success.
- Fix direction: register user components/resources into the restore-time registry before loading the scene (same fix family as F5); and propagate `result.ok:false` to the command envelope.
- ISOLATED: the same save/restore on the `hier` app (only standard app components, no custom `defineComponent`/`defineResource`) restores cleanly — `{ok:true, scene:{ok:true, entities:6, diagnostics:[]}}`. So the SessionSnapshot machinery is sound; the failure is specific to user-defined component/resource types.

### OBSERVATION O2 — `ecs_set_component_field` cannot mutate user components (by design)
- Mutation goes through a hardcoded allowlist (`componentFieldMutations`) covering app/physics components (LocalTransform, Camera, RigidBody, …). Custom `defineComponent` ids return `aperture.entityLookup.componentMutationUnsupported` with a clear `suggestedFix`.
- Reasonable safety choice, but a real limitation for the headless dev loop: an agent can *inspect* custom components (`ecs_find_entities`/`ecs_get_entity` show them) but cannot poke their fields from tooling — it must write/modify a system. Worth documenting as a known boundary.

### WIN W4 — determinism diagnostics work as documented
- A temporary system calling `Math.random()` is flagged by `--determinism warn` (`aperture.determinism.nondeterministicGlobal: NaughtySystem called Math.random during update; use context.random`, exit 0) and fails `--determinism error` (adds `aperture.headless.determinismViolation`, exit 1). Correct.

### WIN W5 — MCP stdio agent surface is complete and functional
- `aperture mcp stdio` speaks MCP `2025-06-18`, advertises **47 tools** (app lifecycle, ecs_*, camera_*, input_*, frame_capture, logs_read, render_bundle, session_snapshot_*, determinism_report, reference_*).
- End-to-end headless drive works: `app_start(headless)` → `app_status(running:true)` → `ecs_step(90)` (meshDraws 4) → `ecs_find_entities(star)` (2) → `frame_capture(320x240)` (renders via bundle) → `app_stop`. Only `app_reset` is broken (F5).

### FINDING F7 (MEDIUM) — `frame_capture` return shape & dimension handling differ between headed and headless
- Same tool, same args `{width:480, height:320}`, opposite results:
  - **headed** → MCP `content:["image"]` (inline 7962-byte PNG), live canvas **960×640** (requested dims **ignored**), no text/metadata/pngPath.
  - **headless** → MCP `content:["text"]` with JSON `{source:"render-bundle", actualDimensions:{480×320}, pngPath:...}`, **no inline image**, dims **honored**.
- `frame_capture` is the public, backend-agnostic "get a picture" tool meant to unify both slots (per docs and the scaffold CLAUDE.md), yet an agent must branch on target to read a result and cannot rely on requested dimensions. This undercuts the "same intent-level tools for both slots" promise.
- Recommendation: normalize the envelope — always return both an inline image and a text metadata block with `actualDimensions` — and either honor width/height for headed (offscreen render) or document that headed ignores them.

### FINDING F8 (MEDIUM) — `ecs_get_component_schema` can't see a custom component that IS on live entities (component-identity inconsistency)
- With 2 live `star.*` entities, `ecs_get_component_schema` (no filter) lists app components + `starfall.basket` but **omits `starfall.star`**; filtering for it returns `aperture.devtools.componentSchemaNotFound`. `starfall.basket` (defined identically) is always found.
- Yet the same star entities report `starfall.star` in their `componentIds` (entity-summary path) and are matched by `ecs_query { withComponents:["starfall.star"] }` (3 matches). So three tools disagree about the same component.
- Root path: the schema catalog is built by scanning `entity.getComponents()` over a `registerQuery({required:[]})` (`packages/app/src/devtools/entities.ts:454`), which does not surface `starfall.star`, whereas the summary path (`entityHasComponentId`) and `ecs_query {withComponents}` both do. So the three tools resolve the same component through different code paths and disagree.
- Note: gameplay proves the fall/catch queries DO match the `addComponent`'d stars (stars fall and are caught), so query-level matching of `Star` is consistent — the divergence is specific to the schema-catalog scan. Exact mechanism (why `getComponents()`/the empty-required query omits Star while Basket is fine) needs source-level debugging; the only structural difference between the two custom components is import fan-out (`Star` imported by 3 SSR-loaded system modules, `Basket` by 2).
- Impact: agents cannot reliably introspect user-component schemas — silent (`componentSchemaNotFound`, no crash), non-obvious, and inconsistent with the other ECS tools.
- Fix direction: build the schema catalog from the world's registered-component set rather than by scanning live entities via an ad-hoc empty query.

### OBSERVATION O3 — `logs_read` shape differs between targets
- `logs_read({target:"headless"})` returns structured diagnostic **entries** (`{time, level, source, code, message}`); `logs_read({target:"headed"})` returns a list of log **files** (`{name, file}`). Both "work" but an agent must parse two shapes — same family as F7.

### PARITY WINS (headless vs headed)
- **Authoring parity — identical.** Both slots boot the exact same authored scene: `["basket","camera.main","floor","light.fill","light.key"]` and the same 4 systems. Systems' `init` output is backend-independent.
- **Rendering parity — strong.** The live headed browser frame (SwiftShader WebGPU canvas screenshot) is visually indistinguishable from the headless `render-bundle` frame: same per-camera dark-blue clearColor, floor, teal basket, per-star random-hue cubes. Same renderer, same materials, same layout.
- **Determinism is the intended divergence.** Headless steps a fixed `delta` and replays bit-identically from a seed; headed runs a real-time rAF loop with variable delta (headed showed 10 stars spawned vs headless 9 at seed 1 after a different wall-clock duration). This is the documented reason to iterate headless and smoke-test headed — confirmed working as designed.
- **Tool parity — mostly good.** `ecs_*`, `resource_get`, `input_get_state`, `camera_*` work against both targets through one MCP server. Exceptions: `frame_capture` (F7) and `app_reset` (F5, headless slot).

### FINDING F9 (MEDIUM) — default `--asset-mode placeholder` yields an EMPTY, un-renderable bundle for GLB-only scenes (breaks the scaffolded glb-viewer on its default path)
- Scaffolded a fresh `aperture create viewer --template glb-viewer` (its only visible content is one `spawn.gltf(sampleCube)`).
- `aperture headless aperture.headless.config.ts --out x.json` (DEFAULT `placeholder` mode) → `snapshot.meshDraws = 0`: the placeholder gltf carries no geometry, so nothing is drawn.
- `aperture render x.json --allow-placeholders` then FAILS: `aperture.render.renderFailed → webGpuApp.emptySnapshot: WebGPU app render requires at least one view and one mesh draw`. `--allow-placeholders` does not help because the problem is an empty snapshot, not stubbed pixels.
- `--asset-mode hybrid` and `--asset-mode strict` both fix it (`meshDraws = 1`, real 8-vert/36-index cube geometry decoded in Node).
- So the documented default headless→render path is broken out-of-the-box for the shipped glb-viewer template. The `aperture headless` CLI default is `placeholder`, while the scaffold's CLAUDE.md uses `assetMode:"hybrid"` for the MCP path — an inconsistent default that bites GLB-centric apps.
- Recommendation: either default GLB/gltf assets to a visible stub mesh in placeholder mode, or make `aperture render` emit a clearer diagnostic ("bundle has 0 mesh draws — re-export with --asset-mode hybrid/strict") instead of the low-level `emptySnapshot`, and/or default the CLI to `hybrid`.

### WIN W8 — strict/hybrid GLB asset loading decodes real glTF in Node
- `--asset-mode strict` on the glb-viewer decoded the real `sample-cube.glb` (8 verts, 36 indices, POSITION-only) into a real mesh+material closure (`real:4, placeholderCount:0`, referenced `mesh:sampleCube:mesh:0:primitive:0`). Rendered to a PNG via the headed path.
- OBSERVATION O5: the shipped `sample-cube.glb` has only a POSITION attribute (no NORMAL/TEXCOORD). Under the default lit standard material it renders as a flat, unshaded shape rather than a shaded cube — a render/material concern common to both headed and headless, and a poor "sample" asset for a template.

### FINDING F10 (MEDIUM) — `input_inject` is documented as a shared headless tool but is headed-only
- Calling `input_inject` against a headless session returns `{ok:false, aperture.headless.toolUnavailable: "Tool 'input_inject' is not available in a headless session."}`.
- Yet `docs/AI_TOOLING.md` lists `input_inject` among "shared intent-level tools for both the managed browser slot and the warm headless slot", and the scaffold's generated `CLAUDE.md` explicitly tells agents to "Iterate with shared tools: … `input_inject` …". The MCP `tools/list` also advertises it (part of the 47).
- The actual headless input path is `input_action_set` (verified: `{action:"move", x:1}` held for 30 steps drove basketX to 3.5) and `input_gamepad_set`. So an agent following the scaffold's own instructions hits a wall on the first input step.
- Recommendation: either implement `input_inject` for headless (delegating to `input_action_set`/pointer), or fix the docs + scaffold CLAUDE.md to name the headless-available input tools.

### FINDING F11 (LOW) — pointing `aperture headless` at a browser config gives a cryptic `BASE_URL` error instead of a mode mismatch
- `aperture headless aperture.config.ts` (the browser config) fails with `aperture.headless.configLoadFailed: … Cannot read properties of undefined (reading 'BASE_URL')` because the browser config reads `import.meta.env.BASE_URL`, which is undefined in the Node SSR loader — and this throws during module evaluation, before the loader's `mode: "headless"` check can run.
- A user who accidentally points headless at the browser config gets a confusing message. Recommendation: detect `import.meta.env` access / a `mode !== "headless"` config and emit a targeted "expected a mode: 'headless' config" diagnostic.

### OBSERVATION O7 — `--frames -3` reports "requires a value"
- Negative numeric option values are indistinguishable from flags to the parser (`-3` starts with `-`), so `--frames -3` errors with `aperture.cli.missingOptionValue: Option '--frames' requires a value` rather than a range error. Harmless (frames can't be negative) but the message misleads.

### FINDING F12 (LOW-MEDIUM) — scaffold `tsconfig` only typechecks `src/**`; systems elsewhere are silently unchecked
- The scaffold `tsconfig.json` `include` is `["…configs…", "src/**/*.ts", ".aperture/generated/**/*.d.ts"]`. Systems placed outside `src/` (I used `phys-src/`, `hier-src/`, `fx-src/` for isolated probes, each with its own headless config) are loaded and run by the headless CLI (which globs from the config's `systems` field) but are **completely excluded from `tsc --noEmit`**.
- Because the headless config-loader strips types (native TS stripping, no check) and the docs explicitly rely on "run `tsc` alongside", a developer using a non-`src` layout gets **silent zero type coverage** with a green `pnpm run typecheck`. I proved it: a probe file under `fx-src/` with clearly-invalid `particles.emit` options and facade-as-string assignments passed `typecheck` (exit 0); the identical probe under `src/systems/` produced 3 `error TS…` (facades ARE precisely typed: `SpawnCommands`, `ParticleAccess`; `TS2353: 'transform' does not exist in ParticleEmitOptions`).
- Recommendation: broaden the scaffold `include` to the app root (or match the config's `systems` glob), and/or have `aperture headless` optionally run a type check.

### WIN W10 — particle emission works in pure-Node headless (correction)
- An earlier `undefined[0]` crash on `this.particles.emit` was **my error** (wrong options in an unchecked `fx-src` file). With correct `ParticleEmitOptions` (`{ count, position }`) and a config-declared inline `asset.particleEffect(...)`, headless emits with no crash (`emit → true`, 30 frames stepped). Particle effect assets also load fine headless (declaring one alone boots). The system facades (`this.spawn`, `this.particles`, …) are strongly typed inside `src/`.
- OBSERVATION O8: a missing required particle emit option produces a cryptic runtime `Cannot read properties of undefined (reading '0')` at `render/dist/rendering/particle-burst-queue.js:209` (`tuple3(request.position)`), with no argument validation. Combined with F12/type-stripping this is easy to hit; a "position/count are required" guard would help.

### WIN W11 — headless handles scale (600 entities) and renders it
- 600 cubes + camera + light: 300 frames in 4.8 s wall; all 600 draws extracted (in-frustum) and rendered to a coherent 640×480 grid image.
- OBSERVATION O9 — entity summaries truncate at 50: `entities.total:602, summaries:50, truncated:true`. Sensible cap, but an agent inspecting a large scene sees only 50 by default and must filter/paginate (`ecs_find_entities` with `tags`/`withComponents`/`limit`). Worth documenting.
- OBSERVATION O10 — render bundle grows ~linearly (~4.7 KB/entity → 2.84 MB for 600). A 10k-entity scene would produce a ~47 MB JSON bundle; typed-array payloads help but the per-draw JSON metadata dominates. Marginal step rate falls to ~101 steps/s at 600 entities (per-entity extraction cost), vs ~2,600 at ~7 — expected, still usable.

### WIN W9 — hierarchy transforms & recursive despawn are correct in headless
- Parent at [5,0,0] rotated 90°/Z; children at local +y = 1/2/3 compose to WORLD [4,0,0],[3,0,0],[2,0,0] (90°/Z maps +y→−x). Parent∘child world composition is exact.
- `hierarchy.despawnRecursive({index, generation})` returns `{ok:true, despawned:4}` (parent + 3 children); final scene = camera+light only. Subtree teardown works.

### OBSERVATION O6 — two incompatible entity-ref formats across facades
- `serializeEntityRef(entity)` returns a **string**; docs use it for `this.physics.moveCharacter({ entity: serializeEntityRef(body) })`. But `hierarchy.*` and the entity-lookup tools require the `EcsEntityRef` **object** `{index, generation}` (a live `Entity` also works since it structurally matches).
- Feeding the serialized string to `despawnRecursive` returns `{ok:false, despawned:0, diagnostic:"aperture.entityLookup.invalidRef"}` — cleanly diagnosed (not a silent no-op), but easy to miss if you only read `.despawned`, and the dual currency is a footgun. Consider accepting both forms everywhere, or naming them distinctly.

### WIN W6 — Rapier physics fully simulates in pure-Node headless, deterministically
- Isolated `physics.headless.config.ts` (`physics: { backend: "rapier", gravity: [0,-9.81,0] }`) with a static floor + 3 dynamic cubes dropped from y=3/5/7.
- After 180 frames they fell and **stacked** with correct collision resolution: box.0 y=0.499 (floor top +0.5), box.1 y=1.497 (on box.0), box.2 y=2.496 (on box.1). Fixed-step clock advanced to index 180. Rendered PNG shows the leaning tower on the floor.
- Determinism: two runs byte-identical (digest `136be813`). Rapier WASM loads and simulates in Node with no browser.
- OBSERVATION O4: a Rapier init deprecation warning leaks to stderr on every physics headless boot: `using deprecated parameters for the initialization function; pass a single object instead`. Cosmetic but noisy for agents that treat stderr as errors.

### WIN W7 — headless throughput is fast; boot cost motivates `serve`
- One-shot fixed cost (Vite-SSR config load + runner boot + extract + write): **~1.85s** for both Starfall and physics (boot-only, 0 frames).
- Marginal step rate (excluding boot): **~2,600 steps/s** Starfall (≤40 stars, custom components, spawn/despawn), **~2,070 steps/s** physics (Rapier fixed-step). Measured from the 600f/3000f wall-clock deltas.
- Takeaway: the ~1.85s per-invocation boot dominates short runs, so iterative work should use `aperture headless serve` (boot once) rather than repeated one-shot `aperture headless`. Confirms the design rationale for warm serve mode — and makes the F5 `reset` crash more costly (you can't cheaply re-seed a warm session with custom components).

### WIN W3 — per-camera `clearColor` is honored by headless render
- Setting `spawn.camera({ camera: { clearColor: [0.02,0.03,0.07,1] } })` yields a dark-blue background in the `aperture render` PNG (vs the black baseline). Confirms the F1 workaround and that the render path reads the extracted view's clearColor faithfully.

</content>
