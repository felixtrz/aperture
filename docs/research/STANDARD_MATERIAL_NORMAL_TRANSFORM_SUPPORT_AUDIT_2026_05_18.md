# StandardMaterial Normal Texture Transform Support Audit

Date: 2026-05-18

## Scope

Audit the `task-1204` implementation of `normalTexture`
`KHR_texture_transform` support before selecting another material, lighting, or
route-architecture slice.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/FOLLOW_UP_STANDARD_MATERIAL_TEXTURE_TRANSFORM_PLAN_2026_05_18.md`
- `packages/render/src/materials/gltf-material.ts`
- `packages/render/src/materials/standard-texture-readiness.ts`
- `packages/webgpu/src/webgpu/standard-material-buffer.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `examples/standard-gltf-texture.js`
- `test/materials/gltf-material.test.ts`
- `test/materials/standard-texture-readiness.test.ts`
- `test/webgpu/standard-material-buffer.test.ts`
- `test/webgpu/standard-shader.test.ts`
- `test/e2e/standard-gltf-texture.spec.ts`

## Findings

The implementation stayed within the selected scope:

- It adds only `normalTexture` transform support for finite offset, scale, and
  rotation on `TEXCOORD_0`.
- glTF mapping and StandardMaterial readiness now accept that case.
- WGSL applies the normal texture transform before sampling the normal map.
- The StandardMaterial uniform layout adds one aligned six-float normal
  transform block and remains 16-byte aligned at 144 bytes.
- Tangent requirements, normal-scale behavior, direct lighting, IBL deferral,
  shadows, and binary GLB loading are unchanged.

Unsupported cases remain honest:

- transformed `TEXCOORD_1` remains diagnostic-only;
- transformed occlusion and emissive slots remain diagnostic-only;
- non-finite transforms remain unsupported through the existing finite-transform
  guard;
- no all-slot transform support was introduced.

## Validation

Validation covered both unit and browser paths:

- `node --check examples/standard-gltf-texture.js`
- `pnpm exec vitest run test/materials/gltf-material.test.ts test/materials/standard-texture-readiness.test.ts test/webgpu/standard-material-buffer.test.ts test/webgpu/standard-shader.test.ts`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "transformed normal texture"`
- `pnpm exec vitest run test/materials/gltf-material.test.ts test/materials/standard-texture-readiness.test.ts test/webgpu/standard-material-buffer.test.ts test/webgpu/standard-shader.test.ts test/webgpu/direct-light-readiness.test.ts test/webgpu/app-diagnostics-summary.test.ts test/webgpu/webgpu-app.test.ts`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts`

## Recommendation

The next implementation should not jump to shadows yet. Either:

- plan one more small StandardMaterial texture-fidelity slice for occlusion or
  emissive `TEXCOORD_0` transforms; or
- run a focused route/prepared-resource audit if the next work would otherwise
  broaden the material-family app route.

IBL, shadows, clustered lighting, render targets, and binary GLB viewer work
should remain deferred until the material texture and route contracts stay
stable across one more audited slice.
