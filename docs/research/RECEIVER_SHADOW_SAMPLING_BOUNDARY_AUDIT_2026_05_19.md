# Receiver Shadow Sampling Boundary Audit — 2026-05-19

## Scope

Audited the GLTF scene shadow receiver path after routing browser-safe combined
StandardMaterial light/shadow group 3 resources through the app facade and
adding the first visible receiver pixel proof.

Reference anchors:

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/standard-frame-resources.ts`
- `packages/webgpu/src/webgpu/standard-light-shadow-bind-group.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `examples/gltf-scene.js`
- `test/e2e/gltf-scene.spec.ts`
- `references/engine/src/scene/renderer/shadow-renderer.js`
- `references/engine/src/scene/renderer/forward-renderer.js`
- `references/three.js/src/renderers/webgl/WebGLShadowMap.js`

## Findings

The receiver path remains renderer-owned derived state:

- ECS authoring still emits light, shadow request, mesh, material, and transform
  data. It does not store WebGPU textures, samplers, bind groups, command
  buffers, or shadow cameras.
- The app facade only enables `standard|shadowMap|...` pipeline keys when live
  renderer-owned receiver resources are present: shadow matrix buffer, shadow
  depth texture/view, and comparison sampler.
- Combined group 3 resources are created in the WebGPU package from renderer
  resource reports and packed light buffers. They are not written back into ECS
  state.
- The GLTF example submits shadow command buffers through the WebGPU queue
  before later frames sample the same renderer-owned depth texture.

JSON-safety is preserved:

- Public status surfaces expose resource keys, counts, statuses, and diagnostic
  codes.
- Raw GPU buffer, texture, view, sampler, bind group, command encoder, command
  buffer, and pipeline handles remain omitted from JSON conversion helpers.
- The Playwright proof checks the shadow route and visible receiver pixel
  difference without inspecting raw GPU handles.

## Notes

The first visible receiver proof intentionally uses a conservative receiver
shadow term once the shadow resources are bound. It proves browser-safe routing,
queue submission, shader variant selection, and pixel-visible receiver sampling.
It is not a final shadow quality result.

## Recommendation

Next narrow task: refine StandardMaterial receiver shadow projection and bias so
the shader uses the depth compare result for localized caster silhouettes while
keeping the same group 3 layout, app route, and Playwright before/after pixel
proof.
