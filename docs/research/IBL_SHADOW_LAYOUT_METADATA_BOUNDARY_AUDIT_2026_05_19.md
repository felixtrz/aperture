# IBL/Shadow Layout Metadata Boundary Audit — 2026-05-19

## Task

Completed `task-1845`: audit the new StandardMaterial IBL and shadow
bind-group layout metadata after group 4 and group 5 readiness reports landed.

## Reference Anchors

- `packages/webgpu/src/webgpu/standard-bind-group-layout.ts`
- `packages/webgpu/src/webgpu/standard-bind-group.ts`
- `packages/webgpu/src/webgpu/standard-material-ibl-bind-group-layout.ts`
- `packages/webgpu/src/webgpu/standard-material-shadow-bind-group-layout.ts`
- `packages/webgpu/src/webgpu/standard-material-ibl-shadow-binding-readiness.ts`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md` Decision 0009

## Findings

The layout metadata remains descriptor-only.

- IBL group 4 and shadow group 5 reports expose labels, group numbers,
  bindings, visibility metadata, resource kinds, and deferred readiness
  diagnostics.
- The JSON helpers copy plain data and do not expose `GPUTexture`,
  `GPUTextureView`, `GPUSampler`, `GPUBuffer`, `GPUBindGroup`, or other live
  WebGPU objects.
- Both reports keep `bindGroupResource: false` and `shaderSampling: false`, so
  downstream code cannot mistake layout metadata for live bind-group readiness.

The group assignments do not conflict with current built-in material groups.

- Existing view/shared resources remain group 0/1 through the unlit/shared
  paths.
- Existing StandardMaterial material and texture resources remain group 2.
- Direct light resources use their own light bind-group path.
- IBL group 4 and shadow group 5 are additive StandardMaterial extensions and
  currently only diagnostics/readiness metadata.

The boundary still follows the North Star.

- ECS and render snapshots remain the source of authoring/extracted state.
- Rendering resources remain derived WebGPU backend state.
- No central mutable scene graph or renderer-owned ECS state was added.
- The new reports are JSON-safe and worker-boundary-friendly.

## Corrective Changes

No code change was required for this audit.

The next implementation should continue the proven descriptor-plan-first
pattern by adding group 4 IBL bind-group descriptor planning before live
bind-group creation. That keeps missing specular prefilter resources explicit
while preserving the layout/resource/shader separation.

## Follow-Up

Add `task-1847`: StandardMaterial IBL bind-group descriptor planning.

Acceptance should require:

- group 4 descriptor entries align with the IBL layout metadata;
- diffuse texture and sampler resource keys are included when available;
- the missing specular prefilter resource reports a clear diagnostic;
- GLTF scene status exposes the descriptor plan beside layout metadata; and
- no live `GPUBindGroup` creation or WGSL sampling changes occur.
