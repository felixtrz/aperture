---
"@aperture-engine/app": minor
"@aperture-engine/webgpu": minor
---

First-class dynamic mesh update API (parity plan D5) — the analog of three.js
`BufferAttribute.needsUpdate` / `updateRange` partial re-uploads. A new
`meshes.update(handle, { streams, updateRanges })` surface (plus a
`DynamicMesh.update(...)` convenience) partially updates a registered mesh's
vertex/index buffers IN PLACE: the changed byte windows are re-published as a
new source-asset version carrying `updateRanges`, which flows through the
EXISTING update-range plan (`prepareMeshGpuResource` reuses the same-layout GPU
buffers and streams only the named ranges via `queue.writeBuffer`) — no asset
re-registration, no full-buffer re-realization. Streams (and the index buffer)
NOT named in an update are re-published with an empty range list so the renderer
SKIPS them; a named stream without explicit ranges re-uploads its whole buffer.
Every invalid input — unknown handle, unready asset, empty update, unknown
stream, stream/index length-or-type mismatch, out-of-bounds or misaligned
range, missing index buffer — is rejected with a structured `meshUpdate.*`
diagnostic and NO publish, so a bad range never reaches WebGPU as a raw
validation error.

The frame report gains a `dynamicMeshUploads` section (per-frame update-range
`frameBytes`/`frameWrites`/`frameUpdates` + the `frameFullBytes` a full
re-realization would have cost, a `partial` flag = `frameBytes < frameFullBytes`,
and cumulative `total*`). It is present ONLY on frames where a dynamic mesh was
partially uploaded, so a static frame stays byte-identical (report field omitted,
no counter). Also improves the worker→main mesh-asset mirror: an unchanged
patched stream/index buffer is now reconstructed with an EMPTY range list
(instead of `undefined`, which full-wrote every untouched buffer each frame), so
multi-buffer partial updates are genuinely partial across the boundary.

Ships `examples/cloth-flag` — a small CPU-simulated cloth banner whose vertex
positions/normals are deformed every frame with `meshes.update(...)`; only the
moving-row window (3744 B) streams to the GPU each frame, well below a full
vertex+index re-realization (5456 B), sustained with no re-registration. Pixel +
report-byte-counter e2e coverage proves the flag deforms and the uploads stay
partial across many frames. The counter is renderer-side (GPU write bytes) and
does not ride the ECS snapshot, so determinism fixtures are unmoved. Uses a
built-in double-sided standard material (not custom WGSL) to render.
