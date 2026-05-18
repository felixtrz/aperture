# StandardMaterial Occlusion Texture Transform Support Audit

Date: 2026-05-18

## Scope

Audit the `task-1209` implementation of `occlusionTexture`
`KHR_texture_transform` support.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/NEXT_STANDARD_MATERIAL_FIDELITY_OR_ROUTE_AUDIT_PLAN_2026_05_18.md`
- `packages/render/src/materials/gltf-material.ts`
- `packages/render/src/materials/standard-texture-readiness.ts`
- `packages/webgpu/src/webgpu/standard-material-buffer.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Findings

The implementation stayed within the selected texture-fidelity scope:

- It adds only finite `occlusionTexture` transforms on `TEXCOORD_0`.
- glTF mapping and StandardMaterial readiness accept that case.
- The StandardMaterial uniform layout adds an occlusion transform block and
  remains 16-byte aligned at 176 bytes.
- WGSL applies the transform before occlusion sampling and leaves occlusion
  strength behavior unchanged.
- The browser fixture adds `occlusion-transform` and verifies the rendered path
  has no unsupported-transform diagnostics.

Deferred cases remain diagnostic-only:

- transformed `TEXCOORD_1`;
- transformed `emissiveTexture`;
- non-finite transforms;
- all-slot transform support.

The work did not add IBL, shadow maps, binary GLB loading, a new public scene
object, or a new material-family route.

## Validation

Validation run for this slice:

- `node --check examples/standard-gltf-texture.js`
- `pnpm exec vitest run test/materials/gltf-material.test.ts test/materials/standard-texture-readiness.test.ts test/webgpu/standard-material-buffer.test.ts test/webgpu/standard-shader.test.ts`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "transformed occlusion texture"`

## Recommendation

Pause before adding emissive transform support and run `task-1211`, the generic
route/prepared-resource pressure audit. The recent sequence added direct-light
diagnostics plus three StandardMaterial transform expansions; a small boundary
audit is warranted before another implementation slice.
