# Depth Attachment Fix Implementation Audit — 2026-05-19

## Result

`task-1761` satisfies the selected depth attachment criteria. App frames now
allocate a `depth24plus` attachment, attach it to the forward render pass, and
create built-in material pipelines with a non-null depth format.

## Checks

- Opaque built-in pipelines now resolve `depthWriteEnabled: true` and
  `depthCompare: "less"` when `depth24plus` is present.
- Alpha-blend StandardMaterial pipelines keep depth testing but disable depth
  writes.
- The render report exposes only JSON-safe depth metadata, not raw textures or
  texture views.
- Browser coverage uses the app facade and an inter-family overlap where the
  nearer object draws before the farther object, so the test exercises depth
  rejection rather than draw-order success.

## Architecture

The depth texture remains a derived WebGPU render resource owned by the app's
resource cache. ECS remains authoritative for cameras, transforms, meshes,
materials, visibility, layers, and render order. The renderer does not own game
state and no central mutable scene graph was introduced.

## Follow-Up

No corrective follow-up is required for the depth slice. The next useful task is
planning the next renderer/material architecture slice after tracker/backlog
alignment.
