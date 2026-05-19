# GLTF Scene Shadow Depth Resource Summary Implementation — 2026-05-19

## Task

Implemented `task-1835`: add a compact JSON-safe summary bridge for live
shadow depth texture resources.

## Reference Anchors

- `packages/webgpu/src/webgpu/shadow-depth-texture-resource.ts`
- `packages/webgpu/src/webgpu/shadow-command-resource-summary.ts`
- `references/engine/src/scene/renderer/render-pass-shadow-directional.js`

## Implementation

Added `ShadowDepthResourceSummaryReport` in `packages/webgpu`. The summary
reports:

- planned shadow texture descriptor count;
- created depth texture/view resource count;
- stable texture/view resource keys;
- live GPU allocation readiness; and
- deferred matrix upload, pass submission, and StandardMaterial shader sampling.

The GLTF scene status now exposes the compact summary at
`shadow.depthResourceSummary` beside the detailed shadow descriptor, texture,
depth texture, pass, matrix, command, and resource reports.

## Deferred

- Shadow matrix upload.
- Shadow pass command encoding/submission.
- Shadow-map bind-group layout.
- StandardMaterial shadow sampling.
