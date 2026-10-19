# Project selected vertices from a saved bundle

`aperture inspect projected-bounds` reports the pixel envelope of actual
referenced vertices in selected static mesh draws. It reads an existing portable
bundle without loading an app, stepping simulation, or starting a renderer.
For example, `bounds.witnesses.minY` identifies the highest projected source
vertex, with local/world coordinates, original vertex index, draw ID and entity
generation. This is geometric evidence; visibility remains unknown.

```json
{
  "bundle": "scene.bundle.json",
  "viewId": 7,
  "scope": { "meshIds": ["panel.mesh", "brace.mesh"] },
  "limits": { "maxDraws": 64, "maxVertices": 150000 }
}
```

```sh
aperture inspect projected-bounds projection.json --out projected.json
```

Use the exact `viewId` retained in the bundle, which can be negative. The example
ID is not a default. Scope is the union of exact mesh IDs and/or entity references
(`"entities": [{"index": 42, "generation": 128}]`), or explicit `"all": true`
without selectors. A shared mesh ID can select several draws; every report and
extremum retains draw/entity identity. Group names and parent hierarchy cannot
be reconstructed from a render bundle. Selection covers extracted color-pass
mesh draws eligible for the chosen view's layer mask.

The bundle path is relative to the job; `--out` is relative to the working
directory, with an existing parent directory. JSON is printed to stdout, and
optional output is written atomically. Input job/bundle aliases cannot be
overwritten. Exit 0 means a report was produced, including partial reports;
exit 1 means invalid input or I/O failure. Read `coverage`, `diagnostics`, and
the nullable `bounds`, not only process exit status. A failed invocation leaves
any previous output file unchanged.

The command requires a modern `aperture.render-bundle` with recorded target
width/height, an explicit retained view, full viewport/scissor, and the main
output target. Legacy normalization defaults are not capture provenance.
There is no camera reconstruction, fitting, target-size override, or image
interpretation. Stored view-projection matrices include any retained jitter;
the report describes that snapshot, not a later edited source or camera.

## Geometry and completeness

The pure render API is `inspectProjectedMeshBounds({snapshot, resolveMesh,
resolveMaterial, scope, viewId, target: {width,height}, limits?})`. Resolvers return
the source mesh/material for each retained handle. The CLI reuses existing bundle
normalization, preflight, typed-array decode, and this one CPU helper. ECS stays
authoritative; resolved matrices are consumed without another transform graph.

Positions use `float32x3` POSITION attributes, including interleaved strides and
byte offsets. Active submesh ranges and packet range overrides are respected.
Indexed draws use base vertex zero, matching the renderer. Inactive vertices
are excluded; repeated indices and vertices of degenerate triangles are included.
The shared static range reader also serves coplanar inspection, whose separate
triangle-area filtering is unchanged. Source-AABB corners are never substituted.

Bounds are **unclipped, unclamped vertex envelopes**, with min/max X/Y witnesses.
Far-plane and outside-viewport reference counts accompany otherwise supported
geometry. AABB corners can project beyond actual vertices. Neither envelope is
a visible silhouette: clipping-generated vertices, backface culling, occlusion,
alpha/discard, textures, rasterization, MSAA, reflections and post-processing
are not evaluated. Previously culled or unextracted entities are absent.

Any selected unsupported draw, unmatched selector, near/eye-plane uncertainty,
invalid matrix/position, overflow, incomplete bundle preflight or exhausted limit
makes global `bounds` null and coverage partial. Supported per-draw results remain
available beside diagnostics; they must not be treated as complete selection
bounds. A failing draw also has null bounds, even if earlier vertices projected.
An empty selection/range has null bounds without artificial infinity values.

Skinning, morph targets, instance attributes, custom vertex shaders, standard
material deformation, missing assets and non-triangle topology are unsupported.
Surface-only standard-material extensions can retain static position support.
The inspector does not reconstruct or evaluate shader deformation.

## Numerical policy and bounded work

The CPU evaluates `retainedVP * (resolvedModel * sourcePosition)` using Number
arithmetic over stored Float32 coefficients. Model matrices must be finite and
affine; camera matrices must be finite and invertible. It does not recompute
`projection * view` or combine it with the model into a newly rounded matrix.

V1 has a **fixed 0.05 px numerical sensitivity limit**, recorded as
`precisionTolerancePixels`; there is no caller override. This is not a fit,
visual-quality, or aesthetic threshold. A conservative two-stage Float32
roundoff estimate uses absolute product magnitudes before cancellation,
propagates model uncertainty into clip coordinates, and bounds the perspective
division. W and near clip Z must have resolved positive/nonnegative signs after
that allowance. Nonfinite values, possible Float32 overflow, subnormal source
positions/matrix coefficients, and excessive pixel uncertainty report partial
coverage. Intermediate underflow has an absolute allowance. This can reject
numerically sensitive geometry conservatively; it does not guarantee equality
to GPU arithmetic or pixels. FMA, clipping and rasterization are not simulated.

Defaults are 64 draws and 150,000 active vertex references, including repeats.
Positive integer limits can be supplied explicitly. Draws are visited by entity
index/generation, render ID, submesh and mesh ID; references follow original
index/vertex sequence order. Exact extremum ties retain the first witness.
A draw exceeding the remaining reference budget is skipped as partial; no
sampling is presented as complete. Invalid draws still consume attempted range
budget once that range has been accepted. Input snapshots/assets are not mutated.

For current ECS data, [local camera inspection](CAMERA_LOCAL_INSPECTION.md) already
supports a bounds-only request without a source resource. Its source-AABB report
requires a live CPU app; source-owned resources are useful for landmarks shared
with construction. Use this offline command when inspecting an exact saved
bundle's actual vertex extrema. [Camera jobs](CAMERA_LANDMARKS.md) remain the
separate route for caller-supplied target fitting and plane unprojection.
