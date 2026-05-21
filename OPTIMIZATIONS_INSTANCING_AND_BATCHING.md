# Future optimizations — instancing and batching

Status: not currently in the roadmap. Captured from conversation on 2026-05-20 for future revisiting.

These all build on the existing instancing + batching infrastructure (`packages/render/src/rendering/render-queue.ts`, `packages/webgpu/src/webgpu/render-pass-draw-list.ts`). Shipped today: conservative-contiguous coalescing of adjacent records sharing a `BatchCompatibilityKey`, plus opt-in static batching of N meshes sharing pipeline+material.

## 1. Aggressive non-contiguous instancing coalescing

**What:** Today's coalesce only merges records that are _already adjacent after sort_ (`canCoalesceRenderQueueRecord` requires `previous.transformPackedOffset + previous.instanceCount * 16 === record.transformPackedOffset`). If two instance-compatible records have a non-compatible record sandwiched between them, they don't merge.

**Why it'd matter:** Scenes where sort order interleaves different mesh+material combinations (e.g., transparent draws sorted back-to-front by depth, where multiple materials interleave). Today you'd get many small instanced batches instead of two big ones.

**What it'd take:** Pre-group records by `BatchCompatibilityKey` _before_ the painter's sort, then sort within groups. Or: build an instance buffer per group with explicit per-instance transforms (not relying on contiguous packed offsets), so coalesce can pull from anywhere.

**Trigger condition:** When GPU timing data (Tier 4) shows draw-call count is the bottleneck despite the existing conservative coalesce, AND profiling shows sort order is breaking up long compatible runs. Probably matters at 10K+ entities with mixed materials.

**Trade-off:** Aggressive grouping risks reordering and breaking transparent painter's sort order. The conservative version is correct and fast for the common case where authors group renderables sensibly through sort keys.

**Reference anchors when implemented:**

- `references/bevy/crates/bevy_render/src/batching/mod.rs` — Bevy's pre-sort batch preparation
- `references/three.js/src/objects/InstancedMesh.js` — three.js's explicit instance buffer

## 2. Per-instance custom attributes (beyond tint)

**What:** Tier 6 adds `InstanceTint` — a single vec4 per instance. Apps eventually want arbitrary per-instance data: vec3 colors, vec4 user channels, scroll offsets, animation phase, etc.

**Why it'd matter:** Custom shaders that animate per-instance, VFX systems with per-particle properties, vegetation systems where each blade needs its own wind phase. Without this, every per-instance variation forces a different material handle, which breaks instancing.

**What it'd take:** Extend the custom material adapter contract (Tier 5) so custom materials can declare per-instance attribute layouts. Extraction would pack the declared attributes into parallel `Float32Array`s alongside transforms. WebGPU layer would bind them as additional instance-rate vertex buffers.

**Trigger condition:** After Tier 5 lands. The architectural seams are there; this is one or two slices of wiring beyond what Tier 5 already builds. Specifically becomes important when users want to write custom shaders that need per-instance data, or when building particle systems.

**Reference anchors when implemented:**

- `references/three.js/src/core/InstancedBufferAttribute.js`
- `references/bevy/crates/bevy_render/src/extract_instances.rs`

## 3. Indirect drawing for very large scenes

**What:** Use `drawIndexedIndirect` instead of `drawIndexed`. The instance count and parameters live in a GPU buffer that the GPU reads at submission time, rather than CPU passing them per draw call. Enables GPU-driven rendering — culling, instancing decisions, draw count adjustments can happen in compute shaders.

**Why it'd matter:** When CPU encoding becomes the bottleneck. At 10K+ draws per frame with mixed pipelines, the CPU spends real time in the encode loop (setPipeline/setBindGroup/draw). Indirect lets you encode N draws and let the GPU pick which to execute.

**What it'd take:** A new draw-list shape that emits indirect commands instead of direct ones. A compute pass earlier in the frame that writes the indirect buffer (e.g., from a frustum-culling compute shader). Optional but pairs naturally with GPU-side culling.

**Trigger condition:** When GPU timings show >2ms of CPU spent in `pass.drawIndexed`/`pass.setBindGroup` in the main color pass. Unlikely until scenes hit 20K+ draws or you're doing GPU-driven culling.

**Reference anchors when implemented:**

- `references/bevy/crates/bevy_render/src/render_phase/` — Bevy's render-phase indirect support
- WebGPU `drawIndexedIndirect` + `multiDrawIndexedIndirect` (Chrome 126+, opt-in feature) docs

## Notes on prioritization

None of these is a near-term win. Item 2 (per-instance custom attributes) is the most likely first pull because it naturally extends Tier 5/6. Item 1 (aggressive coalescing) only matters once Tier 4 GPU timing data points at draw-call count as a real bottleneck. Item 3 (indirect drawing) is the largest scope and the latest-stage; only meaningful for truly enormous scenes or as the foundation for GPU-driven culling.
