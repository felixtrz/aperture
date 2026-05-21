# Future optimizations — GPU pipeline-level

Status: not currently in the roadmap. Captured from conversation on 2026-05-20 for future revisiting.

These are render-pipeline-level optimizations that don't fit the other categories. They share a common shape: each adds a new caching or pre-computation layer between the snapshot and the GPU command buffer.

## 1. Z-prepass for early-Z rejection

**What:** Render the scene's depth (only) in a first pass before the main color pass. The main pass then renders with depth-equal testing — every pixel that would have been overdrawn gets early-rejected by the GPU's depth test before the fragment shader runs.

**Why it'd matter:** Scenes with expensive fragment shaders (PBR + IBL + shadows is genuinely costly per fragment) and significant overdraw. The depth prepass is cheap (no fragment work), and it can save more in the color pass than it costs.

**What it'd take:** A new pass between shadow passes and the main color pass. Depth-only pipeline variant for each material (essentially what the shadow caster pipeline already does, but writing to the main depth buffer). Main color pass changes its depth state from `less` to `equal` and disables depth writes.

**Trigger condition:** When the GPU profiler (Tier 4) shows >30% overdraw on a fragment-heavy scene. Easier to add later than to retrofit other rendering when you discover you need it. Common in deferred-style renderers and high-end PBR forward renderers.

**Trade-off:** Only wins when fragment work dominates. For simple scenes (unlit, low-cost shaders), the prepass cost exceeds the savings. Should be opt-in via a render-config flag, not always-on.

**Reference anchors when implemented:**

- `references/engine/src/scene/renderer/shadow-renderer.js` for the depth-only pipeline pattern
- `references/bevy/crates/bevy_core_pipeline/src/prepass/` if present — Bevy's prepass node
- Three.js doesn't have a built-in prepass; some apps roll their own via render targets

## 2. Pipeline cache warming / prediction

**What:** Today, pipelines are created on first use — the first frame a material+config appears, the renderer pays ~5ms creating the `GPURenderPipeline`. For complex scenes loaded from glTF, the first 30+ frames can hitch as new pipelines are created in succession. Pipeline warming pre-creates pipelines at asset-load time, before they're first drawn.

**Why it'd matter:** First-frame stutter on glTF viewer loads. User loads a model with 12 materials; first time each material draws, a pipeline is compiled, frame takes 5-60ms. Subsequent frames are fast. Warming hides this.

**What it'd take:** At asset-load time (in the GLB loader or asset registration path), inspect each material's required pipeline-key features, request the corresponding pipeline from the cache. Pipelines compile asynchronously via `device.createRenderPipelineAsync()` so the warm phase doesn't block. Once warm, draws hit cached pipelines from frame 1.

**Trigger condition:** First-frame stutter becomes a visible UX issue in the glTF viewer. Already mildly visible today on first load of a multi-material `.glb`. Probably worth doing alongside any future "loading indicator" UX work.

**Trade-off:** Warming wastes compile cost on pipelines you may never draw (e.g., a material whose entity is culled). Mitigated by only warming pipelines for assets that have at least one referencing entity.

**Reference anchors when implemented:**

- `references/three.js/src/renderers/common/PipelineCache.js` for cache-management patterns
- `references/engine/src/platform/graphics/webgpu/webgpu-shader.js` — PlayCanvas's async shader compile
- WebGPU spec: `GPUDevice.createRenderPipelineAsync`

## 3. Render bundles for static command sequences

**What:** `GPURenderBundle` is a WebGPU feature that pre-records a sequence of draw commands (setPipeline, setBindGroup, draw, etc.) into a reusable command bundle. The bundle can be encoded into multiple render passes without re-recording. For scene sections that don't change frame-to-frame, this skips the per-frame encode cost.

**Why it'd matter:** Scenes with large mostly-static portions (architectural visualization, terrain) where the same draws happen every frame. The CPU cost of `pass.setPipeline` / `pass.setBindGroup` / `pass.drawIndexed` for those entities is repeated every frame even though the commands are identical.

**What it'd take:** Detect "stable runs" of draw records (entities whose pipeline/bindings/draw params haven't changed in N frames). Record those into a `GPURenderBundle`. Replace per-frame encoding for those entities with `pass.executeBundles([bundle])`. Invalidate the bundle if any record in the run changes.

**Trigger condition:** When CPU encode time becomes the bottleneck, especially in scenes with thousands of stable draws. Less common than transform-upload bottlenecks; usually the snapshot is where the CPU spends its time, not the encode.

**Trade-off:** Bundle invalidation logic is genuinely tricky. The whole bundle has to be re-recorded if any of its draws change — so partial dirtying is expensive. Best for scenes with cleanly-separated static and dynamic parts.

**Reference anchors when implemented:**

- `references/three.js/src/renderers/webgpu/utils/` — three.js's WebGPU bundle patterns if present
- `references/engine/src/platform/graphics/webgpu/webgpu-render-pass-encoder.js` — PlayCanvas bundles
- WebGPU spec: `GPURenderBundleEncoder`, `GPURenderPassEncoder.executeBundles`

## Notes on prioritization

These are all later-stage optimizations. The order they'd reasonably get pulled:

1. **Pipeline warming (item 2)** first, because first-frame stutter is a UX issue that's already visible today on the glTF viewer with new assets. Modest implementation cost.
2. **Z-prepass (item 1)** when GPU profiler shows fragment cost dominating. Opt-in flag, not always-on.
3. **Render bundles (item 3)** is the most situational. Only worth it for specific scene shapes (architectural viz, mostly-static terrain). Implementation cost is moderate but the bundle-invalidation logic is fiddly.

None of these unblocks anything else on the roadmap. All three can wait until Tier 4 telemetry tells us they matter.
