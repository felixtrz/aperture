# Car construction: fitted polygon surfaces

17 October 2026. Implementation follow-up to the street-corner benchmark.

The visible gap came from how the cars were authored. Three.js used a cabin that
tapers toward the roof and trapezoidal glass faces fitted to it. Aperture used a
constant-width extrusion, thick glass boxes, a roof slab and separate pillar
blocks. Three.js also used separate glass meshes: the fitted geometry made those
parts look integrated. Aperture's renderer could already draw that geometry using
`mesh.triangleList()`, but the author had to supply triangle indices and winding.

## Implemented

- Added public `mesh.polygons({ faces: [{ outline, holes? }] })` surface authoring.
  It triangulates planar 3D polygons, including concave outlines and disjoint
  holes, and produces indexed geometry with flat normals and projected UVs.
- Added bounded validation and `aperture.spawn.invalidPolygonMesh` diagnostics
  identifying the authored face or boundary. Invalid geometry is rejected before
  mesh/material assets are published.
- Added the reusable `examples/procedural-car` app and recipe. The painted body
  has actual window openings. The glazing reuses their exact corners, with no
  backing body face, overlap or gap. Pillars, rails and sills are painted surface
  regions rather than additional blocks. The body and glass form a closed shell.
- Kept normal ECS ownership, parent transforms, worker extraction and portable
  bundles. No Three.js dependency or renderer change was needed.
- Documented the workflow in `docs/POLYGON_SURFACE_AUTHORING.md` and linked it
  from `docs/PROCEDURAL_STILL_IMAGES.md`.

The example uses 29 mesh parts per car versus the original's 44. These counts
come from strict headless exports: 30 and 45 mesh draws including one ground
receiver. Wheels, mirrors, handles and lamps remain separate physical parts.
This is a structural count, not a measured speedup.

## Visual evidence

All images are 1200 × 900, captured through the approved browser WebGPU route.

| Image | Retained evidence |
| --- | --- |
| Original Aperture car | `evidence/before/final/render.png` |
| Fitted Aperture car | `evidence/after/final/render.png` |
| Original Three.js car construction | `evidence/three/reference/render.png` |
| Revised Aperture street | `evidence/street/initial/render.png` |
| Fitted car, side | `evidence/side/final/render.png` |
| Fitted car, rear | `evidence/rear/final/render.png` |

The close-ups use the same camera framing. Before/after Aperture also shares
lighting, environment, ground and post-processing. The revised recipe changes
body shape, details and roughness as well as window construction; this is not a
geometry-only ablation. The isolated Three.js car keeps its original framework's
materials, lighting and post-processing, so it is a construction reference, not
a controlled renderer comparison. Its smoother shading also differs from the
revised Aperture recipe's deliberately flat faces.

In the full street, only the car authoring method was replaced; the original
buildings, furnishings, camera, lights and post settings remain. The original
street benchmark images, journals and scores remain frozen. No new authoring
time, cost, judge score or general framework ranking is claimed here.

## Verification

- **141 tests passed across eight files**: polygon triangulation and validation,
  winding, holes, exact positions, owned buffers, flat normals, atomic spawn
  diagnostics, closed fitted-car topology, native Node package exports and
  strict bundle closure, plus existing extrusion/triangle-list regression tests.
- The body and glazing have exactly two opposite uses of every geometric edge;
  all six glass faces reuse the exact window boundaries.
- Package builds, test TypeScript checking, targeted ESLint and formatting,
  package/headless boundary checks and diagnostic-catalog checks passed.
- Generated API reference includes the new public polygon types and factory.
- Six browser views passed verified WebGPU capture. The revised car and full
  street were also exported through ordinary Node and rendered with Dawn.
- **Browser versus Dawn: zero differing pixels in both 1200 × 900 images**,
  comparing decoded RGBA (opaque alpha supplied for RGB browser PNGs). Both use
  SwiftShader in this environment; this does not establish cross-driver parity.
  No placeholders or renderer diagnostics were reported.

Run `node benchmarks/car-construction-20261017/shared/validate.mjs` to recheck
the retained browser/Dawn images and capture statuses. See
`evidence/validation.json` for the results. Source snapshots accompany captures;
the current reusable recipe lives in `examples/procedural-car/src/car.ts`.

## Scope and next measurement

This closes the specific fitted-surface construction gap and makes the workflow
available through Aperture's public app facade. It does not provide automatic
boolean union, beveling, smooth subdivision or general parity with all Three.js
geometry tools. Use explicit triangle-list geometry for custom normals/UVs.

The next useful measurement is a fresh, equal-budget authoring trial with this
API and recipe available to the Aperture author. That will establish whether
agents discover and use it, produce comparably integrated props, and reduce
time to a satisfactory image. This implementation follow-up cannot answer that
timing question by itself.
