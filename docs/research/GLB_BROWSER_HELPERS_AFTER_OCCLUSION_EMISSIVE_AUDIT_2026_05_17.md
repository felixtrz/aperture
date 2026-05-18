# GLB Browser Helpers After Occlusion/Emissive Audit

Date: 2026-05-17

## Scope

Audit `standard-gltf-texture` after the queued collector extraction and the
new GLB-derived occlusion, emissive, and alpha-mask/double-sided browser
scenarios.

This audit checks ownership boundaries, status JSON-safety, and helper drift. It
does not add new shader features, binary `.glb` loading, texture-transform
sampling, transparent blending, or pixel-level alpha-mask texture coverage.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `packages/render/src/assets/gltf-asset-mapping.ts`
- `packages/render/src/assets/gltf-source-registration-orchestration.ts`

## Findings

- The GLB browser fixture still authors source assets through glTF mapping and
  `registerGltfSourceAssetsFromReports()`, then renders ECS entities with
  `withMesh()` and `withMaterial()`. No renderer-owned scene graph or WebGPU
  object becomes source-of-truth state.
- The new occlusion and emissive scenarios publish texture slot, handle keys,
  sampler mapping, expected slot-specific factors, counters, diagnostics, and
  optional readback samples. They do not publish raw texture bytes, backend
  caches, GPU resources, queues, encoders, pipelines, bind groups, or command
  handles.
- The alpha-mask/double-sided scenario is intentionally texture-free. It
  publishes a `standardMaterial.renderState` summary with glTF source fields and
  mapped StandardMaterial render-state fields. The pipeline key currently uses
  `standard|mask|none|less|none`, matching the active pipeline token contract.
- Playwright keeps JSON-safety checks active through
  `expectStatusJsonSafeForGpu(status)` and explicit sampler assertions that
  reject backend resource fields.
- Fixture branching has grown but remains local to the example and test. The
  ready backlog already contains `task-1124` to extract local helper cleanup for
  texture-slot expectations and render-state status construction.

## Decision

No corrective production refactor is needed in this audit slice. The next useful
step is the already queued helper cleanup, followed by planning the next generic
material-family frame-resource split.

## Validation

The current run validated this audit context with:

- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts`
- `pnpm run check:progress`
- `pnpm run check`
