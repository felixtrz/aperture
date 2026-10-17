# Procedural scenes and repeatable still images

Start with the app facade (`@aperture-engine/app/config` and
`@aperture-engine/app/systems`). Author scene state in systems, keep simulation
independent of the DOM, and render its extracted snapshot. The same scene can
then serve an interactive browser app and Dawn-backed Node tools.

## Get a useful first image early

1. Lock the camera, aspect ratio, subject scale and lighting before adding detail.
   Use a ground receiver, the default environment, and a shadow-casting sun.
2. Block out the large shapes with `mesh.box`, `mesh.cylinder`, `mesh.sphere`, and
   `mesh.extrude`. Use an extrusion with holes for a moon gate instead of manually
   triangulating the opening. See the mesh options in the API reference.
3. Capture that blockout. Check framing and lighting before authoring roof tiles,
   plants or decorative details. Save the source and render settings with it.
4. Add repeated details using shared meshes/materials and instances where suitable.
   Keep parts separate when they need different editing, motion or materials.

For flat-shaded custom forms, `mesh.triangleList({ positions, label })` constructs
face normals for an explicit triangle list. Keep outward faces counterclockwise
when viewed from outside. Inspect one face or one roof segment before repeating
it. Do not hide inverted winding by disabling culling throughout the scene.

For fitted panels and shells, prefer `mesh.polygons({ faces })`: author planar
3D outlines and optional holes, and let Aperture triangulate them. A tapered car
cabin with fitted window openings reads as one designed shape; stacked glass and
pillar boxes often do not. See [polygon surface authoring](POLYGON_SURFACE_AUTHORING.md)
and the runnable car recipe. Use an ECS group for repeated assemblies so their
parts retain local coordinates when the whole prop moves or rotates.

Avoid coplanar surfaces: place water below bridge/path geometry and separate pond
banks from the water plane. A glossy surface needs an environment to reflect.
Use dielectric materials for plaster, wood and stone; tune roughness before
introducing metallic values. Keep AO subtle and inspect contact regions as well
as silhouettes. AO should strengthen contact, not draw an outline around objects.

## Capture an explicit browser frame

The generated browser app exposes `captureFrame({ delta, time, timeoutMs })` on
the result of `startGeneratedBrowserApp`. The public helper waits for generated
startup without polling renderer diagnostics:

```ts
import { captureGeneratedFrame } from "@aperture-engine/app/browser";

const frame = await captureGeneratedFrame({ delta: 0, time: 0 });
try {
  // Take a screenshot or read the output here, while presentation is held.
  console.log(frame.frame, frame.timings);
} finally {
  await frame.release();
}
```

Capture pauses the worker, applies one explicit step, transfers an owned snapshot
and its assets, drains existing renderer work, renders that snapshot, and awaits
GPU completion. Simulation advancement, automatic presentation and canvas resize
remain suspended until release. Release restores the prior pause/cadence state.
Only one capture may be held at a time. Always release in `finally`; capturing
without releasing intentionally freezes presentation.

For renderer-only integrations use `app.captureSnapshot(snapshot)` and release
its synchronous lease after readback. Do not mutate the selected snapshot, source
assets or externally owned output while the lease is held. An explicit time
controls that step; it does not rewind application state or replace a seeded
random generator. Start from the same scene state for reproducible images.

In this cloud environment use the approved wrapper and `render:cloud` with
`--capture-time 0`. It starts generated simulation paused, selects the frame,
checks native WebGPU execution, and asserts no new draws/submissions occurred
through screenshot readback. See [the rendering runbook](CLOUD_LOCAL_RENDERING.md).
No custom readiness script or guessed delay is needed for generated apps.

## Use Dawn for Node tooling

Use a headless config with the same systems and render defaults, then:

```sh
aperture headless aperture.headless.config.ts --out garden.bundle.json \
  --render-width 1200 --render-height 900 --asset-mode strict
aperture render garden.bundle.json --backend dawn --out garden.png
```

Bundles carry camera state, embedded assets, MSAA, tone mapping, exposure, SSAO
and bloom. A retained render session (`aperture render serve` or MCP) can reuse
the device and immutable pipeline caches across edits. Each job still owns fresh
scene resources. See [Dawn rendering](DAWN_NODE_RENDERING.md).

For custom material appearance, use [shader materials](SHADER_MATERIALS.md).
For a fullscreen fragment shader or compute pass without an ECS scene, use the
[shader-first route](SHADER_FIRST.md). Both can use Dawn tooling; a procedural ECS
garden does not need custom WGSL to benefit from it.

## Measure quality and effort separately

Record dispatch-to-first-image, capture-request-to-PNG, iteration count,
agent/tool usage, final image quality, and failures. Keep simulation time,
resolution, camera, assets, effects, adapter and image tolerance identical when
comparing render routes. Report fresh-process startup separately from warm
session renders. Exclude judge and unrelated queue time from authoring cost.

`cpuTimings.portable` separates snapshot decode, asset restoration, renderer
initialization, environment preparation and render submission. Dawn also reports
GPU completion wait, readback and PNG encoding. These are wall-clock stages,
not GPU timestamps; a fence measures outstanding GPU work and scheduling delay.
A faster codec cannot remove expensive GPU shading. Disabling an effect is a
quality change and must be labeled as an ablation, not a same-image speedup.
