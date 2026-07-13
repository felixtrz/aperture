---
"@aperture-engine/render": minor
"@aperture-engine/runtime": minor
"@aperture-engine/app": minor
"@aperture-engine/webgpu": minor
---

Fat lines & points materials (parity plan E1) — the analogs of three.js `Line2` /
`LineMaterial` (the fat-lines addon) and `PointsMaterial`. Two new instanced,
screen-space primitive subsystems modeled on the sprite/decal precedent (dedicated
shared pipeline + per-frame instance buffer + a feature realizer in the transparent
phase), NOT custom-WGSL materials — so multiple lines/points in one frame never hit
the multi-distinct-custom-WGSL black-frame bug.

**Fat lines.** A `Line` authoring component carries a flat polyline vertex buffer
(held by reference) plus a screen-space `width` (pixels), tint, and world-unit
`dashSize`/`gapSize`/`dashOffset`. `extractLines` copies vertices into the
`snapshot.lineVertices` family and emits `LinePacket`s. Each segment expands on the
GPU into a capsule bounding box quad (half the pixel width perpendicular, plus
half-width caps), and a capsule SDF in the fragment shader discards beyond
half-width — giving round caps AND round joins for free. Width is
resolution-independent. Dashes use the world-continuous arc length accumulated from
the world-transformed vertices, so the pattern flows unbroken across joins.

**Points.** A `Points` component carries a flat point buffer (+ optional per-point
RGBA colors) with `size`, `sizeAttenuation`, `shape` (round/square), and a uniform
`color`. `extractPoints` copies positions into `snapshot.pointVertices` and folds
color per point into `snapshot.pointColors`. Each point draws a camera-facing quad
sized in pixels, or (with attenuation) world units scaled by `0.5 * viewportHeight /
clipW` — the three.js `PointsMaterial` model, so nearer points are larger. Round
points radial-discard outside the unit disc.

**Byte-identity + transport.** Lines/points ride the ECS snapshot as plain-array
packet families with typed-array geometry, routed through the transferable path
(`hasUnsupportedSharedSnapshotPayload` + `renderSnapshotTransferList` gain the new
families) — the SAB packed codec is untouched. A frame with no lines/points omits
every family + report field and its pipelines/passes are never built, so it is
byte-identical to a pre-E1 frame; no determinism fixture uses them (fixtures
unmoved).

Authoring surface: `Line`/`Points` + `createLine`/`createPoints` +
`validateLineInput`/`validatePointsInput` (`@aperture-engine/render`), the
`withLine(...)`/`withPoints(...)` traits (`@aperture-engine/runtime`), and the
`spawn.line(...)`/`spawn.points(...)` system commands (`@aperture-engine/app`).
Every failure path (empty/degenerate polyline, mismatched point colors, bad
width/size, unavailable pipeline/bind group) emits a structured `line.*`/`points.*`
/`lineFrame.*`/`pointFrame.*`/`lineRenderPipeline.*`/`pointRenderPipeline.*`
diagnostic rather than a device error. `snapshot.report.lines` = `{ lines, segments,
vertices }` and `report.features.lines` = `{ lines, segments, drawnSegments }`
(points analogously). Ships `examples/fat-lines` (a dashed debug-path with a
screen-space-width band) and `examples/point-cloud` (near/far attenuated points),
each with pixel + report-counter e2e coverage. Limitations (honest): line joins/caps
are round-only (no miter); no near-plane clipping for segments crossing behind the
camera; per-vertex line colors and per-point size are follow-ups; both pipelines
project the primary view's matrix (single-camera scenes).
