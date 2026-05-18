# DebugNormalMaterial Route Readiness

Date: 2026-05-18

## Scope

Map what already exists for DebugNormalMaterial and what must be added before it
can become an active app-level material route.

This is a readiness map, not an activation task. App-level DebugNormalMaterial
rendering remains deferred.

## References Inspected

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/research/NEXT_ROUTE_PREPARED_AFTER_INVALID_PIPELINE_VIEW_PLAN_2026_05_18.md`
- `docs/research/DEBUG_NORMAL_ROUTE_READINESS_PLAN_AUDIT_2026_05_18.md`
- `packages/render/src/materials/debug-normal-preparation.ts`
- `packages/render/src/materials/factories.ts`
- `packages/render/src/materials/types.ts`
- `packages/webgpu/src/webgpu/debug-normal-pipeline-descriptor.ts`
- `packages/webgpu/src/webgpu/debug-normal-shader.ts`
- `test/webgpu/built-in-material-queue-family.test.ts`
- `test/webgpu/built-in-material-queue-adapter.test.ts`
- `test/webgpu/debug-normal-pipeline-descriptor.test.ts`
- `test/webgpu/debug-normal-shader.test.ts`

## Present Pieces

### Source Material Asset

`DebugNormalMaterialAsset` is a renderer-independent source material kind in the
render package. `createDebugNormalMaterialAsset()` creates source data with:

- `kind: "debug-normal"`;
- a label;
- normal `RenderStateDescriptor` authoring data;
- `unsupportedFeatures` for validation parity with other material families.

This source asset stays ECS/render-authoring data. It does not contain GPU
buffers, bind groups, shader modules, or pipeline handles.

### Preparation Plan

`createDebugNormalMaterialPreparationPlan()` validates a material handle against
the asset registry, requires a ready `debug-normal` material, validates the
source material asset, checks dependency readiness, and emits a pipeline-key
input.

This is the correct renderer-independent preparation shape. It still stops short
of WebGPU resource preparation.

### Shader Metadata

`DEBUG_NORMAL_MESH_SHADER` declares a WGSL shader that visualizes world normals
as RGB and documents these bindings:

- group 0: view projection uniform;
- group 1: world transform storage buffer;
- group 2: debug-normal material uniform.

`validateDebugNormalShaderMetadata()` and the shader tests pin the required
metadata.

### Pipeline Descriptor Plan

`createDebugNormalPipelineDescriptorPlan()` can build descriptor-like data and a
cache key for `debug-normal` pipeline keys. It validates:

- shader metadata;
- color format;
- topology;
- required batch-key fields;
- `debug-normal` pipeline family;
- required `POSITION` and `NORMAL` vertex attributes.

This is a pipeline-planning surface, not active app routing.

## Current Blockers

DebugNormalMaterial is intentionally not active in the app-level built-in route.
Current tests pin that:

- `BUILT_IN_MATERIAL_QUEUE_FAMILIES` is `unlit`, `matcap`, and `standard`;
- the built-in route adapter registry returns no adapter for `debug-normal`;
- app-level debug-normal queue items fail with unsupported-family diagnostics.

The missing activation pieces are:

1. A WebGPU debug-normal material uniform buffer resource.
2. A debug-normal material bind group layout and bind group resource.
3. DebugNormalMaterial texture/sampler dependency handling, even if the first
   version has no external dependencies.
4. A frame-resource helper equivalent to the unlit/matcap/standard helpers.
5. A built-in app resource adapter entry that routes `debug-normal` only after
   the frame-resource path exists.
6. App diagnostics and resource summary coverage showing `debug-normal` routed
   resources without raw GPU handles.
7. Browser/WebGPU pixel coverage proving world-normal colors render through the
   public app facade.

## Safe Activation Sequence

1. Add renderer-owned debug-normal material buffer and JSON-safe inspection
   tests.
2. Add debug-normal bind group layout and bind group resource helpers with raw
   handles omitted from JSON helpers.
3. Add debug-normal frame-resource preparation tests that consume prepared mesh
   resources, material buffers, and bind groups without touching ECS/source
   assets.
4. Add a built-in route adapter only after frame resources can be produced.
5. Update unsupported-family tests at the same time the route is activated so
   expectations move from unsupported diagnostics to routed resource summaries.
6. Add WebGPU app tests for a debug-normal entity, asserting queue/resource
   summaries and no raw GPU handles.
7. Add browser pixel coverage for a simple mesh with predictable normals.

## Guardrails

- Do not make DebugNormalMaterial a renderer-owned scene object.
- Do not store GPU resources on ECS components or source material assets.
- Do not add it to `BUILT_IN_MATERIAL_QUEUE_FAMILIES` before frame resources can
  be produced and tested.
- Do not claim StandardMaterial, IBL, shadows, GLB viewer behavior, or broader
  custom shader support from this route.

## Recommended Next Task

Add a debug-normal material buffer resource helper and tests. Keep the slice
renderer-owned and JSON-safe; do not activate app routing yet.
