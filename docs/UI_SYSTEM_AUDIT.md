# UI System Audit — Aperture vs `pmndrs/uikit`

> **Scope.** A full capability audit of Aperture's UI system against
> [`pmndrs/uikit`](https://github.com/pmndrs/uikit), the de-facto standard for
> in-scene 3D UI in the three.js / react-three-fiber ecosystem.
>
> **Versions compared.** Aperture `0.2.0` (this repo) vs `@react-three/uikit`
> / `@pmndrs/uikit` `v1.0.74` (v1.0 line shipped 2025‑10‑16, ~3.2k★, yoga-layout
> 3.x, three.js WebGL).
>
> **Method.** Aperture capabilities were inventoried directly from source and
> adversarially re-verified against the repo to eliminate false gaps. uikit
> capabilities were researched from primary sources (its docs, README, and dist
> source). Every "gap" below was checked against the Aperture tree so we do not
> claim something missing that actually ships.

---

## 1. Executive summary

**What Aperture's UI is today.** A renderer-independent, ECS-native, WebGPU
screen-space UI. UI is authored as ECS components (`UiScreen`, `UiNode`,
`UiPanel`, `UiImage`, `UiText`, `UiHitTarget`, `UiScroll`), laid out by a
worker-safe retained-layout pass (`packages/render/src/rendering/extraction-ui.ts`),
serialized into a transferable `RenderSnapshot`, and drawn by three WebGPU
pipelines (panel, image, MSDF text). Layout is **absolute / row / column** flow
with padding, gap, z-index, opacity inheritance, and rect-intersection clipping.
Text is **MSDF** with kerning, letter spacing, line height, greedy word-wrap, and
left/center/right alignment. Interaction is a unified per-frame driver that
hit-tests UI rects (with clip + priority), fires `enter/leave/down/up/click/drag`
handlers, drives clamped wheel/drag scrolling, and lets UI hits block the 3D
picking ray. It is deterministic and runs on the simulation worker.

**What uikit is.** A flexbox UI library that renders **real three.js meshes**
inside the 3D scene, authored declaratively in React (`@react-three/uikit`) or
imperatively in vanilla three.js (`@pmndrs/uikit`, full parity). Layout is the
**full Yoga flexbox** model. It ships rich CSS-aligned styling (per-corner
border-radius, per-side borders, conditional `hover`/`active`/`focus`/`dark`
styles, Tailwind-style responsive breakpoints), a complete primitive set
(`Container`, `Text`, `Image`, `Video`, `Input`/`Textarea`, `Svg`, `Content`
for embedding 3D, `Fullscreen`, `Portal`), auto-rendered styleable scrollbars,
text editing, and two shadcn-style component kits (default + horizon). It is
WebGL-only (custom GLSL `ShaderMaterial`) and runs on the main thread.

**Headline verdict.** Aperture's UI is an **engine-grade foundation** —
architecturally cleaner than uikit (WebGPU-native, ECS/data-oriented,
worker-safe, deterministic, framework-agnostic, with unified 2D/3D
interaction) — but **far behind in product surface**. It is roughly a
"HUD/overlay toolkit" today, where uikit is a "build any app UI" toolkit. The
gap is not in the rendering substrate (both batch quads and antialias text); it
is in the **layout engine (no real flexbox), styling (no borders/radius/
conditional styles), and components (no text input, scrollbars, or prebuilt
widgets)**. Closing the layout + styling + input gaps would move Aperture from
"HUDs" to "applications" without changing its architecture.

---

## 2. Capability scorecard

| Dimension               | Standing vs uikit          | One-line takeaway                                                                                                                |
| ----------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Primitives & Components | 🔴 Behind                  | Panel/Image/Text/Scroll only; no Video, Svg, Input, 3D-embed, Portal.                                                            |
| Layout Engine           | 🔴 Far behind              | Absolute/row/column vs uikit's full Yoga flexbox (grow/shrink/wrap/justify/align/margin/%/aspect).                               |
| Visual Styling          | 🟠 Behind                  | Solid color + texture + opacity; no border-radius, borders, or conditional/responsive styles. (Both lack gradients/shadow/blur.) |
| Text & Typography       | 🟡 Near parity (core)      | Strong MSDF core; missing font weights/families, justify, vertical-align, editing.                                               |
| Interaction & Input     | 🟠 Behind                  | Solid events + scroll; **no text input** and **no rendered scrollbars**; no conditional state styling.                           |
| Rendering & Performance | 🟢 **Ahead**               | WebGPU-native + instanced/clipped/AA; uikit is WebGL-only and can't use WebGPURenderer.                                          |
| Animation & Transitions | 🟡 Near parity (both weak) | Neither has declarative transitions; uikit's signals make per-frame animation more ergonomic.                                    |
| Theming & Prebuilt Kits | 🔴 Far behind              | uikit ships 2 kits (24 + 14 components) + theming + CLI; Aperture ships none.                                                    |
| Authoring & Integration | 🟢/🔴 Mixed                | Aperture wins on ECS/worker/determinism/no-React; uikit wins on flexbox DX, world-space panels, ecosystem.                       |

Legend: 🟢 Aperture ahead · 🟡 at/near parity · 🟠 behind · 🔴 far behind.

---

## 3. Dimension-by-dimension analysis

Cells: ✅ full · 🟡 partial · ❌ none. "Gap" rates the severity **for Aperture**
(critical/major/minor), or marks an **Aperture advantage**.

### 3.1 Primitives & Components

| Capability                | Aperture | uikit | Gap          | Notes                                                                                                                             |
| ------------------------- | -------- | ----- | ------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Container / layout node   | ✅       | ✅    | none         | `UiNode` (`authoring-components-core.ts:196`) ≈ uikit `Container`.                                                                |
| Panel / rectangle         | ✅       | ✅    | none         | `UiPanel` solid color quad.                                                                                                       |
| Image                     | 🟡       | ✅    | minor        | `UiImage` is a textured quad with `uvRect`; uikit `Image` adds `src` loading, `objectFit`, auto aspect-ratio.                     |
| Text                      | ✅       | ✅    | none         | `UiText` MSDF (see §3.4).                                                                                                         |
| Text input / editable     | ❌       | ✅    | **critical** | uikit `Input`/`Textarea` (value, caret, selection, keyboard). Aperture has nothing.                                               |
| Video                     | ❌       | ✅    | minor        | uikit `Video` (MediaStream, volume/loop/etc.).                                                                                    |
| SVG / vector icons        | ❌       | ✅    | minor        | uikit `Svg` (`src`/inline `content`).                                                                                             |
| Embed 3D object in flow   | ❌       | ✅    | major        | uikit `Content` lays out arbitrary three.js objects inside flexbox with `depthAlign`. No Aperture analog.                         |
| Render-to-texture portal  | ❌       | ✅    | minor        | uikit `Portal`.                                                                                                                   |
| Fullscreen / overlay root | 🟡       | ✅    | minor        | `UiScreen` is the screen root; uikit `Fullscreen` auto-binds to viewport (Aperture's `Viewport` scale mode is a stub — see §3.9). |
| List / virtualization     | ❌       | ❌    | none         | Neither ships a virtualization primitive.                                                                                         |

**Verdict.** Aperture covers the three irreducible primitives (box, image, text)
plus a hit target and scroll marker, which is enough for HUDs. uikit's primitive
_set_ is broader and more "app-like": editable inputs, video, SVG, embedded 3D
content, and portals. The most consequential missing primitive is **text input**
(critical for any interactive form/app); embedding 3D objects into UI flow
(`Content`) is the most architecturally interesting gap.

### 3.2 Layout Engine

| Capability                                  | Aperture | uikit | Gap          | Notes                                                                              |
| ------------------------------------------- | -------- | ----- | ------------ | ---------------------------------------------------------------------------------- |
| Absolute positioning                        | ✅       | ✅    | none         | `UiNode.x/y` + `layoutMode:"absolute"`.                                            |
| Row / column flow                           | ✅       | ✅    | none         | `UiLayoutMode.Row/Column` with cursor advance (`extraction-ui.ts:205`).            |
| `flexDirection` (4-way)                     | 🟡       | ✅    | minor        | Aperture has row/column but no `row-reverse`/`column-reverse`.                     |
| `flexGrow` / `flexShrink` / `flexBasis`     | ❌       | ✅    | **critical** | No flex factors; children take fixed/fallback sizes only (`extraction-ui.ts:237`). |
| `flexWrap`                                  | ❌       | ✅    | **critical** | Single-line flow only.                                                             |
| `justifyContent`                            | ❌       | ✅    | **critical** | No main-axis distribution (start only).                                            |
| `alignItems` / `alignSelf` / `alignContent` | ❌       | ✅    | **critical** | No cross-axis alignment.                                                           |
| `gap` (incl. row/column)                    | 🟡       | ✅    | minor        | Single `gap` scalar; uikit has `gapRow`/`gapColumn`.                               |
| Padding (per-side)                          | ✅       | ✅    | none         | `UiNode.padding` Vec4.                                                             |
| Margin (per-side, `auto`)                   | ❌       | ✅    | major        | No margins at all; only padding.                                                   |
| `position` relative/absolute + `inset`      | 🟡       | ✅    | major        | Absolute offset exists; no `inset`/relative-flow offset semantics.                 |
| Width / height                              | ✅       | ✅    | none         | Fixed pixels (`UiNode.width/height`).                                              |
| min/max width/height                        | ❌       | ✅    | major        | None.                                                                              |
| Percentage sizing                           | ❌       | ✅    | major        | Pixel-only; no `%`.                                                                |
| `aspectRatio`                               | ❌       | ✅    | major        | None.                                                                              |
| Overflow / clipping                         | ✅       | ✅    | none         | `clip` flag → rect intersection (`extraction-ui.ts:268`).                          |
| z-index ordering                            | ✅       | ✅    | none         | `UiNode.zIndex` + render-order sort (`extraction-ui.ts:462`).                      |

**Verdict.** This is the **single biggest gap**. Aperture ships a deliberately
minimal "absolute/row/column fallback" (the component doc literally says it
precedes "a richer Taffy-compatible adapter," `authoring-components-core.ts:215`).
uikit ships the **complete Yoga flexbox model**. Without grow/shrink/wrap/justify/
align/margin/min-max/%/aspect, you cannot express responsive or content-driven
layouts — every box must be hand-sized in pixels. Everything else in this audit
is downstream of fixing this: a real constraint-solving layout pass is the
foundation a styling/component layer would build on.

### 3.3 Visual Styling

| Capability                                     | Aperture | uikit | Gap          | Notes                                                                                                 |
| ---------------------------------------------- | -------- | ----- | ------------ | ----------------------------------------------------------------------------------------------------- |
| Background color (RGBA)                        | ✅       | ✅    | none         | `UiPanel.color`.                                                                                      |
| Image tint / color mul                         | ✅       | ✅    | none         | `UiImage.color` multiplies the sample (`ui-quad-pipeline.ts:135`).                                    |
| Element opacity (inherited)                    | ✅       | ✅    | none         | `UiNode.opacity`, composed down-tree (`extraction-ui.ts:282`).                                        |
| Border radius (per-corner)                     | ❌       | ✅    | **critical** | uikit does SDF rounded corners with AA; Aperture quads are hard rectangles.                           |
| Borders (per-side width + color)               | ❌       | ✅    | major        | uikit `borderWidth`/`borderColor`/`borderBend`. Aperture has none.                                    |
| `objectFit` for images                         | 🟡       | ✅    | minor        | Aperture uses manual `uvRect`; uikit `cover`/`fill` + auto aspect.                                    |
| Conditional styling (`hover`/`active`/`focus`) | ❌       | ✅    | major        | uikit swaps props per state. Aperture exposes _events_ but no declarative state styling.              |
| Responsive breakpoints (`sm/md/lg`)            | ❌       | ✅    | major        | uikit Tailwind-style; Aperture none.                                                                  |
| Dark mode                                      | ❌       | ✅    | minor        | uikit `dark` conditional + color-scheme globals.                                                      |
| Custom panel material                          | 🟡       | ✅    | minor        | Aperture has custom-WGSL materials for meshes but not wired to UI panels; uikit `panelMaterialClass`. |
| Gradients                                      | ❌       | ❌    | none         | **Neither** ships gradients.                                                                          |
| Box-shadow                                     | ❌       | ❌    | none         | **Neither** (uikit suggests `castShadow`/`receiveShadow` instead).                                    |
| Backdrop / background blur                     | ❌       | ❌    | none         | **Neither**.                                                                                          |

**Verdict.** Aperture can fill rectangles with a color or a texture and fade
them; that is the floor. The decisive gaps are **border-radius** and **borders**
(uikit renders both per-pixel in its instanced SDF panel shader, with `fwidth`
antialiasing) and **conditional/responsive styling**. Notably, uikit _also_
lacks gradients, box-shadow, and backdrop blur, so those are **not** Aperture
disadvantages — both libraries push those to images/custom materials. The
rounded-corner shader is the highest-value single styling feature to add.

### 3.4 Text & Typography

| Capability                  | Aperture | uikit | Gap   | Notes                                                                         |
| --------------------------- | -------- | ----- | ----- | ----------------------------------------------------------------------------- |
| MSDF text rendering         | ✅       | ✅    | none  | `msdf-font-atlas.ts` + `msdf-text-pipeline.ts`.                               |
| Font size                   | ✅       | ✅    | none  | `UiText.fontSize`.                                                            |
| Line height                 | ✅       | ✅    | none  | `UiText.lineHeight`.                                                          |
| Letter spacing              | ✅       | ✅    | none  | `layoutMsdfText` `letterSpacing` (`msdf-font-atlas.ts:415`).                  |
| Kerning                     | ✅       | ✅    | none  | Kerning table applied per-glyph (`msdf-font-atlas.ts:435`).                   |
| Word wrap (`maxWidth`)      | ✅       | ✅    | none  | Greedy wrap (`msdf-font-atlas.ts:468`).                                       |
| Align left/center/right     | ✅       | ✅    | none  | `UiTextAlign`.                                                                |
| Align `justify`             | ❌       | ✅    | minor | uikit adds justify.                                                           |
| Vertical align              | ❌       | ✅    | minor | uikit `verticalAlign` top/center/bottom.                                      |
| `wordBreak` modes           | 🟡       | ✅    | minor | Aperture wraps on whitespace only; uikit `break-word`/`break-all`/`keep-all`. |
| Font families / weights     | ❌       | ✅    | major | Aperture binds one atlas per `UiText`; uikit `fontFamilies`/`fontWeight`.     |
| Runtime TTF→MSDF generation | ❌       | 🟡    | minor | uikit converts TTF at runtime (WASM); Aperture needs pre-baked atlases.       |
| Font fallback chain         | ❌       | ❌    | none  | Neither documents automatic glyph fallback.                                   |
| Rich / nested inline text   | ❌       | 🟡    | minor | uikit composes inline `<Text>` runs; Aperture is one run per node.            |
| Text selection / caret      | ❌       | ✅    | major | uikit (via `Input`); tied to editing.                                         |

**Verdict.** This is Aperture's **strongest** dimension — the MSDF core
(kerning, letter spacing, line height, wrap, alignment) is genuinely at parity
with uikit's typography for static text. The gaps are about _range_, not
_foundation_: multiple font families/weights, justify + vertical alignment,
richer word-breaking, and (coupled to the input gap) selection/caret. A font
family/weight registry and a `verticalAlign`/`justify` pass are small, contained
additions on top of the existing layout engine.

### 3.5 Interaction & Input

| Capability                               | Aperture | uikit | Gap                    | Notes                                                                                                                                  |
| ---------------------------------------- | -------- | ----- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Pointer enter/leave/down/up/click        | ✅       | ✅    | none                   | `interaction/access.ts:30‑54`.                                                                                                         |
| Drag (start/move/end)                    | ✅       | ✅    | none                   | `access.ts:55` + state machine in `pointer-events.ts`.                                                                                 |
| Hit testing with clip + priority         | ✅       | ✅    | none                   | `ui-hit-test.ts:35`.                                                                                                                   |
| Cursor control                           | ✅       | ✅    | none                   | `UiHitTarget.cursor`.                                                                                                                  |
| UI hit blocks 3D pick                    | ✅       | 🟡    | **Aperture advantage** | Unified 2D/3D driver: UI `blocksInput` short-circuits the scene raycast (`interaction/system.ts:55`). uikit relies on R3F event order. |
| Layer-masked UI interaction              | ✅       | ❌    | **Aperture advantage** | Per-camera `layerMask` routing on screens/hits.                                                                                        |
| Scroll via wheel + drag (clamped)        | ✅       | ✅    | none                   | `ui-scroll.ts:61`; deterministic, clamped to content.                                                                                  |
| Rendered scrollbars (styleable)          | ❌       | ✅    | major                  | uikit auto-renders + styles scrollbars; Aperture has offset logic but **no visible scrollbar**.                                        |
| Scroll inertia/momentum                  | ❌       | 🟡    | minor                  | Aperture intentionally omits inertia for determinism; uikit unconfirmed.                                                               |
| Text input / keyboard editing            | ❌       | ✅    | **critical**           | No editable text path at all.                                                                                                          |
| Conditional hover/active/focus _styling_ | ❌       | ✅    | major                  | Events exist, but no built-in "restyle on hover."                                                                                      |
| Event propagation / stopPropagation      | 🟡       | ✅    | minor                  | Aperture handlers are flat per-entity; uikit inherits R3F bubbling/capture.                                                            |

**Verdict.** The interaction _substrate_ is solid and in places **better** than
uikit — the same per-frame driver hit-tests UI and the 3D scene, with UI able to
block scene picks and layer masks routing input per camera; that unified model is
a real Aperture advantage for games. The product gaps are **text input**
(critical), **rendered scrollbars** (the offset math exists; only the thumb/track
visuals and styling are missing), and **declarative state styling** (turning the
existing `onEnter`/`onLeave` into a `hover={…}` restyle).

### 3.6 Rendering & Performance

| Capability                 | Aperture  | uikit    | Gap                    | Notes                                                                                                    |
| -------------------------- | --------- | -------- | ---------------------- | -------------------------------------------------------------------------------------------------------- |
| GPU backend                | ✅ WebGPU | 🟡 WebGL | **Aperture advantage** | uikit's GLSL `ShaderMaterial` is not WebGPURenderer-compatible; no `/webgpu`/TSL export.                 |
| Instanced / batched quads  | ✅        | ✅       | none                   | Aperture packs panels/images into storage-buffer instances (`app/ui.ts`); uikit instances panels.        |
| Draw-call minimization     | ✅        | ✅       | none                   | Both collapse many boxes into few draws (per pipeline / per material+font).                              |
| Per-pixel clipping         | ✅        | ✅       | none                   | Aperture discards outside `clipRect` in WGSL (`ui-quad-pipeline.ts:95`); uikit uses up-to-4 clip planes. |
| Antialiased rounded edges  | ❌        | ✅       | major                  | Coupled to border-radius (§3.3); uikit `fwidth`/`smoothstep` SDF AA.                                     |
| z-order / render order     | ✅        | ✅       | none                   | `stackIndex`/`zIndex` sort.                                                                              |
| Depth test/write control   | 🟡        | ✅       | minor                  | Aperture UI is screen-space (depth-compare `always`, no write); uikit exposes `depthTest`/`depthWrite`.  |
| HDR / tonemap-aware output | ✅        | 🟡       | **Aperture advantage** | UI pipeline resolves tonemap/color-space vs the HDR scene buffer (`app/ui.ts:66`).                       |
| Alpha blending             | ✅        | ✅       | none                   | Standard src-alpha over.                                                                                 |
| Custom blend modes for UI  | ❌        | 🟡       | minor                  | Sprites have blend modes; UI quads do not.                                                               |
| Published benchmarks       | ❌        | ❌       | none                   | Neither publishes numbers.                                                                               |

**Verdict.** Rendering is where Aperture is **clearly ahead on substrate**:
WebGPU-native, instanced, per-pixel clipped, HDR/tonemap-aware, and integrated
with a real render graph — while uikit is fundamentally **WebGL-only** (its
ShaderMaterial approach can't move to WebGPURenderer without community forks).
The one rendering _feature_ gap is antialiased rounded-corner/border rasterization,
which is a shader feature, not an architectural limitation — Aperture's panel WGSL
is the natural home for an SDF rounded-rect.

### 3.7 Animation & Transitions

| Capability                        | Aperture | uikit | Gap   | Notes                                                                                                        |
| --------------------------------- | -------- | ----- | ----- | ------------------------------------------------------------------------------------------------------------ |
| Per-frame property animation      | 🟡       | ✅    | minor | Aperture: mutate ECS component values in a system each frame. uikit: mutate a signal each frame.             |
| Reactive value core (signals)     | ❌       | ✅    | major | uikit is built on `@preact/signals-core`; Aperture's reactivity is the ECS itself, not per-property signals. |
| Declarative `transition`/duration | ❌       | ❌    | none  | **Neither** ships CSS-style transitions.                                                                     |
| Easing functions                  | ❌       | ❌    | none  | **Neither** (bring-your-own).                                                                                |
| Springs                           | ❌       | ❌    | none  | **Neither** built-in (uikit users add react-spring).                                                         |
| Tween between hover/active states | ❌       | ❌    | none  | Both swap state instantly.                                                                                   |

**Verdict.** Closer to parity than it first appears — **neither** library has a
declarative transition/easing/spring system; both animate by mutating values per
frame. uikit's edge is ergonomic: its signal core lets a single animated value
drive the UI without React re-renders, whereas Aperture would animate by writing
component values in an ECS system (idiomatic, but more boilerplate, and with no
built-in interpolation helpers). A small UI-tween utility (lerp component values
toward a target over time) would match uikit's practical animation story.

### 3.8 Theming & Prebuilt Kits

| Capability                    | Aperture | uikit | Gap   | Notes                                                                                 |
| ----------------------------- | -------- | ----- | ----- | ------------------------------------------------------------------------------------- |
| Prebuilt component kit        | ❌       | ✅    | major | uikit default kit (24 shadcn-style: Button, Card, Tabs, Checkbox, Slider, Dialog, …). |
| Second design kit             | ❌       | ✅    | minor | uikit horizon kit (14, Meta-Horizon-style; replaced legacy apfel).                    |
| Variants / sizes              | ❌       | ✅    | minor | uikit `variant`/`size` props on widgets.                                              |
| Theming tokens / color scheme | ❌       | ✅    | major | uikit `colors`, `StyleSheet`/`classList`, `setGlobalProperties`, dark/light globals.  |
| Component-add CLI             | ❌       | ✅    | minor | `npx uikit component add <kit> <Component>` copies source in (shadcn model).          |
| Figma / HTML→UI conversion    | ❌       | ❌    | none  | No first-party converter on either side (uikit only _references_ Figma design sets).  |

**Verdict.** uikit is **far ahead** here, and this is the most _visible_ gap to a
developer evaluating both: you can `npm i @react-three/uikit-default` and drop in
a styled Button/Dialog/Slider, whereas in Aperture every widget is hand-assembled
from `UiNode`+`UiPanel`+`UiText`+`UiHitTarget`. This gap, however, is **derivative**
— a kit is only worth building once the layout (§3.2) and styling (§3.3) primitives
can express buttons/cards/sliders cleanly. It is correctly the last thing to do,
not the first.

### 3.9 Authoring Model & Integration

| Capability                      | Aperture | uikit | Gap                    | Notes                                                                                                      |
| ------------------------------- | -------- | ----- | ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| ECS / data-oriented authoring   | ✅       | ❌    | **Aperture advantage** | UI is plain components in the same world as gameplay.                                                      |
| Worker-thread / deterministic   | ✅       | ❌    | **Aperture advantage** | Layout + interaction run on the sim worker; uikit is main-thread only.                                     |
| Renderer-independent UI model   | ✅       | ❌    | **Aperture advantage** | UI extracts to a transferable snapshot; the renderer never owns UI state.                                  |
| No framework dependency         | ✅       | 🟡    | **Aperture advantage** | uikit core is vanilla, but the ecosystem/kits are React/R3F-centric.                                       |
| Declarative React/JSX authoring | ❌       | ✅    | major                  | uikit's `<Container>/<Text>` JSX DX is a major productivity edge.                                          |
| Vanilla imperative API          | ✅       | ✅    | none                   | Both offer non-React authoring.                                                                            |
| World-space 3D UI panels        | ❌       | ✅    | major                  | uikit UI is scene geometry → diegetic/world-space panels for free. Aperture UI is screen-space only.       |
| Screen-space overlay            | ✅       | ✅    | none                   | `UiScreen`; uikit `Fullscreen`.                                                                            |
| Responsive viewport scaling     | ❌       | ✅    | major                  | `UiScreenScaleMode.Viewport` is **defined but never read** by the layout/render path — effectively a stub. |
| Ecosystem maturity / docs       | 🟡       | ✅    | major                  | uikit: ~3.2k★, stable v1.0, structured docs, Svelte/Threlte binding. Aperture UI is young (v0.2).          |

**Verdict.** A genuine **split decision**. Aperture's authoring _architecture_
is better for an engine: UI is ECS data in the authoritative world, laid out and
hit-tested on the worker, deterministically, with the renderer as a pure
consumer, and no React lock-in. uikit's authoring _experience_ is better for
shipping app UI: declarative JSX, world-space diegetic panels as a side effect of
being scene geometry, working responsive breakpoints, and a mature ecosystem. Two
concrete near-term items stand out: implement the already-declared
`Viewport`/responsive scaling (today a stub), and decide whether Aperture wants
**world-space 3D UI panels** (uikit gets these for free; Aperture's screen-space
snapshot model would need an explicit world-anchored screen).

---

## 4. Aperture's structural advantages

These are not "nice to haves" — they are places where Aperture's architecture is
**ahead of uikit by design**, and they should be protected as the UI grows:

1. **WebGPU-native.** Aperture's UI runs in the same WebGPU render graph as the
   scene, HDR/tonemap-aware (`packages/webgpu/src/app/ui.ts:66`). uikit is
   **structurally WebGL-bound**: its GLSL `ShaderMaterial` panel cannot run under
   three.js `WebGPURenderer` without community forks. As the ecosystem moves to
   WebGPU, this inverts — uikit must port; Aperture is already there.
2. **ECS / data-oriented.** UI is ordinary component data in the authoritative
   world, queryable and mutable by gameplay systems, with no separate retained
   widget tree to keep in sync.
3. **Worker-safe + deterministic.** Layout (`extraction-ui.ts`) and interaction
   (`interaction/system.ts`, `ui-scroll.ts`) run headless on the sim worker and
   are deterministic (scroll deliberately omits inertia for replay). uikit runs
   on the main thread and ties into React reconciliation.
4. **Renderer-independent snapshot.** UI serializes to a transferable
   `RenderSnapshot` (`UiNodePacket`/`UiHitRegionPacket`); the renderer is a pure
   consumer and never owns UI state. This is the boundary that makes worker UI
   and deterministic replay possible.
5. **Unified 2D/3D interaction.** One driver hit-tests UI and the 3D scene in the
   same frame; UI can block scene picks (`interaction/system.ts:55`) and input is
   layer-masked per camera — a cleaner model than overlaying two event systems.

---

## 5. Prioritized gap roadmap

Grouped by leverage. Each item notes the Aperture insertion point.

### P0 — Table stakes for interactive application UI

| Gap                                                                                             | Why                                                                      | Where it lands                                                                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Real flexbox layout** (grow/shrink/basis, wrap, justify, align\*, margin, min/max, %, aspect) | Everything else is downstream; without it every box is hand-sized in px. | Replace the absolute/row/column pass in `extraction-ui.ts` with a constraint solver. The component doc already anticipates "a richer Taffy-compatible adapter" (`authoring-components-core.ts:215`) — port/wrap a worker-safe Yoga/Taffy and feed it the `UiNode` tree. Extend `UiNodeInput`/schema with the new fields. |
| **Border-radius + borders**                                                                     | The most-felt visual gap; required to render any modern button/card.     | Add `borderRadius`/`borderWidth`/`borderColor` to `UiNode`/`UiPanel`; implement an SDF rounded-rect with `fwidth` AA in `ui-quad-pipeline.ts` (extend `UiQuadData`).                                                                                                                                                     |
| **Text input** (`UiInput`: value, caret, selection, keyboard)                                   | Blocks all forms/auth/settings UI.                                       | New `UiInput` component + editing state; reuse `layoutMsdfText` for caret/selection geometry; route keyboard through the interaction driver.                                                                                                                                                                             |
| **Rendered scrollbars**                                                                         | Scroll _math_ already exists; users can't see/grab it.                   | The hard part (`ui-scroll.ts` clamped offsets, content extent) is done — add thumb/track quads from `computeMaxScroll` output and `scrollbar*` styling.                                                                                                                                                                  |

### P1 — Important for parity

| Gap                                                      | Why                                                                      | Where it lands                                                                                                                                      |
| -------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Conditional state styling** (`hover`/`active`/`focus`) | Events exist; declarative restyle does not.                              | Layer a per-state property override on top of the existing `onEnter`/`onLeave`/`onDown` signals; resolve final values during extraction.            |
| **Responsive scaling / breakpoints**                     | `UiScreenScaleMode.Viewport` is declared but **never read** — finish it. | Wire `Viewport` scale mode into `extraction-ui.ts`/`app/ui.ts` (it is currently inert), then add Tailwind-style breakpoints keyed off screen width. |
| **Font families / weights + justify/vertical-align**     | Typography range.                                                        | Add a family/weight registry (multiple atlases per logical font) and `verticalAlign`/`justify` to `layoutMsdfText`.                                 |
| **UI tween utility**                                     | Match uikit's practical animation ergonomics.                            | A small system that lerps `UiNode`/color values toward a target over time; pairs with state styling for hover transitions.                          |

### P2 — Breadth / ecosystem

| Gap                                                        | Why                                | Where it lands                                                                                        |
| ---------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Prebuilt component kit**                                 | Drop-in Button/Card/Slider/Dialog. | Only worth it after P0/P1; build as authored ECS prefabs over the new primitives.                     |
| **Richer primitives** (`Video`, `Svg`, 3D-embed/`Content`) | Broader app surface.               | `Video`/`Svg` as new image-like components; 3D-embed needs UI-rect→world placement of scene entities. |
| **World-space 3D UI panels**                               | Diegetic UI; uikit gets this free. | Requires a world-anchored `UiScreen` variant whose snapshot rect maps into 3D, not the framebuffer.   |
| **objectFit / image loading ergonomics**                   | Convenience over manual `uvRect`.  | Add `objectFit` cover/fill + auto aspect to `UiImage`.                                                |

---

## 6. Bottom line

Aperture's UI has a **better foundation than uikit and a much smaller feature
set**. The substrate — WebGPU rendering, ECS authoring, worker-safe deterministic
layout/interaction, renderer-independent snapshots, unified 2D/3D picking — is
genuinely ahead of uikit's WebGL/main-thread/React-coupled model, and the MSDF
text core is already at parity. What's missing is the middle layer that turns a
HUD toolkit into an application toolkit: a **real flexbox layout engine**,
**rounded/bordered styling**, and **text input + visible scrollbars**. None of
these require changing Aperture's architecture; they slot into the existing
`extraction-ui.ts` layout pass and `ui-quad-pipeline.ts` shader.

The single highest-leverage next step is **replacing the absolute/row/column pass
with a true constraint-based flexbox solver** (the codebase already names this as
the intended "Taffy-compatible adapter"). Everything else in the roadmap —
styling, components, kits, responsive design — is far cheaper to build once
content-driven layout exists.
