# Aperture Headless Flow — Battle-Test Report

**Author:** Claude (claude-opus-4-8), autonomous session
**Date:** 2026-07-01 (session 15:04 → ongoing UTC)
**Repo:** `felixtrz/aperture` @ `claude/headless-mode-testing-g8cruw`
**Scope:** Build every workspace package to `.tgz`, install them into a fresh
consumer project exactly as an npm user would, then develop a real application
using **headless mode** — battle-testing the headless flow end-to-end and
comparing it against the **headed** (browser + WebGPU) flow.

---

## 1. Executive summary

Aperture's headless story is **genuinely good and largely production-ready**.
The core promise — "iterate your ECS/simulation in pure Node, deterministically,
without a browser, and render pixels only when you need them" — holds up under
real use. I developed a full game (*Starfall*, a deterministic star-catcher with
custom components, RNG-driven spawning, input, and runtime spawn/despawn),
verified bit-identical replay, drove an autopilot through the warm `serve` loop,
ran Rapier physics in Node, decoded real GLBs, and rendered every result to PNG
through the auto-provisioned SwiftShader WebGPU path. Authoring and rendering
**parity between headless and headed is excellent**.

That said, battle-testing surfaced **13 findings and 12 observations**, including
one **HIGH-severity crash** (whose root cause I traced to a single elics guard
and verified a one-line fix for), and a cluster of **custom components /
user-defined types being second-class citizens** across `reset`, session
snapshots, and schema introspection. Several **documentation-vs-reality gaps** in
the agent-facing tooling will trip up an agent that follows the scaffold's own
instructions. I also confirmed the flow scales (600 entities → coherent render),
particles/physics/GLB all work headless, and quantified throughput.

**Headline results**

| Area | Result |
|---|---|
| Pack → install → scaffold → typecheck → build (browser) | ✅ Clean, all 12 tarballs, isolated pnpm root |
| Headless boot + step + extract + render bundle | ✅ Works, ~1.85 s boot, ~2,600 steps/s |
| Determinism (`--seed`, `--determinism error`) | ✅ Byte-identical replay; diagnostics correct |
| `headless serve` warm loop + autopilot | ✅ Full read→decide→`input_action_set`→step loop |
| Rapier physics in pure Node | ✅ Gravity, collision, stacking, deterministic |
| GLB strict/hybrid asset decode in Node | ✅ Real geometry; ⚠️ default `placeholder` breaks GLB scenes (F9) |
| MCP stdio agent surface (47 tools) | ✅ Full lifecycle; ⚠️ `app_reset` (F5), `frame_capture` (F7), `input_inject` (F10) |
| Headless vs headed parity | ✅ Identical authoring + rendering; deterministic divergence by design |
| `reset` / `app_reset` for custom-component apps | ❌ **Crashes (F5, HIGH)** |

### Findings at a glance

| # | Sev | Area | One-liner | Root cause |
|---|-----|------|-----------|------------|
| F5 | HIGH | reset | `reset`/`app_reset` crashes for module-scope custom components | **verified** (elics guard) |
| F6 | MED | snapshot | Session restore drops custom components/resources | **verified** (registry missing them) |
| F8 | MED | tooling | `ecs_get_component_schema` misses live custom components | **verified** (empty-query enum) |
| F9 | MED | assets | Default `placeholder` → empty un-renderable bundle for GLB scenes | traced |
| F1 | MED | config | `render.clearColor` is a no-op | traced (unwired) |
| F2 | MED | types | Generated action types don't resolve a factory config | traced (AST parse) |
| F4 | MED | input | One-shot `--inject` silently ignores axis actions | traced |
| F7 | MED | tooling | `frame_capture` shape/dims differ headed vs headless | observed |
| F10 | MED | docs | `input_inject` documented as headless but is headed-only | observed |
| F13 | MED | render | `aperture render` renders fractional viewports all-black | observed |
| F3 | LOW | types | `this.signals.*` never typed; no headless codegen | traced |
| F11 | LOW | errors | Browser config → cryptic `BASE_URL` error | traced |
| F12 | LOW | types | Scaffold tsconfig only checks `src/**` | **verified** |

Wins (W1–W17) are in §4; observations (O1–O12) in §7.

---

## 2. Methodology & environment

I deliberately reproduced the **real npm-consumer path** rather than developing
inside the monorepo:

1. **Built** all packages: `pnpm run build` (tsc project references).
2. **Packed** all 12 code packages to `.tgz` with `pnpm --filter <pkg> pack`
   (`pack-all.mjs`): math, simulation, physics, physics-rapier, render, ui,
   runtime, webgpu, audio, vite-plugin, app, cli.
3. **Scaffolded** with the packed CLI: `aperture create app --template game`
   (later reworked into *Starfall*), plus `create viewer --template glb-viewer`.
4. **Installed from tarballs**: rewrote the app's `package.json` so every
   `@aperture-engine/*` specifier — direct **and transitive** — resolves to a
   `file://` tarball via `pnpm.overrides` (`make-install-pkg.mjs`). Verified the
   full closure came from tarballs (`.pnpm/@aperture-engine+*@file+..+packs+*.tgz`).
5. **Isolated** the sub-directory from the monorepo workspace with a
   `pnpm-workspace.yaml: packages: []` in each project (otherwise pnpm walks up
   to the repo root and installs the whole workspace instead of the tarballs —
   a real gotcha worth knowing when testing packed output inside a repo).

**Environment:** Node v22.22.2, pnpm 10.33.0 (isolated root), vite 8.1.2,
packages @ 0.2.0. GPU-less Linux host → WebGPU via auto-provisioned Xvfb +
SwiftShader Vulkan (`--use-vulkan=swiftshader`), exactly as CI/dev-container
users get. All work lives under `headless-battletest/`.

---

## 3. What I built (to exercise the flow)

- **Starfall** (`app/`, the main subject): a deterministic star-catcher.
  - Custom ECS components (`Star`, `Basket`) via `defineComponent`.
  - Custom resource (`DirectorState`) via `defineResource` for spawn cadence.
  - Deterministic RNG (`context.random`) for spawn timing, x, fall speed, sway,
    hue; deterministic time (`context.time`) for sway.
  - `axis2d` move + `button` magnet input; app signals (score/missed/…).
  - Runtime **spawn and despawn** (stars) via `spawn.mesh` + `hierarchy.despawnRecursive`.
  - Progression: combo/multiplier scoring, a score-derived **level** with a
    difficulty ramp, and a **game-over** state — all developed and verified
    through the headless loop (edit → `tsc` → `serve` → inspect signals), never
    a browser. 5 systems: `setup`/`director`/`fall`/`catch`/`progression`.
- **Physics probe** (`app/phys-src/` + `physics.headless.config.ts`): Rapier
  backend, static floor + 3 dynamic cubes → stacking.
- **Hierarchy probe** (`app/hier-src/` + `hier.headless.config.ts`): parent∘child
  world-transform composition + recursive subtree despawn.
- **Particle probe** (`app/fx-src/` + `fx.headless.config.ts`): inline
  `asset.particleEffect` + `particles.emit`.
- **Scale probe** (`app/scale-src/` + `scale.headless.config.ts`): 600 entities.
- **glb-viewer** (`viewer/`): the shipped template, to test GLB asset loading.

Everything typechecks (`tsc --noEmit`, `exactOptionalPropertyTypes`,
`noUncheckedIndexedAccess`) and the browser bundle builds (`vite build`, 822
modules).

---

## 4. What works well (validated wins)

- **W1 — Determinism is real.** Two `--seed 1` Starfall runs are **byte-identical**
  (digest `1afb1fe2`); `--seed 2` diverges (`20531f53`); `--determinism error`
  exits 1 on `Math.random`/`Date.now` use and 0 otherwise. Custom elics
  components auto-register through queries/`addComponent` with zero boilerplate.
- **W2 — `headless serve` inner loop.** An autopilot over stdin NDJSON
  (`get-status → input_action_set → step`, ×120) beat passive play from the same
  seed: **score 8/missed 3** (steering) vs **5/5** (idle), basket driven to
  x=2.81. This is the exact loop an agent uses to develop/tune a game.
- **W3 — Per-camera `clearColor` is honored** by headless render (dark-blue
  Starfall background), and the rendered frame matches the live browser frame.
- **W4 — Determinism diagnostics** detect nondeterministic globals with precise,
  actionable messages.
- **W5 — MCP stdio surface** speaks MCP `2025-06-18`, advertises **47 tools**,
  and drives the full headless lifecycle (start/status/step/find/capture/stop).
- **W6 — Rapier physics runs in pure Node**, deterministically: 3 cubes fall and
  **stack** (y ≈ 0.5 / 1.5 / 2.5) with correct collision resolution; two runs
  byte-identical (`136be813`); renders correctly.
- **W7 — Throughput:** ~1.85 s fixed boot, then **~2,600 Starfall steps/s** and
  **~2,070 physics steps/s** (excluding boot). Fast enough for tight iteration;
  the boot cost is why `serve` exists.
- **W8 — Strict/hybrid asset decode in Node** across formats: GLB glTF
  (8-vert/36-index cube → real mesh+material closure), WAV audio, and PNG
  textures all decode with real bytes (`placeholderCount:0`).
- **W9 — Hierarchy** parent∘child world composition is exact; `despawnRecursive`
  tears down a subtree (`despawned:4`).
- **W10 — Particles emit headless** with correct `{count, position}` options and
  a config-declared inline `asset.particleEffect(...)`; no crash. Facades are
  strongly typed inside `src/`.
- **W11 — Scale:** 600 entities → all 600 draws extracted and rendered to a
  coherent grid (`artifacts/scale.png`); 300 frames in 4.8 s.
- **W12 — Audio + RNG fork + multi-view:** strict WAV decode in Node +
  `playOneShot` (no device); independent deterministic `random.fork()` streams;
  2-camera extraction yields 2 views (rendering them is F13).
- **W13 — Kinematic character controller:** a capsule walks into a wall and
  stops at x=2.34 (expected ~2.35) via `moveCharacter`+`setKinematicTarget` in
  `fixedUpdate` — Rapier collision resolution + snap-to-ground in pure Node.
- **W14 — Release gates pass:** `check:headless-boundaries` (11 files, no
  browser/WebGPU imports in headless paths), `check:render-bundles`, and
  `check:pack-cli` (the pack→install→headless smoke I did by hand) all green —
  the flow is genuinely CI-gated.
- **W15 — Deterministic replay + entry-point equivalence:** a timed `--inject`
  file is a reproducible input recording (replay changed the sim and two replays
  are byte-identical); one-shot `--frames 90` and `serve` stepping 90 produce
  byte-identical `snapshot.value` (`snapshotDigest 0f4c82b2`).
- **W16 — Robust errors & input resilience:** 600-entity replay byte-identical;
  missing/HTTP assets fail with clear, actionable messages; a system throwing in
  `update()` aborts with an attributed error; `serve` survives malformed NDJSON
  (bad line → error, session continues).
- **W17 — Headless is a real dev environment:** extended Starfall with combo/
  multiplier, a difficulty-ramped level, and game-over — all built via
  edit→`tsc`→`serve`→inspect, no browser. Autoplay reached score 31 / combo 9 /
  level 4; passive hit game-over at tick 187. Determinism preserved.

Rendered proof frames: `artifacts/starfall_f150.png` (game), `physics.png`
(stack), `viewer_strict.png` (GLB), `compare_headed.png` vs `compare_headless.png`
(parity).

---

## 5. Findings (ranked)

Severity: **HIGH** = breaks a documented core workflow; **MEDIUM** = wrong/
misleading behavior or a real DX trap with a workaround; **LOW** = papercut.

*Prior art:* checked against `docs/proposals/headless-*`. Most findings are new;
F9 is adjacent to the known "placeholder-asset honesty" gap (but the "0 mesh
draws → `emptySnapshot`" case is undocumented), and F6 lands in the acknowledged
"session snapshots are v1" area (with a specific, verified root cause here). F5,
F7, F8, F10, F11, F12, F13 are not tracked in those proposals.

### F5 — HIGH — `reset` / `app_reset` crashes for any app with module-scope custom components
Booting the headless runner a second time in one process (what `serve`'s `reset`
and the MCP `app_reset` do) with a module-singleton `defineComponent` crashes on
the next entity-summary read: `Cannot read properties of null (reading 'id')` at
`dist/entities/lookup/summary.js:224` (`entityHasComponentId`). Isolated with an
in-process double-boot repro (`app/repro-reset.mjs`); no crash without a custom
component. **Confirmed on the MCP surface:** `app_reset` returns JSON-RPC
`-32000` and leaves the session unusable — and the scaffold's own `CLAUDE.md`
tells agents to "Use `app_reset` for rebuild/reset", so this breaks the
recommended loop for the common case.

**Root cause (traced + verified):** elics `Entity.addComponent`
(`elics@3.4.2/lib/entity.js:20`) re-registers a component only when
`component.bitmask === null`. A module-singleton `defineComponent` keeps a
non-null `bitmask`/`typeId` from world #1, so on world #2 `addComponent` **skips**
re-registration and OR's the stale world-1 typeId bit into the new entity's
bitmask; that typeId then resolves to `null` on world #2's component manager.
App components escape this because `registerApertureAppComponents` explicitly
re-registers them (fresh bitmask) each boot.

**Verified one-line fix:** change the guard to consult the current world —
`if (!this.componentManager.hasComponent(component))`. I patched the app's elics
copy and the double-boot repro went from CRASH to "boot2 (reset) ok … no crash";
reverting restores the crash. *Aperture fix path: upstream the elics guard fix +
bump, or reset user components' `typeId`/`bitmask` in the `reset`/`bootRunner`
path.*

**Parity:** `app_reset` on the **headed** slot (same app) returns `ok:true` and
keeps running — the browser reloads the page (fresh JS realm), so F5 is specific
to the **headless in-process reboot**, matching the root cause exactly.

### F9 — MEDIUM — default `--asset-mode placeholder` yields an empty, un-renderable bundle for GLB-only scenes
The shipped `glb-viewer` template, run through the documented default path,
produces `meshDraws: 0` in `placeholder` mode (a placeholder gltf has no
geometry). `aperture render --allow-placeholders` then fails with
`webGpuApp.emptySnapshot: requires at least one view and one mesh draw`.
`--asset-mode hybrid`/`strict` fix it. The `aperture headless` CLI defaults to
`placeholder` while the scaffold's CLAUDE.md uses `hybrid` — an inconsistent
default that breaks GLB apps out of the box. *Fix: default GLB placeholders to a
visible stub, or emit a "0 mesh draws — use --asset-mode hybrid/strict"
diagnostic, and/or default the CLI to `hybrid`.*

### F1 — MEDIUM — `render.clearColor` config field is a no-op
`ApertureRenderDefaults.clearColor` (config/index.ts:387) is **never read**
anywhere; the `game` template ships `render.clearColor: [0.08,0.12,0.16,1]`, but
both browser and headless render black. The working path is per-camera
`spawn.camera({ camera: { clearColor } })`. *Fix: wire it into
`installRenderDefaults` + browser clear, or remove the dead knob from the type
and template.*

### F2 — MEDIUM — generated action types don't resolve a factory/shared config
`.aperture/generated/aperture-env.d.ts` (the only thing that strongly types
`this.actions.*`) is produced by **AST-parsing** `aperture.config.ts` for a
literal `input.actions`. The scaffold's own pattern defines input in a
`createApertureAppConfig()` factory in `aperture.shared-config.ts`, which the
parser can't see through → an **empty** action map (verified: 0 actions for a
config with 3). `this.actions.*` falls back to the loose index type. *Fix:
evaluate the config through the module loader instead of shallow AST parsing.*

### F4 — MEDIUM — one-shot `aperture headless --inject` silently ignores axis/analog actions
`--inject {actions:{magnet:true}}` (button) and pointer work; `{actions:{move:true}}`
(axis2d) is accepted with **no warning and no effect** (basketX stays 0), while
the equivalent validation path throws a helpful "use input_action_set" error.
Axis actions can only be driven via `serve`/`input_action_set`. *Fix: warn (or
error) when a non-button action is injected one-shot, matching the other path.*

### F6 — MEDIUM — session snapshot restore silently drops custom components & resources
`snapshot` + `restore` on Starfall returns `{ok:true, result:{ok:false, …}}`:
`aperture.serialization.unregisteredComponent` for `starfall.star`/`starfall.basket`
(skipped) and resource `starfall.director` `missing`. Restored entities lose all
custom-component state; signals/RNG/fixed-clock restore fine. **Isolated:** a
standard-component scene (hier) restores cleanly, so the machinery is sound.
**Root cause (verified by instrumentation):** the decode registry
`componentRegistryFromWorld(restoreWorld)` returns **50 components at save
(incl. both custom ones) but only 48 at restore** — the user components are
absent from the restore world (they're only ever registered by system
queries/`addComponent` at runtime, which restore doesn't reproduce before
`loadScene`), and `componentRegistryFromWorld` also breaks at the first null
typeId. Secondary bug: the failed restore is wrapped in a top-level `ok:true`.
*Fix: register the app's declared components at restore (the manifest already
stores `componentRegistry.ids`) and make the registry scan skip null typeIds.*

### F7 — MEDIUM — `frame_capture` return shape & dimensions differ between targets
Same tool, same args `{width:480,height:320}`: **headed** returns an inline MCP
`image` (live canvas 960×640, requested dims **ignored**, no metadata);
**headless** returns a `text` block (`source:render-bundle`, dims **honored**
480×320, `pngPath`, no inline image). An agent must branch on target to read the
result of the public "get a picture" tool. *Fix: normalize the envelope (always
image + metadata) and honor width/height for headed.*

### F8 — MEDIUM — `ecs_get_component_schema` can't see a live custom component
With 2 live `star.*` entities, the schema catalog lists app components +
`starfall.basket` but **omits `starfall.star`** (`componentSchemaNotFound`),
even though those entities report `starfall.star` in `componentIds` and match
`ecs_query {withComponents}`. Three tools disagree about the same component.
**Root cause (verified by instrumentation):** the catalog scans
`registerQuery({required:[]}).entities`, which held only **5** entities
(indices 0-4, init-spawned) vs `indexLookup`'s **7** — the runtime-spawned stars
(5-6) are absent because an empty-required elics query doesn't pick up entities
spawned after it was registered. So `basket` (init) is found and `star`
(runtime) is missed. *Fix: enumerate via `collectActiveEntities(world)` (which
prefers `entityManager.indexLookup`), the same helper `findApertureEntities`
uses.*

### F10 — MEDIUM — `input_inject` is documented as a shared headless tool but is headed-only
`input_inject` against a headless session → `aperture.headless.toolUnavailable`.
Yet `AI_TOOLING.md` and the scaffold's generated `CLAUDE.md` both list it in the
headless loop, and MCP advertises it. The real headless path is
`input_action_set`. An agent following the scaffold hits a wall on step 1. *Fix:
implement it for headless, or correct the docs/CLAUDE.md.*

### F12 — LOW-MEDIUM — scaffold `tsconfig` only typechecks `src/**`; systems elsewhere are silently unchecked
The scaffold `tsconfig` `include` is `["…configs…", "src/**/*.ts", ".aperture/generated"]`.
Systems placed outside `src/` (I used `phys-src/`, `hier-src/`, `fx-src/` for
isolated probes) are loaded and run by the headless CLI (which globs from the
config's `systems` field) but are **excluded from `tsc --noEmit`**. Because the
headless config-loader strips types (no check) and the docs rely on "run `tsc`
alongside", a non-`src` layout gets **silent zero type coverage** with a green
`typecheck`. Proven: an invalid-options probe under `fx-src/` passed `typecheck`;
the identical probe under `src/systems/` produced 3 `error TS…` (the facades ARE
precisely typed — the file was simply never checked). *Fix: broaden the scaffold
`include` to match the config's `systems` glob, and/or have `aperture headless`
optionally type-check.*

### F13 — MEDIUM — `aperture render` renders cameras with a fractional `viewport` fully black
Extraction is correct (two cameras with `viewport:[0,0,0.5,1]`/`[0.5,0,0.5,1]`
→ 2 views with the right rects), but `aperture render` returns
`aperture.render.blankFrame`; `--allow-blank` writes an **all-black** PNG. A
single camera with a fractional viewport is also black, while the default full
`[0,0,1,1]` renders. So the render harness doesn't honor viewport rects —
split-screen/PiP/minimap layouts are un-renderable via the headless render path,
and the blank-guard message misattributes the cause. *Fix: honor
`view.viewport`/`scissor` in the harness, or document the single-full-view
limitation.*

### F3 — LOW — `this.signals.*` is never strongly typed; no headless type-regen
`SignalStore = Record<string, Signal<unknown>>` and nothing generates per-signal
types, so under `noUncheckedIndexedAccess` every signal read needs
`Number(x?.value ?? 0)` and every write an `!== undefined` guard. And
`.aperture/generated` is only refreshed by a **vite** build — a pure headless
workflow (`aperture headless`/`serve` + `tsc`) never regenerates it; there's no
`aperture codegen`. *Fix: generate typed signals; add a headless codegen command.*

### F11 — LOW — browser config in `aperture headless` → cryptic `BASE_URL` error
`aperture headless aperture.config.ts` fails with `Cannot read properties of
undefined (reading 'BASE_URL')` (the browser config reads `import.meta.env`,
undefined in the SSR loader, thrown before the mode check). *Fix: detect and
emit an "expected mode: 'headless'" diagnostic.*

---

## 6. Headless vs headed comparison

Driven through **one MCP server** talking to both slots (the live
`aperture dev up --software` browser + a `app_start` headless slot).

| Dimension | Headless (pure Node) | Headed (browser + SwiftShader WebGPU) | Verdict |
|---|---|---|---|
| Authored scene | `[basket, camera.main, floor, light.fill, light.key]` + 4 systems | **identical** | ✅ parity |
| Rendered frame | render-bundle PNG (blue bg, floor, basket, hued stars) | live-canvas PNG, **visually indistinguishable** | ✅ parity |
| Time model | fixed `delta`, deterministic, seedable | real-time rAF, variable delta | ⚠️ divergence **by design** |
| Reproducibility | byte-identical from seed | not reproducible (real-time) | as documented |
| Boot cost | ~1.85 s | seconds (Vite + browser + CDP) | headless much cheaper |
| `ecs_*`, `resource_get`, `camera_*` | ✅ | ✅ | ✅ parity |
| `frame_capture` | text + pngPath, honors dims | inline image, live canvas dims | ⚠️ F7 |
| `input_inject` | ❌ unavailable (F10) | ✅ | ⚠️ gap |
| `app_reset` | ❌ crash w/ custom comps (F5) | ✅ ok (page reload) | ⚠️ F5 headless-only |
| `logs_read` | diagnostic entries | log files | ⚠️ O3 shape differs |

**Takeaway:** the engine's central thesis — "simulation is authoritative,
rendering is a derived view" — holds: the *authored simulation* and the *rendered
picture* are the same across backends; the only intended difference is the
time-stepping model (deterministic fixed-step vs real-time). The right workflow
really is "iterate headless, smoke-test headed," and it works — with the tooling
parity gaps above (F7/F10/F5, O3) being the main rough edges.

---

## 7. Observations & DX notes

- **O1 — Headless draw counts are view-dependent.** Extraction frustum-culls, so
  `meshDraws`/`bounds` reflect what's visible, not what's authored (Starfall's
  finish flag was culled when off-camera). The render preflight's placeholder
  gate is likewise view-dependent (a culled placeholder doesn't block). Agents
  counting objects should use `ecs_*`, not snapshot draws. Worth a doc note.
- **O2 — `ecs_set_component_field` can't mutate user components** (hardcoded
  allowlist, by design) — inspect-only for custom components from tooling.
- **O3 — `logs_read` shape differs** by target (entries vs files).
- **O4 — Rapier prints a deprecation warning** to stderr on every physics boot.
- **O5 — The template `sample-cube.glb` has no normals** (POSITION-only) → renders
  flat/unshaded under the lit material. Poor sample asset.
- **O6 — Two entity-ref currencies:** `serializeEntityRef` (string, used by
  `physics.moveCharacter` per docs) vs `{index,generation}` (hierarchy/lookup).
  Not interchangeable; mixing them yields `invalidRef` (diagnosed, not silent).
- **O7 — `--frames -3` reports "requires a value"** (negative numbers look like
  flags).
- **O8 — Missing required particle-emit option → cryptic `undefined[0]`** at
  `particle-burst-queue.js:209` (no argument validation).
- **O9 — Entity summaries truncate at 50** (`truncated:true`); inspect large
  scenes via `ecs_find_entities` filters/`limit`.
- **O10 — Render bundle grows ~linearly** (~4.7 KB/entity → 2.84 MB for 600); a
  10k-entity scene ≈ 47 MB. Marginal step rate ~101/s at 600 entities.
- **O11 — The full bundle `digest` covers provenance** (`createdBy`), so
  identical content from different tools (one-shot vs serve) has different
  top-level digests; use `snapshotDigest` for content comparison. Both digest
  fields are objects `{algorithm,hash,byteLength}` — compare `.hash`.
- **O12 — Misleading error tail:** system-exception messages end with "the
  original stack is preserved below", but the CLI prints only the message — no
  stack follows on stderr.

---

## 8. Recommendations (prioritized)

1. **Fix F5 (HIGH).** Make user components survive runner re-boot, or the whole
   `reset`/`app_reset` inner loop is unusable for real (custom-component) apps.
   This is the single most impactful fix.
2. **Address the "custom types are second-class" cluster (F5/F6/F8).** All three
   trace to user components being registered only lazily (via system
   queries/`addComponent`) and not surviving world re-creation or alternate
   enumeration. Concretely: (F5) fix the elics `addComponent` guard / reset
   component identity; (F6) register the app's declared components at restore and
   make `componentRegistryFromWorld` skip null typeIds instead of breaking; (F8)
   enumerate the schema catalog via `collectActiveEntities`. Each has a verified
   root cause and a concrete fix in this report.
3. **Fix the GLB default (F9)** so the shipped `glb-viewer` renders on its
   documented default path (stub geometry or a clearer diagnostic / `hybrid`
   default).
4. **Close the documented-tool gaps (F10, F2, F1).** Agents follow the scaffold's
   CLAUDE.md and the config typing verbatim; `input_inject` unavailability, empty
   generated action types, and the dead `clearColor` knob all violate that
   contract.
5. **Normalize the agent tool envelope (F7, O3).** `frame_capture` and
   `logs_read` should return the same shape regardless of slot — the whole point
   of the "shared intent-level tools" design.
6. **Papercuts:** F4 (warn on axis inject), F11 (config-mode diagnostic), F3
   (typed signals + `aperture codegen`), O4/O5/O7.

---

## 9. Appendix — reproduce

All scripts are in `headless-battletest/`. From `headless-battletest/`:

```sh
node pack-all.mjs > tarballs.json                 # build 12 tarballs
node make-install-pkg.mjs app app                 # rewrite app/package.json → tarballs
(cd app && pnpm install && pnpm run typecheck)

# headless one-shot + render
(cd app && pnpm exec aperture headless aperture.headless.config.ts --out ../artifacts/s.json --frames 300 --seed 1 --json)
(cd app && pnpm exec aperture render ../artifacts/s.json --out ../artifacts/s.png --allow-placeholders)

node serve-play.mjs      # W2 autopilot vs passive
node serve-tools.mjs     # serve tool surface
node mcp-smoke.mjs        # MCP lifecycle (47 tools)
node mcp-compare.mjs      # headed vs headless parity (needs `aperture dev up --software`)
node mcp-sweep.mjs        # broad MCP tool coverage
(cd app && node repro-reset.mjs)   # F5 crash repro
```

Key artifacts: `FINDINGS.md` (raw chronological journal with every command and
output), `artifacts/*.png` (proof frames), `artifacts/*.bundle.json` (render
bundles), `artifacts/*.session.json` (session snapshots).

---

## 10. Bottom line

The headless flow delivers on its core promise. I packed the engine to tarballs,
installed them like an npm user, and built a real, deterministic game entirely in
pure Node — RNG-driven spawning, runtime spawn/despawn, custom components,
combo/level/game-over progression, Rapier dynamic + kinematic physics, hierarchy,
GLB/audio/texture assets, and multi-view extraction all work and replay
bit-identically. `serve` gives a fast warm inner loop; `aperture render` turns
bundles into pixels via SwiftShader WebGPU; the MCP surface exposes 47 tools; and
headless↔headed authoring and rendering parity is excellent. The release gates
pass.

The rough edges cluster in one place: **user-defined types (custom `defineComponent`/
`defineResource`) are second-class across the runner-re-creation and
alternate-enumeration paths** — F5 (reset crash, HIGH), F6 (snapshot restore), and
F8 (schema introspection), each with a verified root cause and concrete fix here.
Fixing that cluster plus the GLB default (F9) and the documented-tool gaps
(F10/F2/F1) would make the headless-first, simulation-authoritative workflow the
scaffold advertises hold end-to-end for real apps — which, custom types aside, it
already nearly does.
