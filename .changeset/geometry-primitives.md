---
"@aperture-engine/render": minor
"@aperture-engine/app": minor
---

Geometry primitives round-out (parity plan G1) — the analog of three.js
`CircleGeometry`, `RingGeometry`, `TorusKnotGeometry`, `PolyhedronGeometry` (with
its `Tetrahedron`/`Octahedron`/`Icosahedron`/`DodecahedronGeometry` wrappers), and
the community `RoundedBoxGeometry`. `@aperture-engine/render` gains
`createCircleMeshAsset`, `createRingMeshAsset`, `createTorusKnotMeshAsset`, one
`createPolyhedronMeshAsset` plus thin
`createTetrahedronMeshAsset`/`createOctahedronMeshAsset`/`createIcosahedronMeshAsset`/`createDodecahedronMeshAsset`
wrappers over the canonical three.js vertex/index tables, and
`createRoundedBoxMeshAsset`. Every builder emits the standard interleaved
POSITION/NORMAL/TEXCOORD_0 layout (`PRIMITIVE_VERTEX_STRIDE_BYTES`) with correct
`localAabb` + `localSphere` bounds, exactly like the existing primitives.

The `@aperture-engine/app` facade surfaces
`mesh.circle`/`ring`/`torus`/`torusKnot`/`tetrahedron`/`octahedron`/`icosahedron`/`dodecahedron`/`roundedBox`
via `spawn.mesh({ mesh: mesh.torusKnot({...}) })`; the pre-existing torus builder
was previously unsurfaced and is now exposed as `mesh.torus(...)` too. This
raises the audited primitive count from 8 to 17.

**Conventions.** Circle and ring lie in the XY plane facing +Z, matching the
existing plane primitive and three.js `CircleGeometry`/`RingGeometry` (full
sweep only, so their bounds are analytic). Torus knot ports the standard
`(p, q)` parametric curve with three.js defaults (`radius 1, tube 0.4,
tubularSegments 64, radialSegments 8, p 2, q 3`). The one polyhedron builder
subdivides each base face `(detail+1)^2` times and projects every vertex onto
the sphere of `radius`; `detail 0` keeps flat-shaded raw faces (each solid
reproduced exactly), `detail > 0` yields smooth radial normals. Rounded box maps
a subdivided cube onto the rounded surface by offsetting the nearest inner-box
anchor along `normalize(pOuter − clamp(pOuter))`, producing flat faces,
quarter-cylinder edges, sphere-octant corners, and exact per-vertex normals
(corner `radius` is clamped to the shortest half-dimension). No deviation from
the AC — only three.js extrude/lathe/tube/shape/text/edges/wireframe remain
(G2/deferred).

Ships golden vitest checks (`test/mesh/primitive-geometry.test.ts`) locking exact
vertex/index counts, unit-length normals, tight enclosing bounds, outward
triangle winding, the interleaved stride, and the polyhedron `detail 0 → 1` `4x`
growth; and `examples/geometry-gallery` (a 3x3 grid of the new primitives, one
built-in `material.standard()` per mesh) with a Playwright coverage e2e proving
all nine primitives render. Adding these kinds is byte-identity safe: existing
primitives and pipeline keys are unchanged and the determinism fixtures need no
refresh.
