# Shadow Pass Command-Encoding Boundary Audit — 2026-05-19

## Scope

Audited `ShadowPassCommandEncodingReport` after adding it to the GLTF scene
status path.

This audit checks whether the new report preserves the ECS/render boundary and
whether it is safe to continue toward depth-only shadow pipeline metadata.

## Reference Anchors Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/FIRST_SHADOW_PASS_COMMAND_ENCODING_PLAN_2026_05_19.md`
- `packages/webgpu/src/webgpu/shadow-pass-command-encoding-report.ts`
- `packages/webgpu/src/webgpu/shadow-caster-command-plan-readiness.ts`
- `packages/webgpu/src/webgpu/render-pass-command-executor.ts`
- `examples/gltf-scene.js`
- `test/e2e/gltf-scene.spec.ts`
- `references/engine/src/scene/renderer/render-pass-shadow-directional.js`
- `references/engine/src/scene/renderer/shadow-renderer.js`
- `references/three.js/src/renderers/webgl/WebGLShadowMap.js`

Common reference pattern: shadow rendering is a renderer pass built from light,
caster, matrix, texture, and render-state resources. Aperture's version should
continue to expose typed data records before encoder execution, because the
snapshot boundary must remain serializable and inspectable.

## Findings

The command-encoding report preserves the renderer boundary.

- Inputs are derived render-side reports: shadow pass plans, live depth texture
  resources, live shadow matrix buffer resources, caster draw lists, and caster
  command plans.
- ECS snapshots still carry semantic packets and stable handles only. The new
  report does not read or mutate ECS and does not store GPU handles in ECS data.
- JSON output contains only stable keys, counts, booleans, and diagnostics:
  pass keys, depth texture/view keys, matrix resource keys, command keys, draw
  counts, and status fields.
- Raw GPU objects remain inside resource reports and are omitted by JSON
  helpers. The command-encoding report itself does not store GPU encoders,
  render pass handles, command buffers, pipelines, bind groups, buffers, or
  texture views.
- The report is scratch-backed, matching current hot-path allocation guidance.
  The unit test verifies caller-owned arrays and record objects are reused.
- The GLTF status keeps actual shadow rendering deferred. `shadow.rendering`
  still reports unsupported/deferred behavior, and the command-encoding phase is
  deferred while upstream pass/list/command plans remain deferred.

## Corrective Notes

No corrective code change was required.

The report currently treats a ready command record as data readiness, not as a
submitted GPU pass. That is acceptable because its sections keep
`passSubmission` and `shaderSampling` false. Future work should preserve this
distinction when adding live encoder integration.

## Recommendation

Proceed with `task-1861`: add depth-only shadow caster pipeline descriptor
metadata. That is the next missing prerequisite before a live shadow pass can
bind a pipeline and replay caster draw commands.
