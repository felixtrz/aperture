---
"@aperture-engine/render": minor
"@aperture-engine/webgpu": minor
---

Clipping planes (parity plan D2) — the analog of three.js
`renderer.clippingPlanes` (per-camera), `Material.clippingPlanes` (per-material),
and the WebGPU `ClippingGroup`. World-space clip planes `[nx, ny, nz, d]` are
authored at two scopes: per-camera via `camera.clipPlanes`
(`spawn.camera({ camera: { clipPlanes } })` / `withCamera({ clipPlanes })`, which
attaches a `CameraClipPlanes` companion component) and per-material via
`renderState.clipPlanes` on any built-in material. A fragment is KEPT where
`dot(worldPos, (nx,ny,nz)) + d >= 0` and discarded otherwise (three.js
`THREE.Plane` semantics). Camera and material planes UNION (camera first) and are
capped at `MAX_CLIP_PLANES` (8); overflow is dropped loud-over-silent with the
`camera.clipPlanesExceedLimit` / `material.clipPlanesExceedLimit` diagnostics, and
malformed (non-finite) planes are dropped.

WebGPU core WGSL has no `clip_distances` builtin (it is an optional feature,
absent on SwiftShader), so clipping is a per-fragment `discard`: the built-in mesh
shaders (unlit/matcap/standard/debug-normal) get the discard loop injected
automatically, gated frame-wide by a `clip` pipeline-key feature token appended
when any view in the frame carries clip planes. The plane DATA lives in the
per-view uniform at `@group(0) @binding(0)`, appended after the fog block
(`clipPlaneCount: vec4f` + `clipPlanes: array<vec4f, 8>`) with every pre-existing
field offset unchanged, so per-camera semantics hold (a non-clipping view reads
count 0) and custom WGSL materials keep reading valid data (the grown uniform
buffer is a strict superset; custom materials are not auto-clipped). A frame with
no clip planes keeps byte-identical pipeline keys, shaders, and pipelines.

Ships `examples/clipping-cutaway` (an orthographic camera whose clip plane cuts a
symmetric box in half) with a pixel-sampled `test/e2e/clipping-cutaway.spec.ts`.
The SAB packed view record carries the clip block (encoding version 17); a view
with no planes round-trips byte-identically. Advanced-audit clipping row → ✅;
scenario #7 (planar mirror) stays 🟡 (clipping now exists — the oblique-frustum
blocker is gone — but a turnkey `Reflector` helper is still missing).
