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

That said, battle-testing surfaced **15 findings and 15 observations**, including
**two HIGH-severity bugs**, each root-caused and each with a verified fix: (1) a
**crash** on `reset`/`app_reset` for custom-component apps (traced to a single
elics guard), and (2) **skeletal GLB animation silently frozen at bind pose**
for any model at uniform scale ≤ 0.01 (F15 — traced to a mat4 singularity
epsilon in shared runtime math, so it hits the headed browser too, not just
headless). There is also a cluster of **custom components / user-defined types
being second-class citizens** across `reset`, session snapshots, and schema
introspection, and several **documentation-vs-reality gaps** in the agent-facing
tooling that will trip up an agent that follows the scaffold's own instructions.
I also confirmed the flow scales (600 entities → coherent render),
particles/physics/GLB/skeletal-rig all decode and step headless, and quantified
throughput.

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
| Skeletal GLB animation (rigged mesh + clips) | ⚠️ Sim animates; **render frozen at bind pose for scale ≤ 0.01 (F15, HIGH, shared)** |
| `reset` / `app_reset` for custom-component apps | ❌ **Crashes (F5, HIGH)** |

### Findings at a glance

| # | Sev | Area | One-liner | Root cause |
|---|-----|------|-----------|------------|
| F5 | HIGH | reset | `reset`/`app_reset` crashes for module-scope custom components | **verified** (elics guard) |
| F15 | HIGH | animation | Skinned GLB animation frozen at bind pose for uniform scale ≤ 0.01 | **verified** (mat4 singularity epsilon) |
| F6 | MED | snapshot | Session restore drops custom components/resources | **verified** (registry missing them) |
| F8 | MED | tooling | `ecs_get_component_schema` misses live custom components | **verified** (empty-query enum) |
| F9 | MED | assets | Default `placeholder` → empty un-renderable bundle for GLB scenes | traced |
| F1 | MED | config | `render.clearColor` is a no-op | traced (unwired) |
| F2 | MED | types | Generated action types don't resolve a factory config | traced (AST parse) |
| F4 | MED | input | One-shot `--inject` silently ignores axis actions | traced |
| F7 | MED | tooling | `frame_capture` shape/dims differ headed vs headless | observed |
| F10 | MED | docs | `input_inject` documented as headless but is headed-only | observed |
| F13 | MED | render | `aperture render` renders fractional viewports all-black | observed |
| F14 | MED | render | `aperture render` omits post-effects (bloom/exposure); bundle lacks render config | traced |
| F3 | LOW | types | `this.signals.*` never typed; no headless codegen | traced |
| F11 | LOW | errors | Browser config → cryptic `BASE_URL` error | traced |
| F12 | LOW | types | Scaffold tsconfig only checks `src/**` | **verified** |

Wins (W1–W25) are in §4; observations (O1–O15) in §7.

**Coverage exercised:** CLI — `create` (minimal/game/glb-viewer), `headless`
(all flags: frames/delta/seed/inject/asset-mode/determinism/render-dims/json/
public-dir), `headless serve` (step/extract/inject/tool/bundle/snapshot/restore/
reset/determinism/command/shutdown + malformed-input resilience), `render` (dims/
allow-blank/allow-placeholders/json/preflight), `tool`, `mcp stdio` (47 tools),
`dev up/status/down` (headed, software WebGPU), `adapter sync`, `reference
warmup/status/search`. Subsystems — ECS + custom components/resources, RNG
(+fork)/time determinism, input (axis/button/pointer/replay), physics (dynamic +
kinematic character), hierarchy, assets (GLB/WAV/PNG strict), particles, audio,
shadows, fog, procedural sky, custom WGSL materials, spatial raycast/overlap,
multi-view, scale (600 entities), skeletal animation (49-joint rigged GLB +
clip playback). Comparison —
headed vs headless authoring/render/tool parity.

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
- **W18 — Shadow mapping headless→render:** a directional light with `shadow:true`
  extracts `shadowRequests` and `aperture render` produces a correct cast shadow
  with PBR shading (`artifacts/shadow.png`).
- **W19 — Fog + procedural sky** render correctly headless→render (distance-fade
  fog + gradient sky, `artifacts/sky.png`).
- **W20 — RAG reference tooling:** `aperture reference warmup` fetched the corpus
  + embeddings model (758 entries); semantic `search` and all 8 granular MCP
  `reference_*` tools return relevant, ranked results.
- **W21 — All 3 scaffold templates** (minimal/game/glb-viewer) scaffold → install
  from tarballs → typecheck → headless → render cleanly.
- **W22 — Custom WGSL materials** (recipe verified): strict WGSL asset decode in
  Node + `material.customWgsl` extracts a custom pipeline family; `aperture render`
  compiles+runs the shader through WebGPU with the exact UV-gradient (`wgsl.png`).
- **W23 — Spatial queries** (recipe verified): `spatial.raycastFirst` picks the
  right cube via the auto-populated mesh BVH; `overlapSphere` finds the in-range
  mesh — line-of-sight/picking/AoE work in pure Node.
- **W24 — Skeletal rig decode + animation *simulation* work headless.** A
  49-joint rigged `Soldier.glb` decodes in strict mode (2 meshes, 3 materials, 2
  textures, 4 clips); `spawn.animation().clipIds` enumerates the clips;
  `playClip` drives the mixer, which advances and writes all 156 joint channels
  into joint `LocalTransform`s every step (verified by instrumentation). The
  *animated pose is not visible in the render*, but only because of F15's
  palette-inversion bug — the ECS/animation half is solid in pure Node.
- **W25 — Instanced GLB (`spawn.gltfBatch`) works headless→render.** One
  `gltfBatch` call with 16 per-instance transforms returns 16 roots, extracts 16
  independent mesh draws (+16 bounds), and `aperture render` produces a 4×4 grid
  of the textured blaster at distinct positions/yaws (`artifacts/batch_grid.png`);
  two runs byte-identical (`1821ed3e`). Per-instance transform overrides apply.
- **Also:** determinism holds under different `--delta`, across 5 seeds, in
  parallel (4 concurrent runs byte-identical to serial), and over 10k frames
  (bounded, no leak); physics restitution bounces with correct energy loss.

Rendered proof frames: `artifacts/starfall_f150.png` (game), `physics.png`
(stack), `viewer_strict.png` (GLB), `compare_headed.png` vs `compare_headless.png`
(parity), `anim_compare.png` (F15 skinned-animation before/after).

---

## 5. Findings (ranked)

Severity: **HIGH** = breaks a documented core workflow; **MEDIUM** = wrong/
misleading behavior or a real DX trap with a workaround; **LOW** = papercut.

*Prior art:* checked against `docs/proposals/headless-*`. Most findings are new;
F9 is adjacent to the known "placeholder-asset honesty" gap (but the "0 mesh
draws → `emptySnapshot`" case is undocumented), and F6 lands in the acknowledged
"session snapshots are v1" area (with a specific, verified root cause here). The
rest (F1–F5, F7, F8, F10–F15) are not tracked in those proposals; F15 (skinned
animation frozen for small-scale rigs) is a shared-runtime math bug I have not
seen documented anywhere.

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

### F15 — HIGH — skinned GLB animation is silently frozen at bind pose for any model at uniform scale ≤ 0.01
A rigged `Soldier.glb` (49 joints, 4 clips: `Idle`/`Run`/`TPose`/`Walk`) loads
cleanly headless (`mesh:2, material:3, texture:2, animation-clip:4`),
`spawn.animation(root).clipIds` enumerates all four, and `playClip("Idle")` sets
`activeClipId`. But `aperture render` of the bundle at frame 10 vs frame 45 is
**byte-identical** and shows the model **stuck in its bind (T-)pose** — the
animation never appears in the picture.

**Root cause (traced + verified, three layers deep):**
1. The animation mixer is *correct*. Instrumenting the engine's
   `updateAnimationDrivers` shows it advancing every headless step
   (`active=Idle`, `time` ticks 0.0166→0.0333→…) and writing **all 156 joint
   channels** into the joints' `LocalTransform`s (`hit=156, miss=0`). Resolved
   joint **world** transforms drift correctly frame-to-frame.
2. `updateSkeletonPalettes` (runtime) rebuilds each skin palette as
   `inverse(meshWorld) · jointWorld · inverseBind`. It calls
   `invertMat4(meshWorld)` — and **Soldier.glb is authored at a uniform 0.01
   scale**, so its mesh-entity world matrix has determinant `0.01³ = 1e-6`.
3. `invertMat4` (`@aperture-engine/math/matrix.ts`) rejects a matrix as singular
   when `Math.abs(determinant) <= EPSILON`, and `EPSILON = 1e-6`. The 0.01-scale
   determinant lands **exactly on the boundary** (`1e-6 <= 1e-6` → true), so
   `invertMat4` returns `null`, and the palette loop falls into its degenerate
   branch and writes an **identity block for every joint**. The palette is thus a
   constant (bind pose) every frame — I confirmed the palette hash is bit-identical
   across frames 5/40/80 while the joint worlds underneath are visibly changing.

A **scale sweep with the shipped engine** (no patching) pins the boundary exactly
at `det = EPSILON`:

| uniform scale | det(meshWorld) = scale³ | skin palette f5→f45 | result |
|---|---|---|---|
| 0.005 | 1.25e-7 | 0 elems change | **FROZEN** |
| **0.01** (authored) | **1.00e-6** (= EPSILON) | 0 elems change | **FROZEN** |
| 0.0101 | 1.03e-6 | 612 elems change | animates |
| 0.02 | 8.0e-6 | 612 elems change | animates |
| 1.0 | 1.0 | 588 elems change | animates |

**Contrast — the bug is skinning-specific, not an animation bug.** I hand-built a
minimal glTF with **node/TRS** animation (a cube spinning about Y) authored at the
same **0.01 node scale** (`det = 1e-6`, the freezing boundary). It animates fine
headless→render (`nodeanim_spincube.png`; frame 5 ≠ frame 20; world transform
changes each frame). Node animation shares the exact same `updateAnimationDrivers`
path but never calls `invertMat4(meshWorld)` — only the *skin*-palette derivation
does — so it is unaffected. This isolates F15 precisely to the skinning-palette
inversion.

The animation *simulation* is perfect; only the *skin-palette derivation* drops
it, and only because a perfectly well-conditioned matrix (its inverse is just
scale-100) is misclassified as singular. Any uniform scale ≤ 0.01 triggers it
(`det = s³`), and cm-/mm-authored GLBs (Blender/Maya/Mixamo defaults) routinely
land there — Soldier.glb is a stock three.js sample. It is also **not
headless-specific**: `updateSkeletonPalettes` + `invertMat4` are shared runtime
math, so the same frozen palette is computed in any runtime `step()`, headed or
headless (unlike F5, which is headless-only). And the renderer's skin extraction
(`readSkinning`, render pkg) reads `Skin.jointMatrices` **by reference** — it
never recomputes skinning from joint worlds — so the live headed GPU path
consumes the identical frozen palette; there is no path that recovers the pose
downstream. I surfaced it via the headless→render path, the natural place it
shows up when battle-testing headless.

**Verified fix (two independent confirmations):** (a) lowering `EPSILON` to
`1e-12` in the packed math copy makes the *unchanged* 0.01-scale soldier animate
(palette hash now varies every frame; render frame10 ≠ frame45); (b) scaling the
model up so `det(meshWorld) > 1e-6` (e.g. `scale:[100,100,100]`) also restores
animation with the shipped engine. `artifacts/anim_compare.png` shows the same
bundle/frame before (frozen T-pose, also mis-scaled) and after (live `Idle`
pose). *Aperture fix path: the singularity test in `invertMat4` is far too
coarse — a 1e-6 determinant is not singular. Use a much smaller absolute epsilon
(≈1e-12) or a scale-relative/condition-number test; and/or make
`updateSkeletonPalettes` compute the mesh inverse without the epsilon gate (fall
back to identity only on a true non-finite result) so small-scale rigs skin
correctly.* Workaround today: author/spawn skinned models at a scale whose
world-matrix determinant exceeds 1e-6 (uniform scale > 0.01).

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
(runtime) is missed. **Verified fix:** patching the scan to enumerate via
`entityManager.indexLookup` (as `collectActiveEntities`/`findApertureEntities`
do) makes `starfall.star`'s schema resolve (was missed).

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

### F14 — MEDIUM — `aperture render` omits app-level post-effects; the bundle doesn't capture render config
A config with `render:{bloom:true, exposure:1.2}` + a bright emissive sphere
renders as a **hard-clamped white disc with no bloom halo** (`artifacts/bloom.png`);
the bundle has no `bloom`/`exposure`/`postEffect`/`tonemap` keys. Generalizes F1:
the bundle carries the `RenderSnapshot` (geometry/lighting/camera view) but not
app-level render/post-processing config, so `aperture render` and headless
`frame_capture` are geometry/lighting previews without post-effects — not
final-look-accurate. *Fix: carry render/post config in the bundle (or sidecar)
and apply it, or document the preview limitation.*

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
| Skinned animation (scale ≤ 0.01 rig) | ❌ frozen bind pose (F15) | ❌ frozen bind pose (F15) | ⚠️ **shared** runtime bug (not a parity gap) |
| `logs_read` | diagnostic entries | log files (also unavailable in headless serve) | ⚠️ O3 shape differs |

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
- **O13 — Restore fidelity needs snapshot-aware systems.** Even a cleanly-
  restoring standard-component app diverges after restore if a system holds
  state in a private field without `snapshotState()`/`restoreState()` (verified:
  the hier despawn didn't fire post-restore until I added them). And even fully
  snapshot-aware, restore reassigns entity indices, so the `snapshotDigest` isn't
  bit-identical (semantic state is). `restore.ok:true` gives false confidence.
- **O14 — `aperture render` cost is boot-dominated (~4 s floor), ~flat in scene
  size.** Measured wall-time: 1 mesh ≈ 5.3 s, 16 meshes ≈ 4.2 s, 600 meshes ≈
  4.2 s — rasterizing 600 draws costs the same as 16, so the Chrome + Xvfb +
  SwiftShader-Vulkan boot dominates, not the GPU work (bundle/asset size matters
  more than draw count — the skinned 2.1 MB soldier bundle is the slowest). So in
  the headless→render loop, the *step* is cheap (~2,600/s, W7) but each *render*
  is a fixed ~4–5 s tax. Iterate on simulation state headlessly and render
  sparingly; a warm render slot (à la `serve` for stepping) would remove the
  biggest per-frame cost when many frames are needed. Confirmed at the source:
  `renderBundleToPng` (`render/driver.ts`, shared by the CLI `render` command
  **and** the MCP `frame_capture`/`render_bundle` tools) `chromium.launch()`es a
  fresh browser + provisions Xvfb on every call and closes them in `finally` —
  there is no browser reuse, so each on-demand capture pays the full boot.
- **O15 — the Node glTF loader rejects data-URI buffers.** A spec-valid `.gltf`
  with an embedded `buffers[].uri = data:application/octet-stream;base64,…` fails
  strict load with "this loader currently expects same-origin external buffer
  files … bytes were not provided for POSITION/INDICES." An external `.bin`
  sidecar (or `.glb`) works. Data-URI buffers are common exporter output and are
  valid glTF 2.0, so an author embedding buffers inline hits an avoidable wall;
  the message is at least clear and suggests `--asset-mode hybrid`. (Found while
  building the F15 node-animation contrast asset.)

---

## 8. Recommendations (prioritized)

1. **Fix F5 (HIGH).** Make user components survive runner re-boot, or the whole
   `reset`/`app_reset` inner loop is unusable for real (custom-component) apps.
   This is the single most impactful fix.
1b. **Fix F15 (HIGH).** Loosen the `invertMat4` singularity epsilon (1e-6 is far
   too coarse — it rejects any rig at uniform scale ≤ 0.01, silently freezing
   all skinned animation at bind pose) and/or drop the epsilon gate in
   `updateSkeletonPalettes`. This is a shared-runtime fix that also fixes the
   headed browser, and it's the difference between "skeletal animation works" and
   "skeletal animation silently does nothing" for a huge class of stock GLBs.
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

Two HIGH-severity bugs stand out. The first is a cluster: **user-defined types
(custom `defineComponent`/`defineResource`) are second-class across the
runner-re-creation and alternate-enumeration paths** — F5 (reset crash), F6
(snapshot restore), and F8 (schema introspection), each with a verified root
cause and concrete fix here. The second is independent and, if anything, more
surprising: **F15 — skinned GLB animation is silently frozen at bind pose for any
model at uniform scale ≤ 0.01**, because a 1e-6-determinant matrix is
misclassified as singular by the skinning-palette compute; the sim animates
perfectly, only the render is frozen, and because it lives in shared runtime math
it hits the headed browser too. Fixing those two, plus the GLB default (F9) and
the documented-tool gaps (F10/F2/F1), would make the headless-first,
simulation-authoritative workflow the scaffold advertises hold end-to-end for
real apps — which, those aside, it already nearly does.
