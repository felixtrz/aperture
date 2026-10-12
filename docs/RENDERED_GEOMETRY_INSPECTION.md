# Inspect submitted static mesh geometry

Enable bounded capture when creating a generated app:

```ts
import { defineApertureConfig } from "@aperture-engine/app/config";

export default defineApertureConfig({
  mode: "browser",
  canvas: "#aperture",
  render: {
    cadence: "manual",
    geometryInspection: { maxRetainedBytes: 32 * 1024 * 1024 },
  },
  // Existing systems, components and resources remain in the worker.
});
```

Then use the browser app's read-only inspection method after a frame is rendered:

```ts
await app.ready;
await app.renderFrame({ deltaSeconds: 0 });
const geometry = app.inspectRenderedGeometry({
  maxBytes: 16 * 1024 * 1024,
  maxVertices: 250_000,
  maxIndices: 750_000,
  maxInstances: 25_000,
});

if (geometry.status === "complete") {
  for (const draw of geometry.draws) {
    const mesh = geometry.meshes.find((entry) => entry.key === draw.meshKey)!;
    // mesh.positions and mesh.normals are packed local-space float32 triples.
    // draw.worldMatrices holds every submitted WORLD matrix in GPU instance
    // order. Each matrix uses column-major storage and occupies 16 floats.
    console.log(mesh.label, mesh.indices, draw.instances, draw.worldMatrices);
  }
} else {
  console.log(geometry.omissions);
}
```

The defaults are deliberately bounded. Large scenes may return `partial` even
when every draw is a supported static mesh. Inspect the omissions before raising
limits. A `request-budget` omission can be retried synchronously with explicit
larger request bounds:

```ts
let geometry = app.inspectRenderedGeometry();
if (
  geometry.status === "partial" &&
  geometry.omissions.some((entry) => entry.reason === "request-budget")
) {
  console.log(geometry.omissions);
  geometry = app.inspectRenderedGeometry({
    maxBytes: 128 * 1024 * 1024,
    maxVertices: 2_000_000,
    maxIndices: 6_000_000,
    maxMeshes: 4_096,
    maxDraws: 10_000,
    maxInstances: 100_000,
  });
}
if (geometry.status !== "complete") console.log(geometry.omissions);
```

Raising a request limit cannot restore bytes excluded by the capture budget. If
capture reports `capture-budget`, create the app with an explicitly larger
`render.geometryInspection.maxRetainedBytes` (up to `128 * 1024 * 1024`) and submit
the scene again. Other omissions identify unsupported geometry or unavailable
bindings; increasing budgets does not resolve them. Always check the final
status before treating a result as complete within its declared scope.

`geometryInspection: true` uses the 32 MiB capture budget. Omitted or `false`
disables capture and retains no extra mesh or matrix bytes. The lower-level
`createWebGpuApp` option and `WebGpuApp.inspectRenderedGeometry` use the same
contracts. Inspection is synchronous; it never requests worker execution or
GPU readback.

Each result owns its numeric arrays. Editing or transferring those arrays cannot
change ECS, mirrored source assets, future inspection results, or rendering.
Readonly records describe those owned copies; typed arrays themselves remain
editable. A mesh appears once per submitted upload version. Draws preserve their
actual index/vertex ranges, base vertex, view, target, submesh and material slot.
Repeated or batched meshes contain every instance matrix, rather than an estimate
based on the representative draw packet.

Disposal releases the renderer's capture containers and closes inspection.
Calling `inspectRenderedGeometry` afterward throws a disposed-app error. Owned
results already returned remain the caller's responsibility.

Capture retains exact source upload bytes once per successful upload version.
An in-place update patches only the ranges actually written to the GPU. The
previous receipt stays alive while the last submitted frame still references it.
Source registry replacement, source array edits and new unsubmitted snapshots
cannot rewrite the captured frame. Failed attempts that submit no command buffer
leave the previous inspection intact. A later readback or report failure does not
erase an accepted submission. If one target submits and a later target fails,
the result retains the succeeded subset and reports the failed target. Older
asynchronous report completion cannot replace newer submitted geometry.
`submissionSerial` tracks actual recorded
submissions and is separate from the simulation `frame`.

The scope is static triangle-list mesh draws in the submitted scene passes.
Sky/fullscreen passes, shadow-only draws, sprites, UI, text and particles are
outside that scope. Fragment discard, opacity and shader visibility do not turn
source triangles into a pixel-visible geometry claim. Skinned and morphed draws,
unsupported POSITION/NORMAL formats, and unknown indirect GPU arguments receive
explicit omissions. Custom WGSL and user render/compute passes make the recorded
route unavailable because they can change geometry outside CPU static receipts.
No base-pose, shader-deformed or guessed geometry is presented as complete.
Engine-owned CPU-written indirect buffers use their exact retained argument
bytes, including signed base vertices. Arbitrary external GPU buffer writes and
compute deformation are outside this CPU-receipt API; it is not GPU readback.

Source buffers include vertices and indices outside individual draw ranges. Use
each draw's range to derive submitted triangles; multiplying full mesh buffers
by instance count also counts unused geometry. This generic recipe uses only the
public result:

```ts
import type {
  RenderedGeometryDraw,
  RenderedGeometryMesh,
} from "@aperture-engine/app/browser";

function* drawTriangles(
  mesh: RenderedGeometryMesh,
  draw: RenderedGeometryDraw,
) {
  const count = draw.indexed ? draw.indexCount : draw.vertexCount;
  const vertexAt = (element: number) =>
    draw.indexed
      ? mesh.indices![draw.firstIndex + element]! + draw.baseVertex
      : draw.firstVertex + element;
  for (let element = 0; element + 2 < count; element += 3) {
    yield [vertexAt(element), vertexAt(element + 1), vertexAt(element + 2)];
  }
}

if (geometry.status === "complete") {
  const meshes = new Map(geometry.meshes.map((mesh) => [mesh.key, mesh]));
  const referencedSourceVertices = new Set<string>();
  let submittedTriangleInstances = 0;
  for (const draw of geometry.draws) {
    const mesh = meshes.get(draw.meshKey)!;
    for (const triangle of drawTriangles(mesh, draw)) {
      for (const vertex of triangle) {
        referencedSourceVertices.add(`${mesh.key}:${vertex}`);
        const localPosition = mesh.positions.subarray(
          vertex * 3,
          vertex * 3 + 3,
        );
        // Apply each draw.worldMatrices window to this local position to inspect
        // every submitted instance. Translations occupy offsets 12, 13 and 14.
        void localPosition;
      }
      submittedTriangleInstances += draw.instances.length;
    }
  }
  console.log(referencedSourceVertices.size, submittedTriangleInstances);
}
```

Shared mesh keys deduplicate source vertex references across submeshes and draws.
Every draw and instance contributes separately to submitted triangle multiplicity,
including repeated views/targets. These are counts within the declared static
geometry scope, not total GPU allocations, pixel visibility or performance.

Missing normals and non-indexed meshes stay `null`; inspection never generates
normal or index data. POSITION and present NORMAL attributes currently require
float32x3, including valid interleaved streams and non-zero typed-array offsets.
Index buffers retain their source uint16 or uint32 format and declared count.

Capture and request budgets are separate. Capture defaults to 32 MiB and is
bounded by 128 MiB of retained typed-array payload, with at most 4,096 uploaded
mesh receipts, 10,000 submitted draw records and 100,000 instances per captured
frame, with at most 16 retained pending submissions. Pending submissions, cached
receipts and receipts pinned by the last frame
all count toward that cap. Exact world-transform and engine-written indirect
argument buffer mirrors also count toward the cap. Receipt replacement can require room for both old
and new bytes until the prior submission is released. Cache eviction releases
unreferenced receipts; app disposal releases all capture state.

Reusing cached material, queued mesh, render-bundle or static shadow resources
also refreshes their exact prepared mesh/material dependencies. A static scene
keeps its receipts available across long runs without uploading the same geometry
again. Entries that stop being used still expire after 120 render invocations;
reactivation prepares current assets if the prior dependency was retired or
replaced. This lifecycle also applies with inspection disabled. Logical cache
eviction is distinct from native buffer destruction: the app owns its GPU
allocations and releases them during replacement retirement or disposal.

The default request bounds are 16 MiB, 1,024 meshes, 250,000 vertices, 750,000
indices, 4,096 draws and 25,000 instances. Explicit requests may increase these
only up to 128 MiB, 4,096 meshes, 2,000,000 vertices, 6,000,000 indices, 10,000 draws
and 100,000 instances. Invalid, negative, fractional or non-finite limits throw.
Zero request limits are valid. A budget excludes a whole draw and its required
mesh and reports `request-budget`; it never clips an instance list silently.
`copiedBytes` and `retainedBytes` count CPU typed-array payload and make no GPU
allocation or performance claim.

This API can support author inspection and geometry export. Benchmark source
audits still establish provenance, and independent native observations still
establish actual rendering and performance.
