---
"@aperture-engine/render": minor
"@aperture-engine/runtime": minor
"@aperture-engine/webgpu": minor
"@aperture-engine/app": minor
---

Immediate-mode debug-draw overlay (parity plan E3) — the analog of three.js
`Box3Helper` / `SphereHelper` / `AxesHelper` / `GridHelper` / `CameraHelper` /
`SkeletonHelper` / `ArrowHelper`, but as a **single immediate-mode debug-draw
API callable from systems** instead of a scene-graph of helper objects.

**AC1 — the API + overlay.** A system calls `this.debugDraw.aabb(...)`,
`.box(...)`, `.sphere(...)`, `.axes(...)`, `.grid(...)`, `.frustum(...)`,
`.bones(...)`, `.light(...)`, `.line(...)` every frame; each primitive lasts
exactly one frame. Every primitive tessellates into world-space line segments
(an AABB = 12 edges, a sphere = 3 great-circle rings, axes = 3 colored segments,
a grid = `2*(divisions+1)` segments, a frustum = 12 edges of the inverse
view-projection NDC cube, bones = a segment per joint link) — the pure
tessellation math lives in `debug-draw-geometry.ts` and is unit-tested in
isolation. Systems accumulate into a per-frame `DebugDrawAccumulator` installed
on world globals; render extraction **drains** it into a transient
`snapshot.debugLines` family (flat world-space positions/colors/widths) + a
`report.debugDraw = { primitives, segments, vertices }` tally, then clears it.
The overlay **reuses the E1 fat-line pipeline as its rendering backend** — a
`debug-draw` built-in webgpu realizer packs the segments into the SAME per-segment
instance layout the E1 lines use and draws them with the SAME pipeline (no second
line rasterizer; a built-in shared material, never custom-WGSL, so the D3
black-frame bug never applies), in the transparent queue at a high order so
helpers composite over the scene. Inherits the E1 pipeline's sample count + depth
handling (depth-tested, no depth write — three.js helper behavior).

**No-op in production.** When debug draw is disabled (`config.debugDraw: false`,
threaded into `createExtractionApp({ debugDraw })`), the bound accumulator is a
shared frozen no-op: every `this.debugDraw.*` call accumulates nothing, `drain()`
returns `null`, and the frame emits **no** `debugLines` family, **no**
`report.debugDraw` field, and **no** overlay pass — byte-identical to a frame
without debug draw (pinned by a disabled-vs-empty literal test). A frame with no
debug calls is likewise byte-identical whether the accumulator is enabled or not.

**AC2 — physics debug re-plumbed.** The existing physics debug geometry (collider
wireframes / contact normals / body-state markers / broadphase AABBs / joint
frames), previously data-only via `this.physics.debugGeometry()` and the
`physics_debug_geometry` devtools tool, now composites onto the **same** overlay
route: `debugDraw.physics(geometry)` feeds a `PhysicsDebugGeometry` line list
through the identical debug-line sink, and a built-in app-step bridge
(`runPhysicsDebugDrawFrame`) routes `physics.debugGeometry()` through it every
frame when a `PhysicsDebug` component enables a channel. One overlay route, no
bespoke physics render path.

**Determinism + transport.** Determinism scenes emit no debug primitives, so no
`debugLines`/`report.debugDraw` appears and `test/determinism` is GREEN with no
fixture refresh. The `debugLines` family rides the transferable snapshot transport
(added to `hasUnsupportedSharedSnapshotPayload` + `renderSnapshotTransferList`),
avoiding a packed-codec change. Every failure path emits a structured
`render.debugDraw.*` diagnostic (degenerate/non-finite primitive skipped, per-frame
segment cap exceeded) rather than a device error.

Authoring surface: `this.debugDraw` on the system base + `app.debugDraw` on the
extraction app (`DebugDrawApi`), `config.debugDraw` (`@aperture-engine/app`),
`createDebugDrawAccumulator`/tessellation helpers (`@aperture-engine/render`), and
the `debug-draw` webgpu realizer (`@aperture-engine/webgpu`). Ships
`examples/debug-draw` (a system drawing an AABB + sphere + axes + grid + a physics
collider wireframe every frame) with a frame-report e2e asserting the exact
primitive/segment counts (1 AABB → 12 segments, …), overlay pixels over the scene,
and — via `?debug=off` — that disabling drops the counts and overlay pixels to
zero. Deviations (honest): `ArrowHelper` is covered by `line` + the light-gizmo aim
ray rather than a dedicated cone-tipped arrow; the light gizmo is a coordinate
frame + aim ray (not a per-light-kind cone/sphere); the overlay is depth-tested
(matching three.js helpers), not a forced draw-over-everything pass.
