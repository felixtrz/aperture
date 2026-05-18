# GLB StandardMaterial Texture-Transform Diagnostics Browser Plan - 2026-05-18

## Scope

Plan a minimal browser fixture proving a GLB/glTF material with
`KHR_texture_transform` is mapped honestly into StandardMaterial source data and
blocked before draw submission by the existing unsupported-transform readiness
diagnostic.

This is a planning slice. It does not implement the browser fixture, texture
transform sampling, shader changes, full binary GLB loading, UV1, IBL, shadows,
or broader glTF PBR support.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/research/GLB_STANDARD_TEXTURE_BROWSER_FIXTURE_PLAN_2026_05_17.md`
- `docs/research/CONTROLLED_STANDARD_TEXTURE_TRANSFORM_DIAGNOSTICS_BROWSER_PLAN_2026_05_17.md`
- `docs/research/GLB_SAMPLER_TEXTURE_TRANSFORM_READINESS_AUDIT_2026_05_17.md`
- `examples/standard-gltf-texture.js`
- `examples/standard-texture-control.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `test/e2e/standard-texture-control.spec.ts`
- `packages/render/src/materials/gltf-material.ts`
- `packages/render/src/materials/standard-texture-readiness.ts`

## Current State

The authored browser harness already proves that a non-identity
`MaterialTextureBinding.transform` on `baseColorTexture` becomes
`render.standardMaterialTexture.unsupportedTextureTransform` and submits no
draws.

The new GLB-derived base-color fixture proves glTF material, texture, sampler,
and mesh source registration can feed the normal app-facade render path. It does
not include `KHR_texture_transform`.

The glTF material mapper already preserves `KHR_texture_transform` values in the
source material binding and emits a JSON-safe
`gltfMaterial.unsupportedTextureTransform` warning. StandardMaterial readiness
then treats the preserved non-identity transform as a blocking draw-readiness
diagnostic.

## Selected Browser Fixture

Extend `examples/standard-gltf-texture.js` with
`?scenario=base-color-transform`.

Use the same inline GLB-equivalent root as the positive base-color fixture, but
author the material texture info as:

```js
baseColorTexture: {
  index: 0,
  extensions: {
    KHR_texture_transform: {
      offset: [0.25, 0],
    },
  },
}
```

Keep the same decoded 2x2 sRGB texture, nearest clamp sampler, mesh
construction report, source registration path, camera, and lights. The point is
to isolate the transformed GLB material handoff, not to add another visual
texture proof.

## Expected Status Fields

Publish JSON-safe fields for:

- fixture/scenario id;
- `gltf.assetMapping.valid`;
- asset-mapping diagnostic count and codes, including
  `gltfMaterial.unsupportedTextureTransform`;
- registration stage summaries;
- material, texture, sampler, and mesh handle keys;
- `standardTexture.textureSlot: "baseColorTexture"`;
- `standardTexture.expectedTextureTransform`;
- extraction counts and promoted render diagnostic codes;
- empty pipeline keys and zero draw calls.

Do not publish raw texture bytes, glTF binary chunks, GPU resources, backend
cache maps, queues, encoders, or WebGPU handles.

## Expected Browser Assertions

The Playwright test should assert:

- status is JSON-safe and treated as an expected failure;
- `ok: true`, `phase: "expected-failure"`, `expectedFailure: true`;
- asset mapping remains valid with exactly one material, one texture, and one
  sampler;
- mapping diagnostics include `gltfMaterial.unsupportedTextureTransform` as a
  warning, not an error;
- registration succeeds so the failure is clearly draw readiness, not missing
  source assets;
- extraction reports zero mesh draws and a promoted
  `render.standardMaterialTexture.unsupportedTextureTransform` diagnostic;
- draw calls are zero;
- pipeline key arrays are empty;
- no WebGPU validation warnings are emitted.

## Non-Goals

- Do not implement texture-transform sampling.
- Do not add a real GLB parser/browser file fixture.
- Do not combine with UV1, repeat/mirror samplers, normal maps, IBL, shadows,
  or alpha blending.
- Do not change the public app report shape; this remains example-owned status.

## Follow-Up Task

### task-1105 - Add GLB StandardMaterial texture-transform diagnostics browser fixture

Category: `runtime-orchestration`
Package/write-scope: `examples/standard-gltf-texture.js`,
`test/e2e/standard-gltf-texture.spec.ts`, and targeted docs if tracker status
changes.
Reference anchor:
`docs/research/GLB_STANDARD_TEXTURE_TRANSFORM_DIAGNOSTICS_BROWSER_PLAN_2026_05_18.md`,
the GLB-derived base-color browser fixture, and the authored
`base-color-transform` controlled scenario.

Acceptance criteria:

- Add `standard-gltf-texture?scenario=base-color-transform` with
  `KHR_texture_transform` preserved in the mapped StandardMaterial binding.
- Browser status reports JSON-safe mapping warnings, expected transform metadata,
  successful source registration, promoted render diagnostics, empty pipeline
  keys, and zero draw calls.
- Playwright proves the fixture fails honestly before submission without
  claiming texture-transform sampling support.
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "texture transforms"`
  and `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts` pass.
