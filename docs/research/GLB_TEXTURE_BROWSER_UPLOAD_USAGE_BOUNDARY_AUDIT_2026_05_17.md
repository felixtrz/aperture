# GLB Texture Browser Upload-Usage Boundary Audit - 2026-05-17

## Scope

Audit the GLB-derived StandardMaterial texture browser fixture and the decoded
glTF texture usage fix from the current run.

This audit does not implement new rendering behavior. It checks whether the
new GLB browser fixture and `copy-dst` source texture usage preserve Aperture's
ECS/render/WebGPU ownership boundaries.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/research/GLB_STANDARD_TEXTURE_BROWSER_FIXTURE_PLAN_2026_05_17.md`
- `docs/research/STANDARD_MATERIAL_TEXTURE_BROWSER_COVERAGE_AFTER_TRANSFORM_GLB_AUDIT_2026_05_18.md`
- `packages/render/src/materials/gltf-texture.ts`
- `packages/webgpu/src/webgpu/app-texture-sampler-resources.ts`
- `packages/webgpu/src/webgpu/texture-resources.ts`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `test/materials/gltf-texture.test.ts`

## Findings

No ownership drift was found.

- `createTextureAssetFromGltfTexture()` still returns renderer-independent
  `TextureAsset` source data. Adding `usage: ["sampled", "copy-dst"]` records
  the intended WebGPU usage flags, but does not create a `GPUTexture`, texture
  view, sampler, bind group, queue, or command encoder.
- WebGPU resource creation remains in
  `packages/webgpu/src/webgpu/app-texture-sampler-resources.ts`, which converts
  source texture usage strings to WebGPU usage flags and passes upload data to
  `createTextureGpuResource()`.
- Texture upload remains backend-owned in
  `packages/webgpu/src/webgpu/texture-resources.ts` through an injected device
  and `queue.writeTexture`.
- `examples/standard-gltf-texture.js` uses glTF mapping and source registration
  reports before authoring ECS mesh/material components. It does not introduce a
  renderer-owned scene node or make WebGPU state authoritative.
- Browser status remains JSON-safe: it publishes fixture/scenario ids, mapping
  counts, registration stage summaries, asset handle keys, pipeline keys,
  diagnostics, draw counts, and optional readback samples. It does not publish
  raw texture bytes, decoded GLB payloads, GPU resources, backend cache maps,
  queues, or encoders.

## Correctness Note

The `copy-dst` usage fix was necessary for decoded glTF image data to render in
the WebGPU browser path. Without that usage, the source asset could carry bytes
but the backend-created texture was not upload-compatible. The fix makes the
source asset honest about its upload requirement while keeping the actual upload
work in the WebGPU backend.

## Remaining Gaps

- The GLB browser fixture is still an inline GLB-equivalent report/source
  registration replay, not a binary `.glb` parser/browser loading path.
- Broader glTF PBR texture browser handoff is still missing for
  metallic-roughness, normal, occlusion, and emissive slots.
- GLB sampler settings are indirectly exercised by rendering but not yet
  explicitly reported in browser status.

## Follow-Up

Keep `task-1107` next if prioritizing GLB/glTF browser fidelity planning.
`task-1109` is a smaller implementation slice if the next run should stay close
to the existing GLB fixture and add sampler mapping status coverage first.

## Validation

- `pnpm exec vitest run test/materials/gltf-texture.test.ts`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts`
- `pnpm run check`
