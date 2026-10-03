# Crane courtyard, independent Aperture author A, initial submission

This is an exploratory reconstruction, not a scored benchmark or engineering/physics claim. It is authored independently from the shared brief, numeric manifest and three PNGs. It imports no model, image, reference builder, texture or other author's work. Engine source remains unchanged.

## Serve and capture

The parent serves this directory as `/scene/` and the existing trusted `/worker-modules/` engine/dependency rewriting route. Entry: `/scene/index.html?view=front-quarter&edit=baseline`.

Views: `front-quarter`, `rear-quarter`, `high-oblique`.
Edits: `baseline`, `shoulder`, `elbow`, `hoist`, `arch`, `pipe`, `tier`, `assembly`.
Every URL independently constructs the baseline plus exactly one override. The camera is orthographic, square 1024 × 1024, span 10.5, fixed target (0,1.4,0).

Only the parent may perform browser captures, through `pnpm run render:cloud` / `runVerifiedScene` and its approved cleanup lifecycle. No browser launch or server is included here.

## Files and geometry access

- `scene.mjs`: pure deterministic `constructScene(edit)` plus frozen parameter presets, cameras, palette and render configuration. It is importable in Node without engine or DOM dependencies.
- `worker.mjs`: app-facade system populating ECS using native `mesh.triangleList` and standard PBR materials. Geometry is held in native asset storage; mesh ECS entities are authoritative. No renderer-side scene graph is used.
- `main.mjs`: native app/worker bootstrap and submitted-frame readiness.
- `geometry-checks.mjs`: importable `inspectGeometry(edit)`, `inspectAllEdits()`, `decodeNativePositions(native)` and `inspectNativeEvidence(evidence)`.

`constructScene` returns `{schema, edit, parameters, parts, cameras, cameraTarget, verticalSpan}`. Each part has a semantic `name`, palette `material`, `group`, float32-rounded `positions: [x,y,z][]`, `indices: number[]`, topology `features`, and `worldMatrix: number[16]`. World coordinates are baked into native geometry with identity ECS transforms. Edits re-author the deterministic native vertices; they do not deform a rendered screenshot. `features` only identifies vertex rings; checks derive centers, endpoints and radii from those vertices. Bounds are never the sole geometric evidence.

After worker setup, `window.__CRANE_GEOMETRY__` includes both the source construction and exact native mesh vertex streams after the engine factory (data type, raw data, stride, semantic attribute offsets), submeshes, indices and actual ECS world transforms. Flat native geometry expands indexed source corners. `inspectNativeEvidence` verifies the native positions against that construction exactly. The three material parts of the hollow pipe share source vertex arrays and combine into one closed wall surface with two open bores; topology checks weld by actual coordinate.

`window.__CRANE_READY__` is absent until native WebGPU reports an `ok` submitted swapchain frame, with nonzero draw calls and dimensions 1024 × 1024, and exact mesh evidence is available. It then reports `ok: true`, dimensions, view/edit, native frame diagnostics and scene state. Progress/errors are separate in `__CRANE_PROGRESS__`. `__CRANE_DIAGNOSTICS__` retains the native report; `__CRANE_SNAPSHOT__` retains a snapshot if observed after bootstrap. No fallback backend exists in this implementation.

## Numeric checks

The authored checker validates generated-vertex boom endpoints and lengths, joint centers, hydraulic body/rod endpoints, coaxiality and overlap, world-vertical cable, hook/load/sling attachment coordinates, true wall-through-opening samples and aperture dimensions, pipe centerline/radii/end planes/manifold wall, tier/foot contact, unchanged geometry outside each edit, and rigid assembly movement. Tolerance is 2e-5 m, above float32 rounding at these small coordinates. The independent parent audit should also inspect native evidence, rather than trusting the author's checks alone.

Example CPU entry point (parent may run it):

```js
import { inspectAllEdits } from './geometry-checks.mjs';
const reports = inspectAllEdits();
console.log(JSON.stringify(reports, null, 2));
```

## Appearance and limits

The frozen palette is converted from sRGB to linear before native PBR shading. Lighting uses the specified warm key direction, native PCSS shadow filtering, a broad cool native rectangular area light, low cool ambient fill, and a warm local wall light. The native AgX operator, 4× MSAA and restrained lamp bloom are enabled. No reference grain is recreated. Native real-time shadows/area lighting/AgX are not a claim of exact Cycles integration or Blender AgX Medium High Contrast equivalence. There is no physical lifting, collision or structural simulation.

## Submission validation

Initial source authoring permit allowed static syntax checks only. `node --check` passed for scene, worker, main and geometry-check modules. CPU geometry checks and native browser renders have not been executed by the author in this submission; parent-owned evidence must establish their result. Any further change requires the single separately permitted post-render revision. All captures and failures belong in the parent retained attempt record.
