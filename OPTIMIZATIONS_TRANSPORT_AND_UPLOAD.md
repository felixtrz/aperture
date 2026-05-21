# Future optimizations — transport and buffer uploads

Status: not currently in the roadmap. Captured from conversation on 2026-05-20 for future revisiting.

The roadmap already covers two transport layers: Tier 7 (worker-by-default + transferable typed arrays) and Tier 8 (opt-in SharedArrayBuffer). Both still upload the entire `transforms` Float32Array every frame. These notes capture the next-level optimizations that build on top of those tiers.

## 1. Dirty-range transform upload

**What:** Currently `device.queue.writeBuffer(transformsBuffer, 0, snapshot.transforms)` uploads the entire packed transforms array every frame, even when only a few entities moved. WebGPU supports partial writes: `device.queue.writeBuffer(buffer, dstOffset, source, srcOffset, size)`. Combine that with per-entity version tracking (already shipped in task-3011/3012) to upload only the slots that changed.

**Why it'd matter:** Open-world scenes with thousands of mostly-static decorations and a few moving characters. Editor scenes where the user is dragging one object. Particle systems where only the active subset changes.

**What it'd take:** Bookkeeping to map snapshot transform slots → entities (already implicit in the offset table), and a dirty-range computation that walks per-entity versions to produce contiguous run-length ranges. Then batched `writeBuffer` calls for those ranges only, with a heuristic fallback to full-upload when >10% of entities changed (avoids many-tiny-writes overhead).

**Trigger condition:** When GPU profiler (Tier 4) shows `writeBuffer` taking >1ms on a target scene. Likely at 10K+ entities where the full upload is 640KB+ per frame and the active subset is small.

**Trade-off:** Per-`writeBuffer` driver overhead. Many small writes can be slower than one big write. The crossover point is roughly 10% dirty → many small wins, >10% → one big wins. Implementation needs a smart dispatcher.

**Reference anchors when implemented:**

- WebGPU spec: `GPUQueue.writeBuffer` partial-write semantics
- `references/engine/src/platform/graphics/webgpu/webgpu-graphics-device.js` — PlayCanvas's per-frame buffer write patterns

## 2. Persistent SAB-backed transforms with dirty-range upload (the combo)

**What:** Combine three already-roadmapped or shipped pieces into the engine-grade endgame:

1. ECS per-entity version tracking (task-3011, ✅ shipped)
2. SAB-backed transforms (Tier 8, task-3037)
3. Dirty-range upload (item 1 above)

Worker writes transforms directly into the SAB-backed `Float32Array`. Worker also writes "I changed slots X-Y this frame" into a parallel dirty-range descriptor (a small `Uint32Array` of [offset, length] pairs). Main thread reads the dirty-range descriptor, calls `writeBuffer` only on those slices, never copies the full transforms array.

**Why it'd matter:** Closes the entire transforms data path to zero unnecessary work. No CPU copy on extraction (worker writes in-place). No transport copy (SAB is shared memory). No GPU upload of unchanged data (dirty-range upload). Theoretical minimum cost for "ECS write → GPU buffer."

**What it'd take:** All three prerequisites must ship first. Then a new `SnapshotTransformsTransport` abstraction that wraps the SAB allocation + dirty-range descriptor + writeBuffer dispatcher. Replaces today's monolithic `device.queue.writeBuffer(buf, 0, transforms)` with a `transport.flushDirtyRanges(buf)` call.

**Trigger condition:** After Tier 8 SAB transport lands AND GPU profiler shows the SAB-mode transport is still spending non-trivial time on the writeBuffer call (likely at 50K+ entities).

**Status note:** This is the architectural ceiling. Beyond this point, transforms transport is effectively free and further optimization has to come from elsewhere (cache coherency, GPU-side culling, etc.).

**Reference anchors when implemented:**

- `references/bevy/crates/bevy_render/src/render_resource/` — Bevy's persistent GPU buffer patterns
- WHATWG `SharedArrayBuffer` + `Atomics` for the synchronization primitives

## 3. Partial uploads for other per-frame buffers

**What:** The transforms array isn't the only thing uploaded every frame. View matrices (`snapshot.viewMatrices`), light data (extracted lights), and material uniform buffers also get full-rewrites today. The same dirty-tracking discipline could apply.

**Why it'd matter:** Less by itself (these buffers are much smaller than transforms — typically <2KB even for many lights). But once the infrastructure for dirty-range tracking exists for transforms, applying it to the other buffers is essentially free.

**What it'd take:** Per-buffer dirty-range tracking. View matrices change only when cameras change. Light data changes only when lights change. Material uniforms change only when material parameters mutate (rare). All cheap to track if you already have per-entity versioning.

**Trigger condition:** Mostly a code-cleanup follow-up to item 1 — once dirty-range upload exists for transforms, applying it elsewhere is consistency work, not a new optimization.

## Notes on prioritization

Item 1 (dirty-range transform upload) is the next real win after Tier 8 lands. Item 2 (the SAB combo) is the architectural endgame — worth pursuing when scale demands it. Item 3 is consistency, not a new perf opportunity.

For the current target scale (≤5K entities), the existing full-upload approach is fine — sub-millisecond per frame, dominated by other costs. Tier 4 GPU timing data will be the gate that justifies pulling any of these forward.
