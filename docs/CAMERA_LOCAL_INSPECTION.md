# Inspect local assembly geometry through a camera

`CameraHandle.inspectLocal(request)` and the `camera_inspect_local` tool project caller-owned local landmarks through current ECS transforms. Use the same local coordinates that construct an assembly, then inspect again after changing its root or descendants. The operation resolves transforms on every call; it does not advance simulation, run systems, change camera parameters, or require a renderer.

The result includes pixels, clipping evidence, optional target residuals, ordered triangle facing, and optional static mesh source bounds. An optional `cameraJob` seed feeds the existing [camera project/fit workflow](CAMERA_LANDMARKS.md). Inspection does not fit a camera or decide whether a composition is good.

For actual selected vertex extrema in an existing bundle, use [offline projected bounds inspection](PROJECTED_BOUNDS_INSPECTION.md). Local bounds-only inspection already works without a resource in a live CPU app; its source-AABB corners and offline vertex extrema answer different geometric questions, and neither establishes visibility.

## Share construction features

This setup system shares dimensions between its geometry and local inspection inputs. A selector is either `{ key }` or a generation-checked `{ index, generation }` reference. Keys must resolve to exactly one active entity. Names identify caller-owned landmarks; they do not require extra ECS entities or a separate transform graph.

```ts
import {
  createSystem,
  defineResource,
  material,
  mesh,
  resource,
  type CameraLocalInspectionRequest,
  type CameraLocalInspectionResult,
} from "@aperture-engine/app/systems";

const CameraProbe = defineResource("authoring.cameraProbe", {
  request: resource.value<CameraLocalInspectionRequest | null>(null),
  inspection: resource.value<CameraLocalInspectionResult | null>(null),
});

export default class Scene extends createSystem() {
  override init(): void {
    const width = 4;
    const height = 3;
    const depth = 2;
    const features = {
      top: [0, height / 2, 0] as const,
      front: [
        [-width / 2, -height / 2, depth / 2],
        [width / 2, -height / 2, depth / 2],
        [0, height / 2, depth / 2],
      ] as const,
    };
    const assembly = this.spawn.group({
      key: "assembly",
      transform: { translation: [2, 0, -1] },
    });
    this.spawn.mesh({
      mesh: mesh.box({ size: [width, height, depth] }),
      material: material.standard(),
      transform: { parent: assembly },
    });
    this.spawn.camera({
      key: "camera.main",
      transform: { translation: [6, 4, 8], lookAt: [2, 0, -1] },
      camera: { autoAspect: true },
    });

    const request: CameraLocalInspectionRequest = {
      viewport: { width: 1200, height: 900 },
      subjects: [
        {
          name: "box",
          entity: { index: assembly.index, generation: assembly.generation },
          points: [
            {
              name: "top",
              local: features.top,
              target: [600, 280],
              weight: 1,
            },
          ],
          faces: [
            {
              name: "front",
              localTriangle: features.front,
            },
          ],
          bounds: { source: "mesh-local-aabb", includeDescendants: true },
        },
      ],
      cameraJob: { referenceDistance: 10 },
    };
    this.resources.set(CameraProbe, {
      request,
      inspection: this.cameras.main.inspectLocal(request),
    });
  }
}
```

`this.cameras.byKey("camera.main")` selects a handle explicitly. The facade's existing `main` selection rules still apply; the tool below always requires an explicit camera selector. A previously obtained camera handle retains its original generation, so it cannot silently select a replacement entity.

Changing `height` changes both construction and the named top feature on the next
source evaluation. Use the same pattern for a sampled vertex or attachment point;
copying dimensions into a separate request file would lose that connection.

## Finite CPU probe after the first image

For the static setup above, run from your app directory with the installed CLI on
PATH and your existing headless config. This boots the real CPU app, reads the
source-computed resource and disposes the session at shutdown/EOF. It needs no
browser or GPU. Keep application logging on stderr, away from protocol stdout.

```sh
set -eu
aperture headless serve aperture.headless.config.ts --seed 7 --asset-mode strict > probe.responses.jsonl 2> probe.stderr.log <<'JSONL'
{"id":"probe","cmd":"tool","params":{"name":"resource_get","arguments":{"id":"authoring.cameraProbe"}}}
{"id":"done","cmd":"shutdown"}
JSONL

node --input-type=module <<'JS'
import { readFileSync, writeFileSync } from 'node:fs';
const rows = readFileSync('probe.responses.jsonl', 'utf8')
  .split(/\r?\n/).filter(line => line.trim()).map(line => JSON.parse(line));
const matches = rows.filter(row => row.id === 'probe');
if (matches.length !== 1 || matches[0].ok !== true) {
  throw new Error(JSON.stringify({ message: 'Probe failed', matches }));
}
const inspection = matches[0].result.resource.values.inspection;
if (inspection == null || inspection.ok !== true) {
  throw new Error(JSON.stringify(inspection));
}
const report = inspection.result;
writeFileSync('probe.report.json', JSON.stringify(report, null, 2) + '\n');
if (report.cameraJob == null) {
  throw new Error(JSON.stringify(report.cameraJobDiagnostics));
}
writeFileSync('probe.camera-job.json', JSON.stringify(report.cameraJob, null, 2) + '\n');
JS
aperture camera project probe.camera-job.json --out probe.project.json
```

Stdout is NDJSON containing readiness and response envelopes. **Exit zero alone
does not mean the request succeeded**: handled failures return `ok: false`.
Check both the envelope and saved inspection as above. Export rejection leaves a
valid inspection report saved, with `cameraJob: null` and diagnostics. For
inspection alone, omit `cameraJob` in the request and skip export/project.

The resource is an **init-time snapshot**, not an automatically fresh query.
Reboot after source edits; after live ECS edits call `inspectLocal(request)` again.
Init may precede imported asset readiness. For fresh post-preload bounds, fetch
`values.request` and send a subsequent `tool` request named
`camera_inspect_local` with arguments `{ camera: { key: "camera.main" },
...request }` in the same session. The saved resource stays unchanged. Startup
runs actual app initialization/preload; inspection adds no simulation step. If
your scene requires updates, explicitly send and record a `step` first.

To compare projection families, add enough independently measured features and
use the [same-landmark comparison](CAMERA_LANDMARKS.md#compare-projection-families)
with explicit bounds. The single top point above is a probe, not enough to fit a
general camera.

## Existing browser and MCP sessions

For an already running managed browser, save `{ camera: { key: "camera.main" },
...request }` as `inspect-local.json`, then use
`aperture tool camera_inspect_local --json "$(cat inspect-local.json)"`.
This command does not boot the CPU app. MCP also supports the existing
`target: "headed" | "headless"` and `appRoot` routing fields. Worker and warm
headless sessions call the same app operation. A saved render bundle cannot
resolve arbitrary groups or fresh ECS edits; inspection needs live ECS state.

## Result contract

Both routes return `{ ok: true, result }` or `{ ok: false, diagnostics }`. Invalid selectors, malformed inputs, unsupported viewport modes, singular camera matrices, and relevant unresolved hierarchy errors fail the operation. Unrelated transform-resolution diagnostics appear as warnings on `result.diagnostics`.

- `result.source` is `"resolved-ecs"`. It includes the selected camera reference, effective aspect and its source, resolved camera matrix, and view-projection matrix. Subject references and matrices show the exact resolved frames used.
- Each point includes copied `local`, resolved `world`, top-left-origin `pixel`, WebGPU `ndc` with depth in `[0, 1]`, `clipW`, and positive-forward `cameraDepth`. `inFront` tests positive camera depth; `inDepthRange` tests positive clip W and NDC depth; `inViewport` tests NDC X/Y only. `inFrustum` combines all three. Coordinates remain unclamped outside the viewport. Undefined projections use `null`, never NaN/Infinity.
- A point's optional `target` and `weight` are copied. `residual` is projected pixel minus target; `errorPixels` is its Euclidean magnitude. Both are `null` without a target or defined projection. If finite residual components have a magnitude outside the numeric range, `errorPixels` is `null` and a `residualOverflow` warning explains why. A finite residual can still describe a point behind the camera, so consult the clipping flags. Weight must be positive and requires a target; it is carried into the fit seed and does not change the geometric residual.
- A face transforms its three ordered vertices, then computes their world-space cross product. This handles nested nonuniform scale, shear, and reflection without an incorrect normal transform. `facingCosine > 0` means the ordered normal points toward the camera: perspective uses centroid-to-eye direction; orthographic uses the common viewing direction. Degenerate triangles and a perspective eye at the centroid return explicit status and `null` facing. This does not evaluate occlusion, material culling, or an aesthetic threshold.
- Bounds include every selected `Mesh` asset's eight local-AABB corners transformed by that mesh's resolved matrix. `includeDescendants` follows authoritative `Parent` relationships; it includes offscreen meshes, avoids repeated traversal within a subtree, and does not apply visibility/layer filtering. Overlapping subjects remain separately reported. `screenBounds` is the unclamped union of projected source-box corners, not a rendered silhouette. It is `null` for empty/incomplete source bounds or any box crossing or preceding the near/eye plane; individual corner evidence remains. Bounds wholly beyond the far plane can still have an envelope, with corner depth flags showing clipping.

Bounds are explicitly **static source bounds**. Missing/loading assets or invalid local AABBs produce an `incomplete` report and no partial aggregate. Known skin/morph use receives an undeformed-bounds warning. Custom vertex displacement, skinning/morph evaluation, sprites/billboards, particles, trails, non-mesh renderables, and render interpolation are outside this operation. Caller-provided points/faces are geometric construction annotations, not evaluated deformed vertices. These limitations are present in every report, including when no bounds were requested.

## Fit seed export

Omit `cameraJob` for inspection alone. Requesting it requires `referenceDistance > 1e-6`: the distance from the current camera eye along its resolved forward axis. ECS stores a camera orientation, not an original look-at target or orbit distance. This explicit distance chooses that gauge; the operation does not infer a target from an assembly centroid.

When export succeeds, save **only** `result.cameraJob` as a camera job JSON file. It contains `viewport`, `camera`, and `landmarks`, matching the existing strict CLI schema. Landmark names encode `[subjectName, pointName]` as JSON text to preserve uniqueness. Only explicitly supplied points become landmarks. Their targets and weights are carried through; faces and AABB corners do not silently become fit constraints. Add explicit `fit.parameters` bounds or `"fixed"` settings before `camera fit` as described in [CAMERA_LANDMARKS.md](CAMERA_LANDMARKS.md).

Export requires an unparented, unit-scale, zero-roll, world-Y-up camera, an aspect matching the viewport, supported FOV/elevation/coordinate ranges, and landmarks independent of the selected camera. Inspection itself can use parented, rolled, scaled, or sheared cameras with invertible resolved transforms. Unsupported export leaves a valid inspection result with `cameraJob: null` and `cameraJobDiagnostics` explaining the incompatibility.

Export also compares every explicit point through both the reconstructed engine camera and the existing job's analytic initial camera model. A difference above **0.05 pixels**, or an undefined projection, refuses export. This is a numerical representation guard, not a fit-quality threshold. It catches Float32 cancellation at large coordinates even when two engine matrices agree. The existing project/fit command remains responsible for its own conditioning, bounds, engine precision, convergence, and acceptance diagnostics after fitting.

## Scope and freshness

Viewport width and height are explicit render pixels, positive integers up to 1,000,000. Full normalized viewport/scissor, no render target, and zero temporal jitter are required. With `autoAspect`, the operation computes the effective Float32 aspect from those dimensions without mutating the camera; fixed-aspect cameras keep their authored aspect. Supplying a different size from the render target deliberately inspects that hypothetical viewport, so use the actual render dimensions for correspondence.

Pass 1–256 named subjects, at most 4,096 total points/faces, and at most 4,096 selected mesh bounds per call. Local coordinates, target pixels, weights, and reference distance use the existing job's finite numeric domain of ±1e12 (weights are positive). Names are unique within each list and at most 256 characters. Each subject requires points, faces, or a bounds request. Relevant entities need `LocalTransform` and `WorldTransform`; unresolved parents/cycles are errors.

Every invocation refreshes derived `WorldTransform` values, including after direct indexed writes that do not increment a world version. It does not execute animation, physics, or application systems. It reports the current authored ECS state, not a prediction of the next simulation frame or a GPU image. Rerun after pose, geometry, camera, or viewport changes; do not reuse saved world coordinates as authoritative assembly state.
