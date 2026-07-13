---
"@aperture-engine/webgpu": minor
"@aperture-engine/app": minor
---

Post-processing tail (parity plan E4) — the analogs of three.js `OutlinePass`,
`MotionBlur`, and `LUTPass` (the postprocessing addon). Three new effects slot
into the ordered `WebGpuPostEffect[]` post stack alongside the existing
bloom/DoF/FXAA/tonemap/SSAO/SSR/TAA, each a self-contained full-screen pass with
per-effect frame-report diagnostics.

**Motion blur** (`createWebGpuMotionBlurPostEffect`). Reads the renderer-owned
per-object motion-vector texture (the same TAA plumbing) and smears each pixel
along its screen-space velocity. Params: `intensity` (velocity multiplier,
clamped [0,8], default 1), `samples` (taps along the velocity vector, [2,32],
default 12), `maxVelocity` (UV-space clamp so a large jump does not sample the
whole screen, (0,0.5], default 0.1). `requiresMotionVectors` turns the
motion-vector attachment on automatically; on a route/frame that cannot produce
motion vectors (MSAA / sprite+skybox packets / missing previous-transform
buffer) it diagnoses `webGpuPostPass.motionVectorTextureUnavailable` and emits no
commands rather than a device error.

**LUT color grade** (`createWebGpuLutColorGradePostEffect`). Applies a 3D color
LUT stored as a 2D N-slice strip (N×N wide by N tall) sampled with trilinear
`textureLoad`. Params: `size` (cube edge N, [2,64], default 16), `data` (RGBA
bytes for the strip, length N·N·N·4; omit for an identity LUT built by
`createIdentityLutStripData`), `intensity` (blend of the graded color over the
original, [0,1], default 1). Mismatched `data` length diagnoses
`webGpuPostPass.lutDataInvalid` and emits no commands.

**Outline** (`createWebGpuOutlinePostEffect`, parity plan E4 AC2). Draws a
colored silhouette ring around the entities the app has SELECTED. The renderer
produces a per-frame `r32uint` selection mask by REUSING the existing ID-buffer
picking pipeline (`renderWebGpuAppOutlineSelectionMask`): the mask stores `1` for
a visible, depth-tested fragment of a selected entity and `0` everywhere else, so
occlusion by unselected geometry is handled by the mask pass's own depth buffer.
The effect edge-detects that mask (a pixel is on the outline when it is not
selected but a neighbor within `thickness` px is) and composites the outline
color over the input. Params: `color` (linear RGB, default orange), `thickness`
(half-width px, [1,8], default 2), `opacity` (ring blend, default 1),
`fillOpacity` (interior tint over the selected surface, default 0 = outline
only). Selection is driven at runtime via a new **`app.setOutlineSelection(entities)`**
(and the live `app.outlineSelection` set) — it accepts `RenderEntityRef`s or raw
stable ids, storing each as a picking stable id (`createStableRenderId`). When no
outline effect is active OR the selection is empty the mask is never rendered
(inert), and when a route supplies no mask the outline effect degrades to an
exact identity copy — so a non-outline frame is byte-identical to a pre-E4 frame.

**Route parity.** The selection mask is rendered on the queued-built-in route
(the route real scenes use) and threaded through
`assembleWebGpuAppFrameBoundaries` → `assembleWebGpuAppPostProcessedSwapchainTarget`
into the effect's `prepare({ selectionMask })` on BOTH the default single-encoder
FrameGraph post path AND the legacy multi-submit post path. The
`app.setOutlineSelection` / `app.outlineSelection` API and the `outline`
frame-report block (`{ selection, maskDrawCalls, ok }`) are new on
`@aperture-engine/webgpu`.

**Generated-app config** (`@aperture-engine/app`). `render.motionBlur`,
`render.lut`, and `render.outline` (each `boolean | {…}`) wire the three effects
into the generated post stack in the order bloom → motion blur → LUT → outline.
All three are LDR-safe, so — unlike bloom — they no longer force the HDR
scene-buffer/exposure path; the exposure gate now keys off `render.bloom`
specifically (previously any post effect forced HDR).

**GTAO deferred (honest deviation).** E4 scoped an optional GTAO integration
upgrade for the SSAO slot. It is **not shipped**: a horizon-based GTAO shader was
prototyped but could not be pixel-proven end-to-end in this environment, so
rather than ship an unverified AO mode the SSAO effect is left **byte-identical**
to its pre-E4 behavior (pinned by a default-pipeline-key literal test) and GTAO
is recorded as a deferred follow-up (see `docs/DECISIONS.md`). The required trio —
outline, motion blur, LUT — ships and is proven.

Ships `examples/post-tail` (a selected target box outlined + LUT-graded next to a
motion-blurred mover, four side-by-side canvases) with a pixel + report e2e:
motion blur smears the mover vs the raw pass, the cool LUT pushes the scene
bluer, and toggling the selection makes the warm outline ring appear
(selected) / vanish (deselected, selection count → 0). Limitations (honest):
outline picking supports rigid, unmorphed, triangle-list mesh draws (skinned /
morphed / non-triangle selections produce no mask and degrade to identity); the
outline is a single global color/thickness per effect (no per-entity styling);
motion blur is a single-direction velocity smear (no tile-max dilation); the LUT
is a lite 2D-strip 3D LUT (no `.cube` file parsing).
