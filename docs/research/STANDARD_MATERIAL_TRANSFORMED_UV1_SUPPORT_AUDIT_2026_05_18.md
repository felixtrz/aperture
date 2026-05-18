# StandardMaterial Transformed UV1 Support Audit

Date: 2026-05-18

## Scope

Audit the `task-1220` implementation of finite transformed `TEXCOORD_1`
support for StandardMaterial texture bindings.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/research/NEXT_TRANSFORMED_UV1_OR_LIGHTING_BOUNDARY_PLAN_2026_05_18.md`
- `packages/render/src/materials/gltf-material.ts`
- `packages/render/src/materials/standard-texture-readiness.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`
- `test/materials/gltf-material.test.ts`
- `test/materials/standard-texture-readiness.test.ts`
- `test/e2e/standard-gltf-texture.spec.ts`
- `references/bevy/crates/bevy_mesh/src/components.rs`
- `references/bevy/crates/bevy_render/src/render_resource/bind_group.rs`

## Findings

The implementation stayed within the selected scope:

- finite transforms are now accepted on `TEXCOORD_0` and `TEXCOORD_1` for the
  currently rendered StandardMaterial texture slots;
- glTF material mapping preserves finite `KHR_texture_transform` data on
  `TEXCOORD_1` without an unsupported-transform warning;
- StandardMaterial readiness accepts transformed UV1 bindings when the mesh has
  `TEXCOORD_1`;
- transformed `texCoord > 1` still emits structured unsupported-transform and
  unsupported-texCoord diagnostics;
- the browser fixture now renders and readbacks transformed base-color sampling
  through `TEXCOORD_1`.

No WebGPU route, material family, prepared-resource type, app diagnostics field,
IBL path, shadow path, or GLB viewer behavior was added. The change relies on
the existing StandardMaterial shader path, which already selects `uv` versus
`uv1` before applying texture transforms.

The Bevy reference remains conceptual: mesh/material authoring stays handle
based, and render-resource bindings stay renderer-owned. Aperture preserves
that split by keeping transformed UV data in source material assets while GPU
buffers, bind groups, and shader variants remain in `@aperture-engine/webgpu`.

## Validation

- `node --check examples/standard-gltf-texture.js`
- `pnpm exec vitest run test/materials/gltf-material.test.ts test/materials/standard-texture-readiness.test.ts test/webgpu/standard-shader.test.ts`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "transformed base-color through TEXCOORD_1"`

## Recommendation

Proceed to `task-1222`: plan the next narrow StandardMaterial sampler,
color-space, or route/prepared-resource slice. Do not start IBL, shadows, or GLB
viewer work until the next plan explicitly selects that boundary.
