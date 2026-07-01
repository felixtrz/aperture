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

### FINDING F4 (MEDIUM) — one-shot `aperture headless --inject` silently ignores axis/analog actions
- `--inject [{atFrame:0, actions:{magnet:true}}]` (button) held magnetActive true across 60 frames; a pointer inject reflected in `input.pointer.primary`. But `--inject {actions:{move:true}}` for the `axis2d` move action produced **basketX=0 with no warning and no effect** — the one-shot enqueue path (`createApertureHeadlessInjectEvents`) accepts any action name and silently no-ops non-buttons, while the sibling `applyApertureHeadlessInjectStep` path throws a helpful "inject only drives button actions… use input_action_set" error.
- Axis/analog actions can only be driven via `serve`/`input_action_set` (verified: `{action:"move",x:1}` held for 30 steps → basketX 3.5). The one-shot inject schema has no way to pass an axis value at all.
- Recommendation: warn (or error) when a non-button action is injected one-shot, matching the other path.

### WIN W14 — headless release gates pass
- `check:headless-boundaries` (11 files — no browser/WebGPU imports in headless paths), `check:render-bundles` (fixture closure-complete), and `check:pack-cli` (packs internal packages, installs, runs a headless smoke — the exact flow I did by hand) all pass. The headless flow is genuinely CI-gated.

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
- PARITY: `app_reset` on the **headed** slot (same Starfall app, same custom components) returns `{ok:true}` and the session keeps running — the browser reloads the page, giving a fresh JS realm that re-creates the module singletons cleanly. So F5 is **specific to the headless in-process reboot model** (serve/MCP-headless), which is exactly what the root-cause + repro predict.
- **ROOT CAUSE (verified):** elics `Entity.addComponent` (`elics@3.4.2/lib/entity.js:20`) re-registers a component only when `component.bitmask === null`. A module-singleton `defineComponent` keeps a non-null `bitmask`/`typeId` from world #1, so on world #2 (`reset`) `addComponent` **skips** re-registration and `orInPlace`s the STALE world-1 typeId bit into the new entity's bitmask. That typeId resolves to `null` on world #2's component manager (`getComponentByTypeId`), and `entityHasComponentId` → `getComponents().some(c => c.id === …)` dereferences `null.id`. App components avoid this only because `registerApertureAppComponents` explicitly re-registers them (fresh bitmask/typeId) in a stable order before use.
- **VERIFIED FIX (one line):** change the guard to consult the *current* world — `if (!this.componentManager.hasComponent(component))`. I patched the app's `elics@3.4.2` copy and re-ran `repro-reset.mjs`: **"boot2 (simulated reset) ok … RESULT: no crash"**; reverting restores the crash.
- Fix path for Aperture: upstream the elics guard fix and bump, OR work around in the `reset`/`bootRunner` path by resetting each user component's `typeId=-1`/`bitmask=null` (or re-registering user components through the stable app path) when constructing the new world. (An earlier candidate — patching only the `addComponent` guard on the *monorepo* elics copy — appeared not to help until I found the packed app resolves its own `app/node_modules/.pnpm/elics@3.4.2` copy; patching that confirmed the fix.)

### OBSERVATION O13 — session restore is a faithful continuation only if every system serializes its private fields
- Even for a cleanly-restoring standard-component app (hier, `restore.ok:true`), restoring at frame 30 and stepping 60 more diverges from a straight 90-frame run (`snapshotDigest 48421d18 ≠ 8e59dfc2`). Confirmed cause: the hier system caches the parent entity in a plain private field (`this.parentEntity`) and does not implement `snapshotState()`/`restoreState()`, so after restore that field is null and the frame-60 subtree despawn never fires — the restored run keeps 4 meshDraws vs the straight run's 0.
- This is the documented "opt-in private system state" limitation, but it is an easy footgun: holding state in a private field (a cached handle, a timer, a flag — a very natural pattern) silently breaks restore fidelity, and `restore.ok:true` gives false confidence. Combined with F6 (custom components) it means SessionSnapshot v1 restore is only bit-exact for apps that are written fully snapshot-aware. Worth a prominent doc callout + maybe a lint/diagnostic for systems with un-serialized private fields.
- **VERIFIED the opt-in fix**: adding `snapshotState()` (returns `{parentRef}`) + `restoreState(payload, ctx, remapEntityRef)` (maps the saved ref to the restored entity) makes the restored run's despawn fire again — restored `meshDraws` now equals the straight run's (0 = 0). So the SessionSnapshot v1 opt-in API works for private handle state. The residual `snapshotDigest` difference (`2c0eb926` vs `8e59dfc2`) is **entity-index reassignment on restore** (the restored world hands out different indices/generations) — the *semantic* state is faithful, but restore is not guaranteed bit-identical at the entity-identity level even for a fully snapshot-aware app.

### FINDING F6 (MEDIUM) — session snapshot restore silently drops custom components & resources
- `snapshot` (save) + `restore` on Starfall at frame 90 returns `{ok:true, result:{ok:false, restore:{ok:false, scene:{ok:false, diagnostics:[...]}}}}`.
- Diagnostics: `aperture.serialization.unregisteredComponent` — "No registered component for id 'starfall.basket'/'starfall.star'; component skipped" (once per affected entity), and `resources:{restored:0, missing:["starfall.director"]}`.
- So restored entities load their transforms but **lose all custom-component state** (`Star.fallSpeed`, `Basket.speed/halfWidth`) and the custom **resource** resets. Signals (6), RNG, and fixed-step clock DO restore. Docs claim SessionSnapshot v1 "captures the component registry ids" and supports opt-in system state — but user components/resources defined via `defineComponent`/`defineResource` are not resolvable at restore.
- Secondary ergonomics bug: the serve `restore` response is `ok:true` at the top level while the payload is `ok:false`. A caller that checks only the top-level flag treats a failed restore as success.
- Fix direction: register user components/resources into the restore-time registry before loading the scene (same fix family as F5); and propagate `result.ok:false` to the command envelope.
- ISOLATED: the same save/restore on the `hier` app (only standard app components, no custom `defineComponent`/`defineResource`) restores cleanly — `{ok:true, scene:{ok:true, entities:6, diagnostics:[]}}`. So the SessionSnapshot machinery is sound; the failure is specific to user-defined component/resource types.
- **ROOT CAUSE (verified by instrumentation):** the decode registry is `componentRegistryFromWorld(restoreWorld)` (`headless.js` `restoreApertureSessionSnapshotIntoRunner`). Logging both calls in one session: at **save** it returns **50 components incl. `starfall.basket`+`starfall.star`**; at **restore** it returns only **48 — the two custom components are absent** (`hasStar=false hasBasket=false`). The restore world therefore can't resolve those ids and the codec skips them. The user components are contributed to a world only by system queries/`addComponent` at runtime, which the restore path does not reproduce before `loadScene`. Compounding this, `componentRegistryFromWorld` **breaks at the first null typeId**, so any gap (e.g. from the F5 stale-typeId family) silently truncates the registry.
- **FIX (concrete):** the snapshot manifest already carries `componentRegistry.ids`; at restore, register/resolve the app's declared components (or run system registration) so the decode registry includes them, and make `componentRegistryFromWorld` skip nulls up to a bound rather than break at the first gap.

### OBSERVATION O2 — `ecs_set_component_field` cannot mutate user components (by design)
- Mutation goes through a hardcoded allowlist (`componentFieldMutations`) covering app/physics components (LocalTransform, Camera, RigidBody, …). Custom `defineComponent` ids return `aperture.entityLookup.componentMutationUnsupported` with a clear `suggestedFix`.
- Reasonable safety choice, but a real limitation for the headless dev loop: an agent can *inspect* custom components (`ecs_find_entities`/`ecs_get_entity` show them) but cannot poke their fields from tooling — it must write/modify a system. Worth documenting as a known boundary.

### WIN W4 — determinism diagnostics work as documented
- A temporary system calling `Math.random()` is flagged by `--determinism warn` (`aperture.determinism.nondeterministicGlobal: NaughtySystem called Math.random during update; use context.random`, exit 0) and fails `--determinism error` (adds `aperture.headless.determinismViolation`, exit 1). Correct.

### WIN W5 — MCP stdio agent surface is complete and functional
- `aperture mcp stdio` speaks MCP `2025-06-18`, advertises **47 tools** (app lifecycle, ecs_*, camera_*, input_*, frame_capture, logs_read, render_bundle, session_snapshot_*, determinism_report, reference_*).
- End-to-end headless drive works: `app_start(headless)` → `app_status(running:true)` → `ecs_step(90)` (meshDraws 4) → `ecs_find_entities(star)` (2) → `frame_capture(320x240)` (renders via bundle) → `app_stop`. Only `app_reset` is broken (F5).
- ECS debugging tools are genuinely useful: `ecs_snapshot` + `ecs_diff` between two frames reports `{added:1, removed:0, changed:1, unchanged:5}` with full detail of the spawned/mutated entities — a real state-diffing workflow for headless simulation debugging. `ecs_get_hierarchy`, `ecs_query`, camera_* all verified working (F8 is the one gap: `ecs_get_component_schema` misses dynamically-spawned custom components).

### FINDING F7 (MEDIUM) — `frame_capture` return shape & dimension handling differ between headed and headless
- Same tool, same args `{width:480, height:320}`, opposite results:
  - **headed** → MCP `content:["image"]` (inline 7962-byte PNG), live canvas **960×640** (requested dims **ignored**), no text/metadata/pngPath.
  - **headless** → MCP `content:["text"]` with JSON `{source:"render-bundle", actualDimensions:{480×320}, pngPath:...}`, **no inline image**, dims **honored**.
- `frame_capture` is the public, backend-agnostic "get a picture" tool meant to unify both slots (per docs and the scaffold CLAUDE.md), yet an agent must branch on target to read a result and cannot rely on requested dimensions. This undercuts the "same intent-level tools for both slots" promise.
- Recommendation: normalize the envelope — always return both an inline image and a text metadata block with `actualDimensions` — and either honor width/height for headed (offscreen render) or document that headed ignores them.

### FINDING F8 (MEDIUM) — `ecs_get_component_schema` can't see a custom component that IS on live entities (component-identity inconsistency)
- With 2 live `star.*` entities, `ecs_get_component_schema` (no filter) lists app components + `starfall.basket` but **omits `starfall.star`**; filtering for it returns `aperture.devtools.componentSchemaNotFound`. `starfall.basket` (defined identically) is always found.
- Yet the same star entities report `starfall.star` in their `componentIds` (entity-summary path) and are matched by `ecs_query { withComponents:["starfall.star"] }` (3 matches). So three tools disagree about the same component.
- **ROOT CAUSE (verified):** the schema catalog is built by scanning `entity.getComponents()` over `registerQuery({ required: [] }).entities` (`packages/app/src/devtools/entities.ts:454`). Instrumenting that scan during a live run with 2 stars: **`emptyQuery = 5` entities (indices 0-4, the init-spawned camera/lights/floor/basket) vs `indexLookup = 7`** (the 2 stars, indices 5-6, are absent). An empty-required elics query only carries entities present when it was first registered/matched; it does **not** pick up entities spawned afterward. So `starfall.basket` (on init entity 4) is found and `starfall.star` (on runtime entities 5-6) is missed — nothing to do with the earlier import-fan-out guess.
- The summary/lookup path avoids this because `collectActiveEntities` (`summary.ts:184`) prefers `entityManager.indexLookup` (all 7 entities) and only falls back to the empty query — which is exactly why `ecs_find_entities`/`ecs_query`/entity `componentIds` all see `starfall.star` while the schema catalog doesn't.
- **FIX (verified):** enumerate entities in `apertureEntityComponentSchemas` via `collectActiveEntities(world)` / `entityManager.indexLookup` (the same source `findApertureEntities` uses) instead of the raw `registerQuery({ required: [] }).entities`. I patched the packed schema collection to iterate `indexLookup` and re-ran with 2 live stars: **`starfall.star` schema found: true** (was false); reverting restores the miss.
- Impact: agents cannot reliably introspect user-component schemas for dynamically-spawned components — silent (`componentSchemaNotFound`), non-obvious, inconsistent with the other ECS tools.

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
- REAL-WORLD GLB: strict mode loads a production multi-material GLB (`blaster.glb`, mesh:1/material:2/texture:1/sampler:1) including resolving its **external** texture reference (`Textures/colormap.png`) relative to the GLB — closure-complete, no placeholders — and renders a correctly-textured, PBR-shaded model (`artifacts/glbscene.png`). When the external texture is missing, the error is clear and actionable ("Fetching GLB URI '…/colormap.png' failed with HTTP 404 … use --asset-mode hybrid"). Production game assets work end-to-end headless.

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

### FINDING F14 (MEDIUM) — `aperture render` omits app-level post-effects (bloom/exposure); the render bundle doesn't capture render config
- A config with `render: { bloom: true, exposure: 1.2 }` + a bright emissive sphere (`emissiveFactor: [6,5,1]`) renders as a **hard-clamped white disc with no bloom halo** (`artifacts/bloom.png`). The bundle JSON contains **no** `bloom`/`exposure`/`postEffect`/`tonemap` keys.
- Generalizes F1: the render bundle carries the `RenderSnapshot` (geometry/lighting/camera view, incl. per-camera clearColor) but **not app-level render/post-processing config** (bloom, exposure, tonemapping, `render.clearColor`). So `aperture render` and MCP `frame_capture` (headless) previews lack the app's post-processing — the offline render is not final-look-accurate, and will differ from the live browser if the browser applies these.
- Recommendation: capture app render/post config in the bundle (or a sidecar) and apply it in the render harness, or document that `aperture render` is a geometry/lighting preview without post-effects.

### FINDING F13 (MEDIUM) — `aperture render` produces an all-black frame for cameras with a fractional `viewport` (split-screen / PiP)
- Extraction is fine: two cameras with `viewport:[0,0,0.5,1]` and `[0.5,0,0.5,1]` produce **2 views** in the snapshot with the correct viewport rects.
- But `aperture render` returns `aperture.render.blankFrame`; with `--allow-blank` the PNG is **entirely black** (verified visually). A SINGLE camera with `viewport:[0,0,0.5,1]` is also all-black, while the same camera with the default full `[0,0,1,1]` renders the scene. So the render harness does not honor fractional viewport rects — split-screen/PiP/minimap setups render nothing.
- Impact: any multi-viewport layout is un-renderable via the headless render path (and the blank-guard's message misattributes it to unresolved assets / headless compositing, which is misleading here).
- Recommendation: honor `view.viewport`/`view.scissor` in the render harness, or document that `aperture render` composites only full-frame single views.

### WIN W23 — spatial queries (raycast/overlap) work headless (documented recipe verified)
- Followed `docs/recipes/spatial-queries-from-systems.md`: a center-screen ray (`cameras.main.rayFromPointer([0.5,0.5])`) → `spatial.raycastFirst` correctly picked the `target` cube at the origin (not the `offside` cube at x=4), `source:"mesh-bvh"`, distance 5.4 (camera z=6 → front face). `spatial.overlapSphere([0,0,0],1.5)` found exactly 1 mesh (target in range, offside out). The BVH auto-populates from ECS bounds — line-of-sight/picking/AoE all work in pure Node. (tsc caught my invalid `source` option on `overlapSphere` — another F12 instance.)

### WIN W22 — custom WGSL materials work headless→render (documented recipe verified)
- Followed `docs/recipes/custom-wgsl-material.md`: `asset.shader("/shaders/water.wgsl")` + `material.customWgsl({ shader: shader.asset(...), entryPoints:{vertex,fragment}, bindings:[material.uniform(...)] })` on a plane.
- `--asset-mode strict` decodes the WGSL in Node (`shader: ready`); the mesh draw uses the custom pipeline family (`pipelineKey: test/water|bindings:0:uniform-buffer|specialization:…`). `aperture render` compiles + runs the shader through WebGPU, producing the exact UV-gradient from `fs_main` (`band = 0.35 + 0.65*uv.y` × water color) — `artifacts/wgsl.png`. Power-user custom shaders work end-to-end headless.

### WIN W21 — all three scaffold templates work end-to-end from the packed CLI
- `aperture create --template minimal|game|glb-viewer` each scaffold, install from tarballs, typecheck, `aperture headless`, and `aperture render` cleanly. The `minimal` template's spinning cube renders as a lit, slightly-rotated blue cube (`artifacts/minimal.png`); `game`→Starfall; `glb-viewer`→GLB (with the F9 asset-mode caveat). Template + pack→install→headless→render coverage is complete.

### WIN W20 — RAG reference tooling works (semantic code search over the corpus)
- `aperture reference warmup` downloaded the versioned corpus + pinned Transformers.js embeddings model through the proxy (758 entries / 3277 chunks / 758 sources); `reference status` → ready.
- `aperture reference search "spawn a mesh with a physics body"` returned highly relevant ranked code — `withMesh` (0.87), `withPhysicsMaterial` (0.82), the `physics` descriptor helpers (0.80), `withRigidBody` (0.80). A genuinely useful natural-language API-discovery tool for building Aperture apps.
- The 8 granular MCP `reference_*` tools all work against the warmed corpus: `reference_list_components` (68), `reference_list_systems` (10), `reference_api_lookup`, `reference_find_examples`, `reference_explain_diagnostic`, `reference_search` (10 hits) — all return data, no errors.

### WIN W19 — fog + procedural sky work headless→render
- `spawn.fog({mode:"linear", …})` extracts (`fogs:1`) and `aperture render` clearly fades receding pillars toward the fog color; `spawn.proceduralSky` renders a gradient sky with a sun glow (`artifacts/sky.png`). (Minor: proceduralSky isn't counted in the snapshot's `skyboxes` array — tracked elsewhere — but renders fine.)

### WIN W18 — shadow mapping works headless→render
- A directional light with `shadow: true` + a `castShadow` cube over a `receiveShadow` ground extracts `shadowRequests: 1` in headless; `aperture render` produces a correct cast shadow on the ground with proper PBR shading (`artifacts/shadow.png`). The full lighting + shadow-map + PBR pipeline works from a Node-produced bundle through SwiftShader WebGPU.

### WIN W17 — the headless loop is a real development environment (extended the game through it)
- Added combo/multiplier scoring, a score-derived level with a difficulty ramp (spawn interval shrinks with level), and a game-over-at-10-misses state — five new signals, a new `progression.system`, and edits to `catch`/`director`. Developed entirely via edit → `tsc` → `aperture headless serve` → inspect signals → iterate; no browser needed.
- Verified through the serve loop (`game-progression.mjs`): PASSIVE play reaches **gameOver at tick 187** (misses hit the cap; director then stops spawning, `activeStars:0`). AUTOPLAY reaches **score 31, bestCombo 9, peak multiplier 2, level 4** with the difficulty ramp visibly increasing spawn density (7 active stars). All new mechanics behave as designed.
- Determinism preserved: `--determinism error` exits 0 and the 300-frame replay stays byte-identical after the feature work. This is the "simulation-first, headless-first" development story working for real, non-trivial gameplay.

### WIN W16 — robust error handling & input resilience
- Large-scale determinism holds: the 600-entity/300-frame scene replays **byte-identical**.
- Asset errors are clean and actionable: missing file in strict → `aperture.headless.assetNotFound` with the resolved path + "use --asset-mode hybrid"; HTTP asset without the flag → `assetLoadFailed: Node asset loader does not fetch 'https:' assets unless allowHttp is enabled`. Both exit 1.
- Mid-run exception: a system throwing in `update()` aborts with `aperture.cli.failed: System 'Boom' threw during update(): …` — attributed to the system + phase.
- `serve` is resilient to bad input: a non-JSON line returns `{ok:false, error:"Invalid JSON command…"}` and the session keeps processing subsequent commands; an unknown command returns `{ok:false, error:"Unknown command 'x'."}`. One bad line does not kill the session.
- OBSERVATION O12: system-exception errors end with "the original stack is preserved below", but the CLI prints only the message — there is no stack "below" on stderr. Minor but misleading when debugging.
- Long-running stability: a 10,000-frame run completes in ~3.9 s (exit 0) with entity count bounded (5 static entities after game-over halts spawning) — no crash, no unbounded growth over long sessions.
- Parallel-safe: 4 concurrent `aperture headless` processes (different seeds) finish in ~2.75 s and each is **byte-identical to its serial run** (no shared-state corruption between processes) with 4 distinct outcomes — safe for CI/batch fan-out.
- Multi-seed determinism: seeds 1-5 each replay byte-identically AND produce 5 distinct `snapshotDigest`s — determinism holds across the seed space with genuine per-seed variation.
- The documented "erasable TypeScript only" loader restriction fails cleanly: a TS `enum` in a system → `aperture.headless.configLoadFailed: … TypeScript enum is not supported in strip-only mode` (confirms the loader now uses native Node type-stripping, per the `headless-route-hardening` Track A plan), with the erasable-TS hint. Exit 1.

### WIN W15 — deterministic input replay + one-shot≡serve equivalence
- Input replay: a timed `--inject` file (`[{atFrame:0,actions:{magnet:true}},{atFrame:40,actions:{magnet:false}}]`) is a reproducible recording — it changed the sim (digest `c0f9001b` vs no-input `eab193ea`) and two replays are byte-identical. Timed `atFrame` sequences fire at the right frames.
- Entry-point equivalence: one-shot `aperture headless --frames 90` and `serve` stepping 90 produce **byte-identical `snapshot.value`** and the same `snapshotDigest` hash (`0f4c82b2`). The two headless entry points are consistent.
- OBSERVATION O11: the full bundle `digest` also covers provenance (`createdBy` = "aperture headless" vs "aperture serve"), so identical content gets different **full** digests across tools (`eab193ea` vs `c0158f1c`). Use `snapshotDigest` (content-only) to compare "is this the same render?", not the top-level `digest`. (Also: `snapshotDigest`/`digest` are objects `{algorithm,hash,byteLength}` — compare `.hash`, not the object, or `===` always says "different".)

### WIN W13 — Rapier kinematic character controller resolves collisions in headless (via fixedUpdate)
- A kinematic-position capsule with a `characterController` walks +x toward a static wall (face at x=2.75, capsule radius 0.4). Driving it via `this.physics.moveCharacter({ entity: serializeEntityRef(body), desiredTranslation })` + `setKinematicTarget` inside `fixedUpdate`, after 120 frames it **stops at x=2.34** (expected ~2.35) — collision resolved, snapped to ground (y=1.008), not passing through. Deterministic character movement + `fixedUpdate` both work in pure Node.
- Incidentally reconfirms O6: `moveCharacter` takes a `serializeEntityRef` **string** while `setKinematicTarget` takes the **Entity** — both used in the same call site.

### WIN W12 — audio, RNG fork, and multi-view extraction all work headless
- **Audio:** `--asset-mode strict` decodes a real WAV in Node (`audio-clip: ready:1, failed:0`); `this.audio.playOneShot("key", { clip: this.audio.clip("blip"), gain })` creates an emitter entity with no audio device and no crash. (An earlier crash was API misuse — `position` isn't an `AudioOneShotOptions` field — caught by tsc only after adding `audio-src` to the include: another instance of F12.)
- **RNG fork:** `context.random.fork("stream-a")` vs `fork("stream-b")` produce independent sequences (`[957,178,83]` vs `[4,424,11]`), and the whole run stays deterministic — good for per-feature independent streams.
- **Multi-view:** two cameras with distinct viewports extract as **2 views** with correct rects (rendering them is F13).

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
- Restitution too: a ball with restitution 0.9 dropped from y=5 bounces with monotonically-decreasing apexes (5 → 4.20 → 3.49 → 2.92 → 2.50 — correct energy loss) and replays byte-identically. Combined with W13 (kinematic character), physics is thoroughly headless-capable: dynamic stacking, kinematic collision, and restitution all work deterministically.

### WIN W7 — headless throughput is fast; boot cost motivates `serve`
- One-shot fixed cost (Vite-SSR config load + runner boot + extract + write): **~1.85s** for both Starfall and physics (boot-only, 0 frames).
- Marginal step rate (excluding boot): **~2,600 steps/s** Starfall (≤40 stars, custom components, spawn/despawn), **~2,070 steps/s** physics (Rapier fixed-step). Measured from the 600f/3000f wall-clock deltas.
- Takeaway: the ~1.85s per-invocation boot dominates short runs, so iterative work should use `aperture headless serve` (boot once) rather than repeated one-shot `aperture headless`. Confirms the design rationale for warm serve mode — and makes the F5 `reset` crash more costly (you can't cheaply re-seed a warm session with custom components).

### WIN W3 — per-camera `clearColor` is honored by headless render
- Setting `spawn.camera({ camera: { clearColor: [0.02,0.03,0.07,1] } })` yields a dark-blue background in the `aperture render` PNG (vs the black baseline). Confirms the F1 workaround and that the render path reads the extracted view's clearColor faithfully.

</content>

### FINDING F15 (HIGH) — skinned GLB animation frozen at bind pose for uniform scale ≤ 0.01 (shared runtime math bug)
- Setup: `anim.headless.config.ts` loads a rigged `Soldier.glb` (stock three.js sample, 2.1 MB) in strict mode → `mesh:2, material:3, texture:2, animation-clip:4`. `anim-src/setup.system.ts` calls `spawn.animation(soldierRoot)`; `clipIds` enumerates `["Idle","Run","TPose","Walk"]`; `playClip("Idle",{loop:"repeat"})` sets `activeClipId="Idle"`.
- Symptom: `aperture render` of the bundle at frame 10 vs frame 45 is **byte-identical** (both frozen); the soldier renders in a static **T-pose** (bind pose), never the Idle pose. Snapshot has real skin data — `meshDraws[1].boneMatrixCount=49`, `bones` Float32Array = 816 floats (51 mat4) — but the `bones` palette is **byte-identical across frames 5/40/80** (maxAbsDiff 0), and the 4 render-entity world transforms are frozen too.
- Root cause, traced by instrumenting the packed runtime under `app/node_modules/.pnpm/@aperture-engine+runtime@.../dist`:
  1. `updateAnimationDrivers` (animation-driver-system.js) is **correct**: probe shows every headless step `active=Idle`, `time` ticking 0.0166→0.0333→…, `targets=71`, `channels=156`, `hit=156 missTarget=0 missLT=0` — all joint channels written into joint `LocalTransform`s.
  2. `updateSkeletonPalettes` (skinning-palette-system.js) runs each frame (`joints=49`) and the joints' **world** positions it reads DO change frame-to-frame (`joint1.worldPos` drifts) — but the computed palette hash is **bit-identical every frame** (`-1497970688`).
  3. Cause: the palette formula is `inverse(meshWorld)·jointWorld·inverseBind`. Soldier.glb is authored at uniform scale **0.01**, so `det(meshWorld)=0.01³=1e-6`. `invertMat4` (`@aperture-engine/math/matrix.ts`) returns `null` when `Math.abs(det) <= EPSILON`, and `EPSILON=1e-6` (constants.ts). `1e-6 <= 1e-6` is TRUE → `inverseMeshWorld=null` → the palette loop writes an **identity block for every joint** (`writeIdentityBlock`). Probe confirmed `invNull=true` and that the `PAL_J1` (post-invert) branch never runs.
- Verified fix, two ways:
  - (a) Patched packed math `EPSILON` 1e-6→1e-12, re-ran the **unchanged** 0.01-scale soldier: `invNull=false`, paletteHash now VARIES per frame (`-1944580911 → 18948578 → -1098023342`); `aperture render` frame10 vs frame45 now **differ** (51333 vs 51490 bytes) and show a live animated pose. Restored EPSILON afterward.
  - (b) Spawned the soldier at `scale:[100,100,100]` (mesh world det → 1.0) with the shipped engine: `invNull=false`, palette hash varies per frame. Both confirm the determinant-epsilon gate is the sole cause.
- Scope: NOT headless-specific. `invertMat4` + `updateSkeletonPalettes` are shared runtime math invoked in every runtime `step()` (headed browser and headless alike), unlike F5. Any uniform scale ≤ 0.01 triggers it (`det=s³ ≤ 1e-6`); cm-/mm-authored GLBs (Blender/Maya/Mixamo defaults) commonly land there. The 1e-6 determinant is a perfectly well-conditioned matrix (inverse = scale-100) — the singularity test is simply far too coarse.
- Fix path: use a much smaller absolute epsilon (~1e-12) or a scale-relative / condition-number singularity test in `invertMat4`; and/or make `updateSkeletonPalettes` compute the mesh inverse without the epsilon gate (fall back to identity only on a genuinely non-finite result). Workaround today: author/spawn skinned rigs at a scale whose world-matrix determinant exceeds 1e-6.
- Artifacts: `artifacts/anim_frozen_bindpose.png` (before, T-pose), `artifacts/anim_animated_fixed.png` (after, Idle pose), `artifacts/anim_compare.png` (side-by-side). Repro: `serve-anim.mjs` (mixer probe), `make-anim-compare.mjs` (montage).

### WIN W24 — skeletal rig decode + animation simulation work in pure-Node headless
- A 49-joint rigged `Soldier.glb` decodes in strict mode (2 meshes / 3 materials / 2 textures / 4 clips), `spawn.animation().clipIds` enumerates the clips, and the mixer advances + writes all 156 joint channels into joint `LocalTransform`s every headless step (verified by instrumentation). The ECS/animation half is solid in Node; the animated pose just isn't visible in the render because of F15's palette-inversion bug.

### OBSERVATION (F10-adjacent) — `logs_read` is also unavailable in a headless serve session
- Calling MCP/serve `logs_read` against a headless slot → `aperture.headless.toolUnavailable: Tool 'logs_read' is not available in a headless session.` Same shape as F10's `input_inject` gap: a tool the docs/`CLAUDE.md` present as part of the headless inspection loop ("`logs_read` for recent diagnostics") is headed-only. Headless `diagnostics.info()` output therefore has no read-back channel from the tool surface (it only surfaces in the final bundle's `diagnostics`, filtered).

### F15 addendum — scale-threshold sweep (shipped engine, no patch) pins the boundary at det=1e-6
- `anim-src/setup.system.ts` reads `ANIM_SCALE` (default 1 = authored 0.01). Sweeping the uniform scale multiplier and comparing the extracted `bones` palette at frame 5 vs 45:

  | scale mult | effective scale | det=eff³ | bones Δ (f5 vs f45) | verdict |
  |---|---|---|---|---|
  | 0.5 | 5.0e-3 | 1.25e-7 | 0 | FROZEN |
  | 1 | 1.0e-2 | 1.00e-6 (= EPSILON) | 0 | FROZEN |
  | 1.01 | 1.01e-2 | 1.03e-6 | 612 | ANIMATES |
  | 1.02 | 1.02e-2 | 1.06e-6 | 612 | ANIMATES |
  | 2 | 2.0e-2 | 8.0e-6 | 612 | ANIMATES |
  | 5 | 5.0e-2 | 1.25e-4 | 588 | ANIMATES |
  | 100 | 1.0 | 1.0 | 588 | ANIMATES |

- The freeze/animate boundary is EXACTLY at `det = 1e-6` (`<=` includes the authored 0.01): scale 0.01 → frozen, 0.0101 → animates. Confirms F15 is precisely the `Math.abs(det) <= EPSILON` gate in `invertMat4`, reproducible with the shipped engine (no source patch). Repro: `for S in 0.5 1 1.01 2 100; do ANIM_SCALE=$S aperture headless anim.headless.config.ts --frames 45 ... ; done` and diff the bundle `snapshot.value.bones`.

### WIN W25 — instanced GLB via spawn.gltfBatch works headless→render
- `batch.headless.config.ts` + `batch-src/setup.system.ts`: a single `this.spawn.gltfBatch(this.assets.gltf("blaster"), { instances })` with 16 per-instance transforms (4×4 grid, distinct translation + yaw) returns **16 roots**; extraction reports **meshDraws:16, bounds:16** (one draw per instance), and `aperture render` produces the textured blaster grid at distinct positions/yaws (`artifacts/batch_grid.png`, hybrid asset mode). Two runs byte-identical (`snapshotDigest 1821ed3e`). Per-instance `transform` overrides apply correctly. Instanced/batched GLB spawning is fully headless-capable.
