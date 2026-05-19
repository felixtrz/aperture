# Shadow Pass Submission Boundary Audit

Date: 2026-05-19

## Scope

Audit the live shadow pass command-buffer submission slice after adding
`ShadowPassCommandBufferSubmissionReport` and wiring it into the GLTF scene
status.

Relevant local anchors:

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `packages/webgpu/src/webgpu/shadow-pass-command-buffer-submission-report.ts`
- `packages/webgpu/src/webgpu/shadow-pass-encoder-assembly-report.ts`
- `packages/webgpu/src/webgpu/shadow-caster-pipeline-resource.ts`
- `packages/webgpu/src/webgpu/shadow-caster-matrix-bind-group-resource.ts`
- `packages/webgpu/src/webgpu/command-buffer.ts`
- `packages/webgpu/src/webgpu/queue-submit.ts`
- `examples/gltf-scene.js`
- `test/e2e/gltf-scene.spec.ts`

Reference pattern checked:

- `references/engine/src/platform/graphics/webgpu/webgpu-render-pipeline.js`
  creates explicit pipeline layouts from bind group layouts.
- `references/three.js/src/renderers/webgpu/utils/WebGPUPipelineUtils.js`
  creates reusable `GPUPipelineLayout` objects for compatible bind groups.
- `references/three.js/src/renderers/webgpu/utils/WebGPUTexturePassUtils.js`
  also shows the alternate pattern of deriving bind-group layouts from
  `pipeline.getBindGroupLayout(0)`.

## Findings

The submission report preserves the ECS/render boundary. It consumes an
assembled shadow encoder report and renderer-owned command encoder, finishes the
command buffer, and reports stable command-buffer keys. No command buffer or
command encoder handle is written into ECS state, render snapshots, or public
JSON status.

The GLTF scene currently reports the first shadow command buffer as `ready`, not
`submitted`. This is honest: the command buffer is finished, queue submission is
still deferred, and receiver shader sampling remains deferred.

The JSON helpers remain safe. `shadowPassCommandBufferSubmissionReportToJsonValue`
copies scalar counts, sections, command-buffer keys, and diagnostics only. The
targeted unit test verifies raw GPU-like handles are not serialized.

The command-buffer slice exposed one real WebGPU compatibility issue: the
depth-only shadow pipeline was originally created with an automatic layout while
the matrix bind group used a separately-created explicit layout. WebGPU rejects
that pair during `drawIndexed`. The fix is boundary-preserving: the shadow
pipeline resource now creates one explicit matrix bind-group layout and pipeline
layout when the device supports it, and the matrix bind-group resource can reuse
that exact layout. This keeps GPU resources renderer-owned and follows the
common reference pattern of sharing explicit pipeline layouts.

## Recommendation

Do submission hardening next, before receiver sampling. Receiver shadow sampling
needs a populated shadow depth texture; the next implementation slice should
submit the finished shadow command buffer through the GLTF app queue, report
`submittedCommandBuffers: 1`, and keep receiver sampling deferred. After that,
plan and bind StandardMaterial receiver shadow sampling.

Follow-up completed in the same run: the GLTF scene now submits the shadow
command buffer through the live WebGPU queue and reports receiver binding
readiness while WGSL receiver sampling remains deferred.
