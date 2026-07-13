---
"@aperture-engine/render": minor
"@aperture-engine/runtime": minor
"@aperture-engine/app": minor
"@aperture-engine/webgpu": minor
---

Projected decals (parity plan D4) — the analog of three.js `DecalGeometry` /
projected-decal materials. A new `Decal` authoring component (texture, sampler,
size, tint, `opacity` fade, `depthBias`, `capacity`, `sequence`) whose entity
WORLD transform is the projector; extraction (`extractDecals`) gathers live
decals, folds `opacity` into the tint alpha, and applies an oldest-first
(ring-buffer) live-decal cap — keeping the newest `capacity` by `sequence` and
reporting `{ capacity, live, evicted, submitted }` on `snapshot.report.decals`.
The pure cap policy is exported as `selectRenderedDecals`. Decals ride the ECS
snapshot as a plain-array family (`snapshot.decals`), transported through the
transferable path (a decal-carrying frame skips the SAB packed codec), so a
scene with no decals is byte-identical to a pre-D4 snapshot (family + report
field both omitted; determinism fixtures unmoved).

Rendering is a dedicated **decal feature realizer** (registered alongside
particles/UI, so every frame route gets it) with ONE shared instanced pipeline —
not per-decal custom-WGSL. Each decal is a depth-biased projected quad: the quad
lies in the projector's local plane and is nudged toward the camera by
`depthOffset` so it wins the depth test against the coplanar surface without
z-fighting, then depth-tests (`less-equal`, no depth write) against the scene
depth the opaque pass wrote — so nearer geometry still occludes it and no extra
pass is submitted. Contiguous same-texture runs collapse into one instanced
draw. The per-frame `features.decals` report echoes the cap tally plus the drawn
instance/batch counts; `counts.decals` appears only when decals exist.

Authoring surface: `Decal` + `createDecal` + `validateDecalInput`
(`@aperture-engine/render`), the `withDecal(...)` trait
(`@aperture-engine/runtime`), and the `spawn.decal(...)` system command
(`@aperture-engine/app`) which auto-stamps `sequence` from the world change
version so eviction follows firing order. Every failure path (missing/invalid
texture, degenerate size, non-positive capacity, unavailable pipeline/bind
group) emits a structured diagnostic rather than a device error. Ships
`examples/decals` (FPS bullet holes accumulating on a wall, hitting the cap and
evicting the oldest) with pixel + report-counter e2e coverage. Limitations
(honest): the projected-quad route is ideal for flat surfaces (walls/floors) and
does not mesh-conform to arbitrary curved geometry, projects the primary view's
matrix (single-camera scenes), and layer filtering gates a decal per view (not
per underlying-surface layer) — a deferred box-projector reconstructing world
position from the scene depth buffer is the follow-up for those.
