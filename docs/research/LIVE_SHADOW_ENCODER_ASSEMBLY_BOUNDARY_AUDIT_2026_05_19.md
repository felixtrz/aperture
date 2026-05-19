# Live Shadow Encoder Assembly Boundary Audit — 2026-05-19

## Scope

Audit the shadow caster command-record, depth-only pipeline resource, matrix
bind-group resource, and GLTF scene encoder assembly changes from
`task-1866` through `task-1869`.

Reference anchors inspected:

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `packages/webgpu/src/webgpu/shadow-caster-command-record-plan.ts`
- `packages/webgpu/src/webgpu/shadow-caster-pipeline-resource.ts`
- `packages/webgpu/src/webgpu/shadow-caster-matrix-bind-group-resource.ts`
- `packages/webgpu/src/webgpu/shadow-pass-encoder-assembly-report.ts`
- `examples/gltf-scene.js`
- `references/engine/src/scene/renderer/render-pass-shadow-directional.js`
- `references/three.js/src/renderers/webgl/WebGLShadowMap.js`

## Findings

The implemented path preserves Aperture's ECS/render boundary.

- ECS still emits shadow intent, mesh draws, transforms, and source asset
  handles only.
- Shadow depth textures, shadow caster pipelines, shadow caster matrix bind
  groups, command encoders, and render-pass encoders are created in
  `packages/webgpu` or the GLTF WebGPU example path.
- JSON helpers omit raw `GPUTextureView`, `GPUBuffer`, `GPUBindGroup`,
  `GPURenderPipeline`, and `GPUCommandEncoder` handles.
- Command records are derived from frame-resource keys and renderer-owned
  resources rather than from direct ECS access.
- The encoder assembly begins and ends a depth-only shadow pass and executes
  caster commands, but still reports command-buffer finish, queue submission,
  and StandardMaterial receiver shadow sampling as deferred.

The current `shadowPassEncoderAssembly.status` remains `missing` in the GLTF
status because `shadowCasterFrameResources.status` is still `deferred`, even
though one pass is begun and ended. This is honest enough for the current
diagnostic surface: command execution is live, but the broader shadow pass
resource readiness still carries deferred submission semantics.

## Risks

- `createShadowCasterMatrixBindGroupResourceReport` creates a bind-group layout
  directly rather than through a shared layout cache. This is acceptable for the
  focused slice, but a follow-up should add cached layout/resource reuse if the
  pass runs every frame.
- `ShadowCasterCommandRecordPlanRecord.pipelineResourceKeys` currently mirrors
  the stable pipeline key because `RenderPassCommand` stores pipeline keys, not
  pipeline resource keys. This is JSON-safe, but a future pipeline-resource
  object may need to carry an explicit resource key through command planning.
- The GLTF scene creates and ends a live shadow pass command encoder each frame
  without finishing or submitting it. This is intentionally diagnostic/live
  assembly only, and should remain clearly separate from queue submission until
  the next implementation slice.

## Recommendation

Proceed to a focused shadow pass submission plan before receiver-side
StandardMaterial shadow sampling. The next implementation should finish and
submit the assembled shadow command buffer only when the command encoder,
depth view, executable caster records, and frame-resource readiness are present,
then report submitted pass counts without implying receiver shader sampling.
