# Implementation Plan — `@aperture-engine/ui`

> A new workspace package bringing Aperture's UI to **feature parity with
> `pmndrs/uikit`** (default Yoga flexbox, SDF rounded corners + borders, text
> input, rendered scrollbars, conditional/responsive styling, prebuilt kits)
> while keeping and extending Aperture's structural advantages (WebGPU, ECS,
> worker-safe, deterministic, renderer-independent), plus game-oriented features
> uikit lacks — chiefly **layout freezing / incremental relayout**.
>
> Companion to `docs/UI_SYSTEM_AUDIT.md` (the gap analysis this closes).
>
> **Grounding.** This revision is backed by deep research verified against
> Aperture's source (threading/snapshot model, package conventions), primary
> Yoga/Taffy docs + source, and a **local uikit checkout at `references/uikit/`**
> (gitignored; exact source paths cited inline). Where a fact was confirmed,
> it's stated plainly; remaining unknowns are flagged **[verify in M0]**.
>
> **Status:** proposal / design. Effort estimates are order-of-magnitude for one
> engineer.

---

## 0. TL;DR

1. New `packages/ui` → **`@aperture-engine/ui`**. It owns the **authoring API**
   (declarative builder over ECS), the **Yoga**-backed `LayoutEngine` (retained
   tree, dirty-gated, freeze-aware), **style resolution**, the **UI extraction
   logic**, and the **kits**. Depends on `render` + `simulation` + `math`.
2. **Replace** the hand-rolled absolute/row/column pass
   (`packages/render/src/rendering/extraction-ui.ts`) with real flexbox. Flexbox
   is the **default and only** model (absolute = `position:absolute`, a flex
   feature).
3. **Package boundary uses a dependency-injection seam** (not "ui owns its own
   packets"): the snapshot **wire contract stays in `render`** (packet types +
   `RenderSnapshot` fields), `render` exposes a **UI-extractor hook**, `ui`
   implements it, `app` wires it. This avoids a circular dependency — see §3.
4. **Run Yoga inline on the existing simulation worker**, where layout already
   runs. **No dedicated layout worker.** The retained Yoga tree is a *derived
   extraction cache* (reconciled with the "ECS is source of truth" invariant in
   §5.4). The opt-in **SAB transport already exists** but does **not yet encode
   UI packets** — UI-on-SAB is optional follow-up work (§6).
5. Extend `@aperture-engine/webgpu` UI pipelines for **SDF rounded rects +
   per-side borders (AA)**, **caret/selection**, **scrollbars** — reusing the
   instanced quad/text pipelines (§7).
6. **Text input straddles threads**: the hidden DOM `<input>`/IME/`Intl.Segmenter`
   stay **main-thread**; only discrete events cross to the worker, which owns the
   value state + caret/selection geometry (§8).
7. Ship in phases: M0 scaffold + spikes → M1 flexbox → M2 styling → M3 input +
   scrollbars → M4 conditional/responsive → M5 builder + kit.

---

## 1. Goals & non-goals

**Goals.** uikit parity on the audit's red/orange dimensions (full flexbox,
border-radius + borders with SDF AA, text input, rendered scrollbars, conditional
+ responsive styling, a prebuilt kit); flexbox as the default (delete the custom
engine); **game-grade controls** uikit lacks (freeze layout, incremental relayout,
per-frame layout budget); preserve Aperture's architecture (renderer-independent,
worker-safe, deterministic, no mandatory framework); one cohesive package.

**Non-goals (v1).** HTML/Tailwind/Figma conversion (uikit lacks this too); a
React/JSX binding in core (optional future `@aperture-engine/ui-react`); CSS Grid
(Yoga is flexbox-only); a declarative spring/easing DSL (ship a tween utility —
uikit has none either); Video/SVG/3D-embed primitives (audit P2, defer).

---

## 2. Key decisions (recommendations — flagged so you can override)

### ⮕ D1 — Authoring API: **declarative builder over ECS** (recommended)
A framework-agnostic fluent tree that *compiles to ECS components*:
```ts
const root = ui.screen({ scale: "viewport" }, [
  ui.column({ padding: 16, gap: 8, backgroundColor: "#1b1d23", borderRadius: 12 }, [
    ui.text("Score: 0", { fontSize: 20, color: "#fff" }),
    ui.button({ onClick: () => fire() }, [ui.text("Start")]),
  ]),
]);
app.spawn(root);  // expands to UiNode/UiStyle/... entities
```
uikit-class ergonomics, no React dependency, ECS stays the source of truth. Raw
ECS authoring remains available; the builder is sugar. (The builder **replaces**
the `withUi*` helpers currently in `@aperture-engine/runtime`.) Alternatives: raw
ECS only (too verbose); React/JSX-first (defer to an optional package).

### ⮕ D2 — Render boundary: **renderer-independent via a DI seam** (recommended)
`ui` produces packets; `webgpu` draws; `ui` never imports the WebGPU device. But
the snapshot **wire contract is centralized in `render`** (confirmed: packet types
live in `snapshot-packet-types.ts`, are re-exported by `snapshot.ts`, and appear
as fields on `RenderSnapshot` in `snapshot-core-types.ts`). Because `render`
cannot depend on `ui` (circular), we connect them with a **registration/DI seam**
(§3.2). Rejected: a self-contained `ui` that owns GPU draw (forfeits worker-safety
and determinism).

### ⮕ D3 — Prebuilt kit: **phased — core/game widgets first, app kit later** (§10).

### ⮕ D4 — Layout engine: **Yoga now, behind a `LayoutEngine` interface** (§4).
`yoga-layout` 3.x. Wrap behind a port so the long-mooted "Taffy-compatible
adapter" stays swappable.

### ⮕ D5 — Threading: **Yoga inline on the sim worker; no dedicated layout worker** (§6).

---

## 3. Architecture & the package boundary

### 3.1 How a frame works today (verified)
The **simulation worker** is the authority (`createExtractionApp` →
`ApertureApp`). Each tick (default 240 Hz, optional fixed-step): drain
frame-stamped input → `app.step()` (systems, physics, resolve transforms) →
spatial + **`runInteractionFrame()`** (hit-test UI, scroll, fire handlers,
worker-side, deterministic) → **`app.extract(frame)`** which calls
`extractRenderSnapshot()` → `extractUiLayout()` (**UI layout runs here, on the
worker**) → encode → transport. The **main thread** owns WebGPU
(`createWebGpuApp`), decodes the snapshot, and draws. Two transports exist:
**transferable `postMessage`** (default) and the opt-in **SharedArrayBuffer**
double-buffer (SeqLock header + `Atomics`, COOP/COEP enabled by default in
`@aperture-engine/vite-plugin`, ~30 Hz heartbeat, transferable fallback).

```
WORKER:  input → step → interaction(hit-test UI) → EXTRACT[ style-resolve →
         LayoutEngine(Yoga, dirty/freeze) → packets ] → encode → transport
                                   │ transferable OR SAB
MAIN:    decode → instanced quad pipeline (panel/image + radius/border SDF) +
         MSDF text (+caret/selection) + scrollbars → present
```

### 3.2 The dependency-injection seam (the crux)
**Constraint (confirmed):** the snapshot schema is centralized in `render`; you
add a packet type by (1) defining it in `snapshot-packet-types.ts`, (2) exporting
from `snapshot.ts`, (3) adding a field to `RenderSnapshot`, (4) writing an
extractor, (5) having `render` call it during `extractRenderSnapshot()`. Today UI
does exactly this **inside `render`**. We can't move steps 1–3 to `ui` (that needs
`render` → `ui`, circular).

**Resolution.** Split along the wire:
- **`render` keeps the wire contract**: the `UiNodePacket`/`UiHitRegionPacket`
  types (extended with border/radius/input/scrollbar fields), the `RenderSnapshot`
  fields, and a new **`UiExtractor` hook** — an interface + a registration point
  in `extractRenderSnapshot()` that, if a UI extractor is registered, calls it;
  otherwise emits no UI. `render` no longer hard-codes UI layout.
- **`ui` owns everything above the wire**: the authoring components
  (`UiNode`/`UiStyle`/`UiText`/`UiInput`/...), the builder, the Yoga
  `LayoutEngine` + retained tree + freeze, style resolution, the extraction
  *logic* that fills the packets, the kits.
- **`app` wires it**: registers `ui`'s extractor with the render world at startup
  (same pattern as system/component registration). Dependency direction stays
  `app → {ui, webgpu, render}`, `ui → render`, `webgpu → render` — acyclic.

This keeps the wire contract where the architecture wants it, gives `ui` true
ownership of all UI *logic and authoring*, and is the **main thing to validate in
M0** (confirm the hook shape against `extractRenderSnapshot()` and that moving the
`Ui*` components out of `render` doesn't strand `runtime`'s `withUi*` — which the
builder replaces anyway).

> *Lighter fallback if the seam proves awkward:* leave the UI authoring +
> extraction in `render` and make `ui` a higher-level facade (builder/layout/
> style/kits) that drives render's components. Less "consolidated," but zero
> circular-dep risk. Decide in M0.

### 3.3 Package layout
```
packages/ui/
  package.json   # @aperture-engine/ui; type module; exports . + ./test-support; tsc build
  tsconfig.json  # extends ../../tsconfig.base.json; composite; refs ../render ../simulation ../math
  src/
    index.ts
    components/   ui-node, ui-style, ui-text, ui-image, ui-input, ui-scroll, ui-hit-target,
                  ui-screen, freeze.ts          # defineComponent (elics) schemas
    layout/       engine.ts (port) · yoga-engine.ts · yoga-loader.ts (async loadYoga)
                  style-to-yoga.ts · measure-text.ts (Yoga measure ↔ msdf-font-atlas)
    style/        resolve.ts (layered) · stylesheet.ts (classList/StyleSheet) · tokens.ts
    builder/      builder.ts (D1)
    extraction/   extract-ui.ts (implements render's UiExtractor) · packets.ts (helpers)
    interaction/  hit-test.ts (moved from render/ui-hit-test.ts)
    kits/         M5: button, slider, dialog, hud/*
    systems.ts    registerable systems + registerUiComponents(world) + registerUiExtractor()
  # tests live in repo-root /test/ui/** (NOT co-located — repo convention)
```

---

## 4. Layout engine — Yoga (verified facts)

### 4.1 Why Yoga (over Taffy)
| | Yoga `yoga-layout` 3.x | Taffy (Rust) |
|---|---|---|
| Web maturity | First-party WASM ESM (~118 KB), proven by **uikit** | Adopters (Bevy/Dioxus/Zed) all use it **natively in Rust** |
| JS/WASM binding | Official, mature | **Official WASM binding never shipped** (PR #394 stalled); third-party bindings ~12★, <6 mo old |
| Features | Flexbox only | Flexbox **+ Grid + block** |
| Text leaves | `setMeasureFunc` (clean MSDF bridge) | measure callback (rougher binding) |
| Incremental | Dirty-tracking, root O(1) early-out | `mark_dirty` + 4-slot cache |
| Memory | Manual `free()/freeRecursive()` (no GC) | Rust-owned (cleaner) |
| Determinism | Spec-backed for one pinned `.wasm` | Same, but only after you build/pin your own WASM |

**Recommendation: Yoga**, behind a `LayoutEngine` port (so Taffy + Grid stays a
future option, honoring the "Taffy-compatible adapter" the code already names).
On the web today, only Yoga has a real story; adopting Taffy means owning a
Rust→WASM toolchain — a project, not a dependency.

### 4.2 Critical integration facts (verified — some correct earlier assumptions)
- **Init is ASYNC.** Yoga 3.x is **WASM-only (no asm.js)**; there is **no
  synchronous init**. Use the `yoga-layout/load` entry: `const Yoga = await
  loadYoga()` **once during worker system startup**, before the layout system
  ticks. (The default `.` entry uses top-level await; the worker should use
  `/load` explicitly.) *This corrects an earlier "sync-init" assumption.*
- **API:** `Yoga.Node.create()`, `setFlexDirection/ setWidth('auto'|`${n}%`|n)/
  setPadding(edge,v)/ setFlexGrow(n)`, `insertChild(child,i)`,
  `calculateLayout(availW, availH, Direction.LTR)`, read `getComputedLayout()` →
  `{left,top,width,height}`.
- **Incremental (strong):** setters dirty a node **only on real value change**
  (redundant per-frame writes are no-ops); a clean tree with unchanged owner
  dimensions **early-outs at the root in ~O(1)** (no descent). `markDirty()` is
  only for measure-function leaves. Config: `useWebDefaults(true)`,
  `pointScaleFactor(100)` (pixel rounding), `WebFlexBasis` — mirror uikit.
- **Text:** `setMeasureFunc((w, wMode, h, hMode) => ({width,height}))` bridges to
  the existing deterministic `layoutMsdfText`; ceil to `pointScaleFactor` to avoid
  spurious wraps; call `markDirty()` when content changes.
- **Memory:** WASM heap, no GC — `free()` each node on entity despawn (uikit ties
  it to `dispose()`).
- **Perf (benchmarks):** ~**2 µs/node**; ~100 nodes ≈ 0.3 ms, ~1000 ≈ 2 ms,
  ~5000 ≈ 9 ms (risky vs a 16.7 ms budget); **hot relayout (warm cache, 1 leaf)
  ≈ 80–120 µs**. The **JS↔WASM boundary dominates** (no batch API): set only
  changed props, reuse nodes across frames, read rects in a tight loop.

### 4.3 `LayoutEngine` port
```ts
interface LayoutEngine {
  createNode(): LayoutHandle;
  setStyle(h, style): void;            // flex/size/pos/overflow
  setMeasure(h, fn | null): void;      // text leaves
  insertChild(parent, child, i): void; removeChild(parent, child): void;
  markDirty(h): void;                  // measure leaves only
  calculate(root, availW, availH): void;
  getComputed(h): ComputedRect;        // x,y,w,h (+ border/padding insets)
  free(h): void;
}
```
The Yoga adapter keeps a **persistent entity→node pool** mirroring the ECS UI
tree (the Bevy `entity_to_taffy` pattern; uikit's `requestCalculateLayout` +
once-per-frame `onFrame`). Aperture's dirty signal is **ECS change detection**
(not preact signals).

---

## 5. Incremental layout, freeze, and the determinism reconciliation

### 5.1 Three cost tiers (cheap → free)
1. **Dirty-gated relayout (default).** A UI component mutation marks its Yoga node
   dirty; `calculate()` runs only if a screen has any dirty node. Static frames
   cost one check.
2. **`UiFreezeLayout` (explicit).** A flag on a subtree root that suppresses dirty
   propagation, skips traversal, and reuses cached `ComputedRect`s — ideal for a
   HUD that never moves while the world churns. `relayout(entity)` / removing the
   flag forces one pass. **Verified-cheap:** with Yoga, "freeze" is literally *not
   calling `calculateLayout`* (rects persist; `getComputedLayout()` is a field
   read), or relying on the root O(1) early-out.
3. **Per-frame layout budget (optional).** A node/time cap; over-budget screens
   defer to the next frame with a diagnostic. Prevents a giant dynamic menu from
   spiking a frame.

uikit cannot do (2)/(3) — it relays out reactively on the main thread. Concrete
Aperture advantage.

### 5.2 Reconciling a retained tree with "ECS is source of truth"
AGENTS.md invariants (load-bearing): **ECS is the source of truth**, **rendering
is a derived one-way view**, **extraction is a serializable boundary**,
**worker-by-default**. Today's extraction is a *pure rebuild every frame* with no
retained layout tree. A retained Yoga tree appears to conflict — it does not:

- The Yoga tree holds **no authoritative state**; it is a **derived cache** of
  computed layout, fully reconstructable from ECS, keyed by entity, and
  invalidated by ECS change detection. (Precedent: `createExtractionApp` already
  owns a persistent **extract cache**.)
- ECS stays the only source of truth; the snapshot stays an immutable, serializable
  typed-array boundary; layout still runs headless on the worker. The cache is an
  *internal optimization of the extraction step*, exactly like Bevy's `UiSurface`.

So the design is: **a persistent, entity-keyed Yoga tree owned by the UI
extractor, mutated only from ECS changes, producing immutable packets.** This is
the enabling change for incremental + freeze.

### 5.3 Determinism stance (verified)
UI layout is **downstream of simulation** and does **not** feed the deterministic
sim hash. Yoga is **spec-backed deterministic for a single pinned `.wasm`**
(IEEE-754 ties-to-even; NaN payloads unused; deterministic root-relative pixel
rounding) — so **replays on the same build are exact**, and even cross-machine
lockstep is safe **if all peers ship the same `yoga.wasm`**. Pin the WASM artifact.
The only residual caveat (sub-pixel hit-test edges across *different* native
builds) is avoidable by pixel-rounding via `pointScaleFactor`.

---

## 6. The worker / SharedArrayBuffer debate (with recommendation)

**Reframing.** Unlike uikit (a main-thread library whose perf advice is "instanced
batching + reactive partial updates, keep layout on main"), **Aperture already runs
UI layout on the simulation worker**, already has the opt-in **SAB snapshot
transport**, and already pays COOP/COEP (enabled by default in the vite-plugin). So
the uikit framing ("offload layout to dodge main-thread jank") doesn't apply.

| Option | Meaning | Verdict |
|---|---|---|
| **A. Yoga inline on the sim worker** (recommended) | Layout = step 2 of extraction, same thread as the ECS UI data | ✅ Simplest, zero added latency, deterministic with the step, reuses the existing transport |
| B. Dedicated layout worker | 2nd worker owns Yoga; marshal the UI tree both ways via SAB | ❌ Adds a frame of latency + a 2nd WASM instance + bidirectional marshalling; optimizes a cost that freezing already removes; **and can't host the text-input DOM** (§8) |
| C. Yoga on main thread | uikit's model | ❌ Reintroduces the jank Aperture's architecture avoids |

**Recommendation: A.** Reasons: (1) it's already the right thread — no
marshalling; (2) freezing/dirty-gating makes steady-state layout ≈ 0, so a 2nd
worker would parallelize work that often isn't happening; (3) a 2nd worker adds
latency, not throughput, for this workload; (4) **text input can't be fully
offloaded** — the hidden DOM `<input>`, IME, `Intl.Segmenter`, and
`document.activeElement` are main-thread only, so a layout worker would split the
input system across *three* threads.

**Two concrete SAB facts that shape the work:**
- The SAB transport's **packed encoder does not currently encode UI packets**
  (it covers mesh/light/bounds/fog/camera; UI/sprites force the **transferable
  fallback**). UI layout *runs* on the worker regardless; but to put computed UI
  rects on the **zero-copy SAB hot path**, we must **extend the packed encoder
  for UI packets**. That's optional perf follow-up (do it only if UI transport
  shows up in a profile), not a v1 requirement.
- Nothing here *requires* SAB. On non-isolated pages the transferable path carries
  the same packets.

**Future opt-in only:** if a real app builds enormous fully-dynamic UIs (10k+
nodes relaid every frame) and layout rivals sim cost, expose a `layout: "offload"`
option mirroring `transport: "shared-array-buffer"` — shipping only computed rects
over an SAB double-buffer while keeping text-input/IME on main. **Not in v1.**

---

## 7. Rendering work (in `@aperture-engine/webgpu`)
Additive to the instanced pipelines. Reference implementation:
`references/uikit/packages/uikit/src/panel/material/shader.ts`, `…/clipping.ts`,
`…/scroll.ts` (local checkout).

### 7.1 SDF rounded rects + per-side borders (extend `ui-quad-pipeline.ts`)
uikit uses a **per-edge distance** formulation (not iq's `sdRoundedBox`) so it can
do 4 independent corner radii **and** per-side border widths in one quad:
- Measure signed distance to each of the 4 edges (x-distances scaled by aspect);
  the straight-edge SDF is `min` of the four. Corners: detect the quadrant and
  swap in a radial distance. Keep an **outer** SDF (`distance.x`) and an **inner
  inset** SDF (`distance.y`); the **border band** is `distance.x>0 && distance.y<0`.
- **AA:** `g = fwidth(distance)` then `smoothstep(-g, g, distance)` for outer and
  inner; mix background↔border across the band. Premultiply background opacity;
  combine border opacity as `min(1, border+bg)`. `discard` when `outOpacity<0.01`.
- **WGSL port notes:** per-instance add `cornerRadii: vec4<f32>` (skip uikit's
  base-50 bit-packing) and `borderWidths: vec4<f32>` + `borderColor: vec4<f32>`;
  `fwidth(x)=abs(dpdx(x))+abs(dpdy(x))`. For *uniform* borders the simpler iq
  **annular trick** `abs(d)-thickness` suffices. `borderBend` (lit bevel) optional.
Gradients/box-shadow stay out of scope (uikit lacks them too).

### 7.2 Clipping — keep rect-discard fast path; add clip planes for the hard cases
uikit clips with **4 world-space clip planes per instance**, evaluated in the
fragment shader with **smooth AA falloff** (+ a coarse CPU corner cull), **not**
hardware scissor. Why: scissor is an axis-aligned framebuffer rect, so it can't
clip rotated/3D panels, can't express the **intersection** nested scrollers need,
and — critically — **per-draw scissor state would shatter the instanced batches
into one draw per clip rect**. Per-instance planes keep one draw call and give AA
for free (cost: 4 dot-products + 4 `smoothstep`/fragment). **Plan:** keep
Aperture's current rect-intersection `discard` as the fast path for screen-aligned,
un-nested UI; add the 4-plane path when we support rotated/world-space/nested UI
(§11). v1 can stay rect-based.

### 7.3 Text input visuals & scrollbars (reuse existing pipelines)
- **Caret:** one instanced quad at the glyph-run caret offset (from
  `layoutMsdfText`), blink via a time uniform (uikit toggles every 500 ms).
- **Selection:** highlight quads behind selected glyph ranges (one per line
  segment), drawn before the text.
- **Scrollbars:** X/Y each a single instanced panel. Thumb length =
  `max(barThickness, viewport² / (maxScroll + viewport))`; thumb position =
  `maxThumbPos * clamp(scroll/maxScroll, 0, 1)`; hidden when no overflow. Style via
  `UiScroll`: `scrollbar{Width,Color,Radius,Opacity}`. Mouse grabs the thumb;
  wheel/touch scroll with rubber-band + velocity damping (`*0.9`/frame). The scroll
  **math already exists** in `ui-scroll.ts`; this is just the visuals + thumb hit.

---

## 8. Text input (full path, threads explicit)
uikit's proven design — a **hidden DOM input mirror**
(`references/uikit/.../text/input/hidden-input.ts`, `components/input.ts`,
`text/selection/*`, `text/layout/query.ts`):

1. **Main thread:** a real off-screen `<input>`/`<textarea>` at `left:-1000vw`
   (not `display:none` — a hidden element can't hold focus), `opacity:0`,
   `pointerEvents:none`, appended to `body`. It owns real focus, IME, clipboard,
   key-repeat, mobile soft-keyboard, a11y. We mirror `value` + `selectionStart/End`.
2. **Bridge:** on `input`/selection change, the main thread posts value+selection
   to the worker as an input event (same channel as pointer events). Focus: a
   pointer-down on a `UiInput` hit-target tells main to `element.focus()`
   (`setTimeout(0)` so the browser's own focus handling doesn't fight it; plus a
   blur-cancel guard so clicking the canvas doesn't blur).
3. **Worker:** updates `UiInput` state, lays out the (possibly password-masked or
   placeholder) text, and computes caret + selection geometry from the MSDF glyph
   layout (`getCharIndex`/`getCaretTransformation`/`getSelectionTransformations`
   ports). Extraction emits caret/selection packets.
4. **Render:** draws caret + selection quads (§7.3).

`UiInput` supports `value/defaultValue/placeholder/type(text|password|number)/
multiline/disabled/maxLength/onChange/onSubmit`. **Threading caveat (load-bearing
for §6):** the DOM element and `document.activeElement`/`Intl.Segmenter` are
main-thread; only discrete events cross to the worker. Determinism holds because
the worker only ever sees a stream of input events. *(A future non-DOM/native host
would need an OS IME bridge instead.)*

---

## 9. Conditional & responsive styling (uikit's layered model)
Resolve **on the worker** (`style/resolve.ts`), before layout, recomputed on ECS
change. uikit models style as **numbered layers**; per property, take the value
from the **lowest-index (highest-priority) layer that defines it**
(`references/uikit/.../properties/{layer,conditional,index}.ts`):

**Precedence (high→low):** `important` → `placeholderStyle` → `focus` → `active` →
`hover` → `dark` → responsive `2xl→xl→lg→md→sm` → `base` → `*` star-inheritance →
normal inheritance. Within each layer: component props > classes > defaults.
**Breakpoints** (active when `rootWidth > bp`): `sm 640, md 768, lg 1024, xl 1280,
2xl 1536`. Conditions come from the interaction system (`hover` = hovered,
`active` = pressed, `focus` = input focused, `placeholder` = empty) + OS `dark`.

Implement as an ordered layer list (sections × {base, classes, defaults}), each a
sparse `key→value` map; resolve = first non-`undefined` ascending; cache per key,
recompute on dependency change. `@preact/signals-core` is **already an `app`
dependency** and is an option for the reactive cache, but the worker-side
mechanism is ECS change detection. This finally lets us implement
`UiScreenScaleMode.Viewport`, which today is *defined but never read* (audit §3.9).
Pair with a **UI tween utility** (lerp resolved numeric/color props toward target
over N ms) so hover/active can animate — covering uikit's one signal-driven
ergonomic edge without a signal system.

---

## 10. Builder & kit (D1, D3)
`ui.screen/column/row/box/text/image/input/scroll/button(...)` return specs;
`app.spawn(spec)` expands them into `UiNode`/`UiStyle`/`UiText`/... entities with
parent links and first-class flex props. **Kit (phased):** M5 ships button,
toggle, checkbox, slider, tabs, text field, dialog + game HUD primitives (bar,
panel/frame, list/menu), themed for games; a fuller shadcn-style app set lands
post-v1. Kit widgets are authored ECS prefabs over the new primitives.

---

## 11. Game-oriented features (beyond uikit)
`UiFreezeLayout` + dirty-gated incremental layout (§5); per-frame layout budget;
**layer-masked UI** (carry forward the per-camera `layerMask` advantage for
split-screen/multi-view); **deterministic replayable UI** (falls out of running on
the worker step); **world-space UI panels** (stretch/post-v1 — needs the §7.2 clip
planes + a world matrix in the packet; this is where uikit currently has a free
edge since its UI *is* scene geometry).

---

## 12. Migration (delete the custom engine) & wiring checklist
**Replace/move:**
- **Delete** the manual cursor-advance + `UiLayoutMode` (Absolute/Row/Column) in
  `extraction-ui.ts`; absolute → `position:"absolute"`.
- **Move** UI authoring components, hit-testing (`render/ui-hit-test.ts`), and
  extraction *logic* into `ui`; **keep** the packet types + `RenderSnapshot`
  fields in `render` and connect via the `UiExtractor` seam (§3.2). Extend packets
  with `cornerRadii`, `borderWidths`, `borderColor`, caret/selection, scrollbar.
- **Replace** `runtime`'s `withUi*` helpers with the `ui` builder; one-minor-release
  compat shim mapping old `UiNode{layoutMode,x,y}` → flex props, then remove.
- **app** registers `ui`'s components + extractor in the worker bootstrap;
  interaction (`packages/app/src/interaction`) consumes the richer packets.

**Repo wiring (every touch-point — verified):**
- `packages/ui/{package.json,tsconfig.json,LICENSE,README.md}` per §3.3 (deps
  `render`+`simulation`+`math`; `yoga-layout`).
- **Root `package.json` `build`** — add `packages/ui` to the `tsc -b` list **after
  `packages/render`**.
- **`.changeset/config.json`** — add `@aperture-engine/ui` to the **`fixed`** group
  (lockstep versioning). *Required.*
- **`vitest.config.ts`** — add a `@aperture-engine/ui` (+`/test-support`) alias.
- **`tsconfig.test.json`** — add `@aperture-engine/ui` paths.
- **Tests** in repo-root **`/test/ui/**`** (repo convention; not co-located); meet
  coverage thresholds (statements 85 / branches 73.5 / functions 90 / lines 85).
- **Examples** — migrate `examples/ui-hud.*` to the builder; add a flex/input demo.
- `pnpm-workspace.yaml` already globs `packages/*`; `eslint.config.js`/`knip.json`
  are workspace-global (no per-package entry).
- **`webgpu`** gains a `workspace:^` dep on `ui` only if any UI *types* it needs
  end up there; with the seam they stay in `render`, so likely **no new dep**.

---

## 13. Phased roadmap
| Milestone | Deliverable | Effort |
|---|---|---|
| **M0 — Scaffold & spikes** | `packages/ui` builds/tests/lints in CI; **`await loadYoga()` on the worker** proven; measure-func ↔ MSDF spike; **validate the `UiExtractor` DI seam** (or pick the facade fallback). | 0.5–1 wk |
| **M1 — Flexbox (default)** | `LayoutEngine`+Yoga adapter; retained entity→node tree + dirty-gating; full flex props; **delete custom absolute/row/column**; compat shim; golden-layout tests. | 2–3 wk |
| **M2 — Styling** | SDF rounded corners + per-side borders + AA (WGSL); `objectFit`; `UiFreezeLayout` + budget. | 1.5–2 wk |
| **M3 — Input & scrollbars** | `UiInput`/`Textarea` (hidden-DOM bridge, caret/selection, IME); rendered styleable scrollbars. | 2–3 wk |
| **M4 — Conditional/responsive** | Layered resolver + precedence; `hover/active/focus/dark` + `sm…2xl`; tokens/dark mode; **real `Viewport` scale mode**; tween utility. | 1.5–2 wk |
| **M5 — Builder + kit** | Fluent builder (replaces `withUi*`); core/game widget kit. | 2–3 wk |
| **post-v1** | shadcn app kit; React bindings; world-space panels; **UI packets on the SAB encoder**; optional layout-offload worker. | — |

Each milestone ships behind the new package; the old `render` UI keeps working
until M1's shim removal.

---

## 14. Risks & open questions
- **`UiExtractor` seam shape** — confirm against `extractRenderSnapshot()` in M0;
  fall back to the `ui`-as-facade option if needed (§3.2).
- **Async Yoga init on the worker** — `loadYoga()` must complete before the layout
  system ticks; sequence it in worker bootstrap (M0 spike).
- **Retained tree vs. determinism** — treat as a derived cache (§5.2); add a test
  asserting identical packets across runs and after freeze/unfreeze.
- **JS↔WASM chattiness** — set only changed props, reuse nodes, batch reads; watch
  ≥5000-node every-frame cases (lean on freezing).
- **Hidden-DOM input on mobile** — focus/blur/pointer-capture vs the WebGPU canvas
  needs care (§8).
- **SAB UI encoding** — UI currently forces the transferable fallback; the SAB
  encoder extension is deferred and only needed if profiling demands it.
- **Scope** — "everything uikit has" is large; phasing keeps each step shippable;
  Video/SVG/3D-embed deferred (audit P2).
- **Bundle size** — Yoga WASM (~118 KB) + kit; keep `ui` tree-shakeable
  (`sideEffects:false`), kit behind a subpath export.

## 15. Test strategy
- **Golden layout fixtures** (root `/test/ui/`): assert computed rects for flex
  trees (grow/wrap/justify/align, %, aspect, min/max) — guards the engine + future
  Taffy swap.
- **Determinism:** identical packets across runs and after freeze/unfreeze.
- **WebGPU e2e** (`scripts/webgpu-e2e.sh`): screenshot tests for rounded/bordered
  panels, caret/selection, scrollbars (AA-tolerant compare).
- **Interaction:** hit-test + scroll + focus (extend `packages/app` interaction
  tests).
- **Freeze:** assert `calculate()` is skipped when frozen / not dirty.

---

*Reference implementation available locally at `references/uikit/` (gitignored):
panel SDF/border shader `panel/material/shader.ts`; clipping `clipping.ts`; text
input `text/input/hidden-input.ts` + `text/selection/*` + `text/layout/query.ts`;
scrollbars `scroll.ts`; style resolver `properties/*` + `pub-sub/src/index.ts`.*

*Recommended next step:* approve D1–D5 (or amend), then I scaffold **M0** — the
package, the `await loadYoga()` worker spike, the MSDF measure-func bridge, and the
`UiExtractor` seam validation — which de-risks every later milestone.
