# M6 — UI + Particles: research notes & open questions

**Status:** pre-plan research. This captures what is **confirmed** (from direct
source reconnaissance) and what **still needs research** before a concrete M6
implementation plan can be written. It is _not_ the plan itself.

**Scope confirmation:** this is **M6** (the roadmap "content layer" milestone).
The roadmap's M6 is marked _design-level (code does not exist yet)_; this turns
the reconnaissance into grounded detail. M3 (render graph) and M7 (pointer
events / interaction) are **complete** — both are foundations M6 builds on.

---

## 1. Baseline libraries (pinned + cloned into `references/`)

Added to `scripts/setup-references.sh` so they auto-restore on fresh checkouts:

| Lib                          | Pin               | Role (user's stated baseline) |
| ---------------------------- | ----------------- | ----------------------------- |
| `pmndrs/uikit`               | `v1.0.73`         | text / UI feature baseline    |
| `Alchemist0823/three.quarks` | `main @ v0.17.0+` | particles feature baseline    |

Also already present: `bevy`, `engine` (PlayCanvas), `three.js`, `three-mesh-bvh`.

### uikit structure (`references/uikit/packages/uikit/src`)

- `flex/` — `node.ts`, `yoga.ts` → **Yoga flexbox** layout (WASM) integration
- `panel/` — `geometry.ts` → instanced rounded-rect panel rendering
- `text/` — `font.ts`, `cache.ts`, `utils.ts` → **MSDF** text; plus `packages/msdfonts`
- `properties/` — `schema`, `defaults`, `inheritance`, `conditional`, `alias`, `values` → CSS-like styling system
- `components/` — `container`, `image`, `input`, `textarea`, `text`, `content`, `svg`, `video`, `custom`, `fullscreen`
- `events.ts`, `listeners.ts`, `hover.ts`, `active.ts`, `clipping.ts`, `scroll.ts` — interaction
- `allocation/sorted-buckets.ts`, `order.ts`, `transform.ts` — instance allocation + z-order
- Built **on three.js**: layout/property/glyph core is renderer-agnostic; the instanced-mesh rendering is three-specific.

### three.quarks structure (`references/three.quarks/packages`)

- `quarks.core/src` — **renderer-agnostic sim core**: `shape/` (emission shapes), `behaviors/` (forces, color/size/rotation-over-life, noise/turbulence), `sequencers/`, `functions/` (curves/gradients/value generators), `math/`, `util/`
- `three.quarks/src` — three.js bridge: `materials/`, `shaders/`, `util/` (batched/instanced rendering, emitter object)
- `quarks.nodes` (node graph), `quarks.r3f` (react bindings), `quarks.playground`

---

## 2. Confirmed architectural findings

These are verified by direct source reads and are the load-bearing facts.

1. **Both baseline libs split into a renderer-agnostic core + a three.js bridge.**
   This maps cleanly onto aperture's package boundary: headless core →
   `packages/render` (+ `packages/simulation`), GPU bridge → `packages/webgpu`.
   `check:boundaries` forbids GPU types in `simulation`/`render`.

2. **M3's render graph already supports compute-pass nodes.** ✅ (biggest de-risk)
   `packages/webgpu/src/render/graph/frame-graph.ts` exposes `ComputePassNode`
   (`kind: "compute"`), `addComputePass()`, `ComputePassCommand`
   (`packages/webgpu/src/render/passes/compute-pass-commands.ts`), buffer
   resource handles for compute outputs, and `frame-graph-history.ts` ping-pong /
   cross-frame history resources. ⟹ **GPU-compute particle simulation feeding an
   instanced-billboard render pass in one encoder is buildable today** — no M3
   gap. (This was also M8's gating risk; it's resolved.)

3. **Bevy's `bevy_ui` → `bevy_ui_render` extract-to-render-world model directly
   mirrors aperture's worker→snapshot extraction.** Bevy is the most
   architecturally relevant UI reference (more than the three.js libs): ECS
   `Node`/`Style` components → taffy layout system → extract into batched
   rect/glyph/image instances → UI render pass. `bevy_text` uses cosmic-text.
   Entry points: `references/bevy/crates/bevy_ui/src/{ui_node.rs, layout/,
picking_backend.rs, focus.rs, widget/}`, `bevy_ui_render/src`, `bevy_text/src`.

4. **PlayCanvas has a WebGPU particle path** and an entity/component UI model
   close to aperture's: `references/engine/src/scene/shader-lib/wgsl/chunks/
particle`, `engine/src/scene/particle-system`, `engine/src/framework/
components/{particle-system, element, screen, layout-group, layout-child}`.

5. **Existing aperture sprite path is the M6-T1 foundation** (and the
   instanced-quad pattern UI panels, text glyphs, and particle billboards all
   reuse). Flow: `packages/render/src/rendering/extraction-sprites.ts` → snapshot
   (via `extraction.ts` + `renderSnapshotTransferList`) → `packages/webgpu/src/
app/{sprites.ts, sprite-frame.ts}` → `packages/webgpu/src/render/sprites/
sprite-pipeline.ts` (instanced quad draw). **Current limitation:**
   spherical-billboard only — no axis-lock/cylindrical, no screen-space px size,
   no per-sprite rotation, no UV-atlas/sprite-sheet animation.

6. **Text rendering is entirely absent** — confirmed: no SDF/MSDF, no font
   loader, no glyph layout anywhere in `packages/`.

7. **ECS authoring conventions** live in `packages/render/src/rendering/
authoring-components{-core,,-camera-light,-spatial}.ts` (elics components,
   enums-as-strings, packed Vec2/3/4/Entity fields, `withX()` helpers) — the
   template for new UI/particle components.

8. **M7 interaction is 3D-raycast picking** (`packages/app/src/interaction/
{access,system,pointer-events,index}.ts`, with `pickLayerMask`). **Gap for
   UI:** screen-space UI needs a **2D hit-test**, not a 3D mesh raycast — a new
   overlay hit-test must be designed and wired into the M7 pointer-event stream.

---

## 3. How the three.js → aperture port changes things ("lots has to change")

Confirmed directional deltas (the user's ECS-centric + WebGPU-only constraint):

- **Scene graph → ECS components + extraction.** uikit/three.quarks attach
  objects to a three.js scene graph. Aperture has no scene graph: UI nodes and
  particle emitters are **ECS components**, solved/packed **headlessly** in
  `packages/render`, then **extracted into the worker→main snapshot**.
- **Object-per-node → packed snapshot buffers.** No per-glyph/per-particle JS
  objects on the hot path; everything becomes typed-array instance buffers that
  cross the worker boundary via the transfer list (like sprites/transforms do).
- **CPU particle sim → WGSL compute.** three.quarks simulates per-particle on the
  CPU. Aperture should move per-particle simulation into a **compute pass** with
  ping-pong state buffers (emitter state stays ECS-authoritative). This is the
  single largest rewrite vs the baseline lib.
- **three.js instanced mesh → aperture sprite/quad pipeline + graph node.**
  Panels, glyphs, and billboards render through an expanded shared instanced-quad
  pipeline as **render-graph nodes** (screen-space and optional world-space).
- **DOM-ish event model → M7 pointer events + a new 2D hit-test.** uikit's
  hover/active/scroll/click ride three.js raycasting; aperture must drive these
  from the M7 pointer-event layer plus a screen-space 2D hit-test.
- **Yoga/taffy WASM → a worker-safe layout solver.** Layout must run in the
  headless worker context; the WASM-Yoga-vs-hand-rolled-flex choice is open
  (see §4).

---

## 4. What STILL needs research before writing the plan

The study/design workflow (`.claude/workflows/m6-ui-particles-plan.js`,
resumable — see §5) was going to answer these. Open questions, by area:

### UI — layout

- [ ] uikit's exact Yoga integration: is it the WASM `yoga-layout` build? Sync
      vs async solve? Per-frame cost? → decides **port Yoga (WASM) vs hand-roll a
      flexbox subset** headlessly in `packages/render` (worker-safety + bundle
      size + determinism are the deciding factors).
- [ ] How Bevy drives **taffy** as a system from `Node`/`Style` components — the
      closest ECS analog for an aperture layout system.
- [ ] Retained (ECS component tree) **vs** immediate-mode overlay — uikit is
      retained; Bevy is retained-ECS. Decision needed (affects the whole API).

### UI — rendering

- [ ] uikit `panel/geometry.ts`: how rounded corners / borders / gradients are
      done (SDF in the fragment shader vs geometry) → port target for the panel
      WGSL.
- [ ] Clipping/scissor + **stacking context / z-order** mechanics
      (`clipping.ts`, `allocation/sorted-buckets.ts`, `order.ts`).
- [ ] Screen-space vs world-space UI: resolution/scale modes, anchoring/pivots
      (PlayCanvas `screen` component is the reference).

### UI — text (MSDF)

- [ ] uikit `text/` + `packages/msdfonts`: font-atlas format, glyph-layout
      algorithm (line-breaking, kerning, alignment), atlas caching. → the headless
      glyph-layout core to port into `packages/render`.
- [ ] Do we **ship a default font atlas**? Generation pipeline / build step?
- [ ] Bevy/cosmic-text shaping vs uikit's simpler layout — how far to go
      (bidi? complex scripts? — likely scope OUT for M6).

### UI — interaction

- [ ] Design the **2D screen-space hit-test** and how it feeds the M7 pointer
      stream to drive hover/active/click + buttons + scroll. (M7 is 3D raycast —
      this is net-new.)

### Particles — simulation

- [ ] Confirm three.quarks is **CPU-sim** and map its `behaviors/` +
      `sequencers/` + `functions/` (curves) model precisely → which behaviors port
      to WGSL compute uniforms.
- [ ] **Spawning model:** compute-side emission vs CPU-seeded emission; lifetime
      / recycling; free-list vs atomic counter.
- [ ] **Ping-pong** particle-state buffers via graph history resources: confirm
      `addComputePass` supports persistent/imported cross-frame buffers and that a
      buffer can be compute-written then read by the render pass in one frame
      (resource lifetime/barrier reality in `frame-graph-execute.ts`).
- [ ] Indirect dispatch / indirect draw for GPU-driven particle counts (ties to
      M8 indirect-draw work — reuse or defer?).
- [ ] PlayCanvas WebGPU particle approach (`wgsl/chunks/particle`) — texture vs
      storage-buffer state; borrow patterns.

### Particles — rendering

- [ ] Billboard modes (spherical/cylindrical/axis-locked/stretched), **blend
      modes**, **soft particles** (depth fade), **sprite-sheet/atlas animation**,
      and **sorting** (GPU sort vs CPU vs unsorted-additive) — three.quarks'
      renderer feature set is the baseline to match.
- [ ] **CPU-sim fallback** path (capability / simplicity / small counts)?

### Cross-cutting

- [ ] Exact **shared instanced-quad foundation** API (expanded M6-T1) that BOTH
      UI (panels+glyphs) and particles (billboards) consume — the keystone that
      makes the milestone cohere. Needs: per-instance transform/size/rotation/
      UV-rect/color/tint, screen-space + world-space modes, atlas sampling.
- [ ] Package placement of each piece (`simulation` vs `render` vs `webgpu` vs
      `app`) under `check:boundaries`.
- [ ] Per-feature **proof routes** (worker-authored render-control + pixel/JSON
      assertions): layout-driven HUD with simulated-pointer buttons; text sharp
      at two zoom scales; 100k+ GPU particles at 60fps with frame-time + GPU-count
      JSON; billboard/atlas/blend pixel proofs.

### Decisions to surface to the user (from the above)

1. Retained ECS UI tree **vs** immediate-mode overlay.
2. WASM-Yoga **vs** hand-rolled flexbox subset (worker-safety/bundle/determinism).
3. GPU-compute **vs** CPU particle sim as the default (and whether to ship both).
4. Sorted (alpha) **vs** additive-unsorted particles as the default path.
5. How much text shaping (basic LTR + wrapping for M6; bidi/complex-scripts out?).

---

## 5. Resuming the full study/design workflow

The 11-agent workflow that produces the actual plan is saved and **resumable**;
completed agents return cached results:

```
Workflow({
  scriptPath: ".claude/workflows/m6-ui-particles-plan.js",
  resumeFromRunId: "wf_ef55fa31-c5b",
})
```

Phases: **Study** (7 parallel: uikit · three.quarks · PlayCanvas · Bevy-UI ·
aperture-sprites · aperture-graph-compute · aperture-interaction/ECS) →
**Design** (UI + particles) → **Integrate** → **Critique** (adversarial) →
**Finalize**. It outputs a revised M6 task breakdown, the shared-foundation
spec, the ECS+WebGPU delta, proof routes, risks, and the open decisions above.
