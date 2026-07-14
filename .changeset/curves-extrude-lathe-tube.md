---
"@aperture-engine/math": minor
"@aperture-engine/render": minor
---

Curves + extrude/lathe/tube geometry (parity plan G2) — the three.js curve
primitives and shape-extrusion builders, all deterministic and array-first.

**Curve primitives (`@aperture-engine/math`).** A new `curves.ts` adds a
readonly tagged-union `Curve` record — `line`, `quadratic-bezier`,
`cubic-bezier`, `catmull-rom`, and `arc` (circular/elliptical, arbitrary plane)
— with the constructors `lineCurve`, `quadraticBezierCurve`, `cubicBezierCurve`,
`catmullRomCurve(points, { closed?, alpha? })`, and `arcCurve({ center?, xRadius,
yRadius?, startAngle?, endAngle?, xAxis?, yAxis? })`. Any curve is evaluated
uniformly by the free-function dispatchers `getCurvePoint(curve, t, out?)`,
`getCurveTangent(curve, t, out?)` (unit tangent), and `getCurveLength(curve)` —
kernel-style, no classes (decision 0007): control points are copied into plain
tuples on construction and each evaluator reads them into scalar locals before
writing `out`, so `out` may alias. Catmull-Rom uses the Barry-Goldman
non-uniform recurrence and defaults to the **centripetal** parametrization
(`alpha` 0.5, matching three.js `CatmullRomCurve3`; 0 uniform, 1 chordal).
`getCurveLength` is a deterministic 200-segment uniform-parameter polyline sum
(exact for a line; within ~4e-5 relative of `2πr` for a full circle).

**Extrude / lathe / tube builders (`@aperture-engine/render`).** Three new mesh
builders follow the G1 primitive pattern (interleaved 32-byte position/normal/uv
vertices, tight bounds, `validateMeshAsset`-clean):

- `createTubeMeshAsset({ curve, radius?, tubularSegments?, radialSegments?, closed? })`
  sweeps a circle along any `Curve` with a stable **parallel-transport
  (rotation-minimizing) frame** — not a raw Frenet frame, so the cross-section
  never flips at inflection points — plus the closed-curve twist correction;
  normals point radially out from the curve.
- `createExtrudeMeshAsset({ shape, holes?, depth? })` extrudes a 2D outline
  (with optional holes) along `Z`, triangulating the front/back caps with an
  **in-house ear-clipping triangulator** (no `earcut` dependency) and stitching a
  flat-shaded side wall around every contour with outward normals.
- `createLatheMeshAsset({ profile, segments?, startAngle?, endAngle? })` revolves
  a 2D profile around the Y axis with averaged profile-tangent normals.

The triangulator ships as `triangulateShape(contour, holes?)` (mirroring three.js
`ShapeUtils.triangulateShape`): a doubly-linked-list ear clipper with hole
bridging, CCW/CW winding normalization, collinear-ear skipping, and a fan
fallback that guarantees termination.

Ships `examples/racetrack-tube`: a procedural racetrack — a closed Catmull-Rom
loop swept into one tube mesh, registered via `this.meshes.publish` and drawn
through the app facade with a single built-in `material.standard()`, with a
Playwright e2e asserting the mesh draws and covers the canvas.

Deviations (honest): no **bevel** and no curve-based `Shape`/`ShapePath` input
(shape outlines are `[x, y]` point arrays); `TextGeometry` stays deferred. The
app-facade `mesh.*` descriptor sugar is unchanged — these rich curve/shape
inputs are authored via the render builders + `this.meshes.publish`.
