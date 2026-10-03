# Independent crane courtyard: author B, final own-render revision

This is independently authored procedural three.js geometry from the shared frozen brief, scene manifest and three PNGs. No reference builder, Blender/GLB asset, other author output, imported model, reference texture or texture map was used. Engine files remain unchanged. This is exploratory evidence, not a scored benchmark.

## Run contract

The parent serves this directory at `/scene/`, with the pinned vendored `shadow-lab/src/compare/three.webgpu.js` and `three.core.js` at `/three.webgpu.js` and `/three.core.js`. Open `/scene/index.html?view=front-quarter&edit=baseline`. The scene uses one module worker for CPU mesh construction and main-thread native WebGPU submission.

- Views: `front-quarter`, `rear-quarter`, `high-oblique`
- Edits: `baseline`, `shoulder`, `elbow`, `hoist`, `arch`, `pipe`, `tier`, `assembly`
- Every edit reconstructs from `BASELINE`, then applies only the named patch in `EDITS`.
- Canvas and drawing buffer are 1024 × 1024, DPR 1. Cameras remain fixed across edits.
- Renderer: pinned native `THREE.WebGPURenderer`, actual revision `185dev`.
- `renderer._getFallback = null` is set before initialization. The backend is verified to be `WebGPUBackend`; there is no fallback render route.
- Parent alone may serve or render this scene. All browser attempts must use `pnpm run render:cloud` or `runVerifiedScene` through the established approved lifecycle. No browser was launched by this author.

## Files and independent inspection

- `scene-data.mjs`: pure deterministic `buildScene(edit = 'baseline')`, plus `BASELINE`, `EDITS`, `PALETTE`, `CAMERAS`.
- `worker.mjs`: builds data, checks it, then transfers the actual typed buffers.
- `scene.mjs`: native BufferGeometry/mesh/material/light/camera setup, submission fence, evidence exports.
- `checks.mjs`: pure `inspectScene(data)`, `checkEdits()`, `nativeVertex(mesh, index)`, `marker(mesh, name)`, `transformPoint(point, matrix)`.
- `index.html`: minimal 1024-square canvas; error overlay is shown only on failure.

`buildScene` returns `{ schema, edit, parameters, cameras, palette, meshes }`. Each named mesh exposes:

```
{
  name, group,
  positions: Float32Array, normals: Float32Array, indices: Uint32Array,
  materials: string[], groups: { start, count, materialIndex }[],
  matrix: number[16],
  markers: { [name]: number[] }
}
```

Positions and indices are exactly the native `BufferGeometry` payload. Matrix is column-major and assigned directly to native `Mesh.matrix` under an identity scene parent. Native per-face vertices are deliberately duplicated for faceted normals. Markers contain indices into those actual native vertex buffers, enabling ring/end-face centroid measurements without trusting a separate claimed endpoint. There are 78 semantic meshes. Actual triangle totals and bounds are derived by the checks.

In a captured browser session, `window.__CRANE_EXPORT_GEOMETRY__()` returns ordinary serializable arrays freshly read from each native mesh's position, normal and index attributes and `matrixWorld`. `window.__CRANE_NATIVE__` exposes the renderer, scene, camera and native mesh instances. `window.__CRANE_CHECKS__` contains both worker-buffer and native-buffer check results. `window.__CRANE_STATE__` supplies edit, view, parameters and actual counts.

`window.__CRANE_READY__` is absent until native compilation, render submission, GPU queue completion, validation-scope checking, and a subsequent animation-frame boundary have completed. It then contains `ok:true`, dimensions, native renderer/backend/revision, scene state, fixed camera details, geometry-check summary, and `nativeGeometry`, a full serialized snapshot freshly read from actual native mesh buffers and world matrices. The snapshot is retained automatically when the parent captures the readiness sentinel. Progress is separate in `__CRANE_PROGRESS__`. Failure appears in `__CRANE_ERROR__`; failed scenes never receive a ready sentinel.

The parent can independently invoke `checkEdits()` in Node or consume all generated/native vertices directly. Checks cover boom lengths and joint centroids, hydraulic coaxiality and overlap, cable verticality, hook/slings/load attachment, true wall-opening triangle misses, pipe concentric rings and open-end triangle misses, tier contact, and every out-of-scope native buffer/transform remaining byte-value identical. Entire per-vertex rigid motions are also checked for hoist, tier and assembly edits. Tolerance is 2e-5 m, allowing float32 upload rounding.

## Geometry and appearance

All dimensions, cameras, edit values and sRGB palette entries are the common brief values. The wall uses twelve extruded arch wedges and twelve fitted spandrels, not a dark decal or a covered hole. The pipe is one connected swept wall with separate outer and inner faces and annular end rims; both bores remain genuinely open. The hook is an open 270-degree low-poly swept tube. Hydraulic and sling endpoints are generated from their constrained attachments. Whole-assembly yaw is a native matrix transform applied only to crane/platform mesh groups.

Appearance uses flat native PBR materials, ACES filmic tone mapping, 4× MSAA, a warm shadow-casting directional key, a constant procedural cool PBR environment, nine unshadowed point samples across a 7 m cool fill emitter, and a warm wall point lamp. The point-sampled fill and PCF shadow radius approximate the reference area light and finite angular sun; they are not exact ports of Blender illumination. No Blender grain, denoising, or contrast-look emulation is added. No physical simulation or safety claims are made.

## Submission status and budget

This is the single permitted own-render revision, copied from immutable v1 into v2. The parent reported that v1 passed native SwiftShader WebGPU capture with zero WebGL/GPU errors and an independent 546-check geometry audit. The author reviewed only that own front-quarter capture and the allowed frozen reference. No browser, server, dynamic CPU test, install or engine modification was performed by the author.

The revision changes only rendering/evidence: native PCF radius 3 to 12, native AgX to ACES filmic tone mapping, cool environment strength .35 to .25, key intensity 2.2 to 2.6, backdrop input #6c7e89 to #5e6770, and serialized actual native geometry added to readiness. The underlying procedural geometry, palette, cameras, checks and edit construction remain byte-identical to v1. These appearance adjustments are qualitative and require parent captures for verification.

All parent capture attempts and errors must be retained, with at most 12 retained attempts including failures across the permitted comparison. The single revision is consumed. This v2 directory is final and frozen after its static syntax checks.
