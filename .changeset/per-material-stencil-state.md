---
"@aperture-engine/render": minor
"@aperture-engine/webgpu": minor
---

Per-material stencil state (parity plan D1) — the analog of three.js
`Material.stencilWrite` / `stencilFunc` / `stencilRef` / `stencilFuncMask` /
`stencilWriteMask` / `stencilFail` / `stencilZFail` / `stencilZPass`. Stencil
was the one render state explicitly marked unsupported; it is now a per-material
`renderState.stencil` sub-state on EVERY material kind (built-in
`standard`/`unlit`/`matcap`/`debug-normal` and custom WGSL), built with the
ergonomic `createStencilState` factory (three.js-shaped input: face shorthands
apply to both faces, `front`/`back` override per face, masks default to
`0xFFFFFFFF` and the reference to `0`). `unsupportedFeatures` drops `"stencil"`.

PRESENCE of `renderState.stencil` is the enable gate (three.js `stencilWrite:
true`): it appends a single sorted
`stencil:<readMask>:<writeMask>:<reference>:<front…>:<back…>` FEATURE token to
the material pipeline key (the trailing `alphaMode|cullMode|depthCompare|blend`
segment is untouched), so the WebGPU backend reconstructs the full stencil state
from the key exactly as it already does `depth-bias`/`front-face`, and two
materials that differ only in stencil (including the reference) get distinct
pipelines. Materials WITHOUT stencil keep byte-identical pipeline keys, depth
attachments, golden pixels, and determinism fixtures.

WebGPU requires a pipeline's `depthStencil.format` to match the pass's depth
attachment. Aperture selects the format automatically per FRAME: when any
material in the frame enables stencil the whole frame's scene depth attachment
becomes `depth24plus-stencil8` (and every mesh/background/overlay pipeline plus
the render-bundle descriptor follows, via a per-frame
`resourceCache.sceneDepthFormat`), while frames with no stencil keep the
depth-only `depth24plus` — so every pipeline in the pass agrees and non-stencil
frames are unchanged. The stencil `reference` is applied dynamically with
`setStencilReference` on pipeline bind; because a render-bundle encoder cannot
set it, stencil frames take the direct-encoder path. A stencil-capable
attachment also declares the stencil aspect's load/store ops (mirroring depth,
clearing to 0 alongside a depth clear).

Ships two examples with pixel-sampled e2e specs: `examples/stencil-portal` (a
stencil mask stamps a portal region, then full-view content is revealed only
where stencil == the reference) and `examples/stencil-outline` (a base mesh
writes stencil, a scaled copy draws only where stencil != the reference,
producing an outline halo). Validation ships as `material.invalidStencilState`
(out-of-range masks/reference) and `material.stencilRequiresStencilFormat`
(stencil declared against a depth-only attachment — the pipeline is refused
loud-over-silent instead of emitting a WebGPU device error). Advanced-audit
scenario #8 (stencil portal) → ✅ and #7 (planar mirror) → 🟡.
