# StandardMaterial Emissive Texture Transform Support Audit

Date: 2026-05-18

## Scope

Audit the `task-1213` implementation of `emissiveTexture`
`KHR_texture_transform` support.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/NEXT_POST_TRANSFORM_MATERIAL_LIGHTING_BOUNDARY_PLAN_2026_05_18.md`
- `docs/research/GENERIC_ROUTE_PREPARED_RESOURCE_PRESSURE_AUDIT_2026_05_18.md`
- `packages/render/src/materials/gltf-material.ts`
- `packages/render/src/materials/standard-texture-readiness.ts`
- `packages/webgpu/src/webgpu/standard-material-buffer.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Findings

The implementation stayed within the selected scope:

- It adds finite `emissiveTexture` transforms on `TEXCOORD_0`.
- glTF mapping and StandardMaterial readiness accept that case.
- The StandardMaterial uniform layout adds an emissive transform block and
  remains 16-byte aligned at 208 bytes.
- WGSL applies the transform before emissive texture sampling.
- The browser fixture adds `emissive-transform` and verifies the rendered path
  has no unsupported-transform diagnostics.

The implementation did not add:

- transformed `TEXCOORD_1` support;
- IBL or shadows;
- binary GLB scene loading;
- a new material-family route;
- a public scene object.

## Coverage

Focused coverage now exists for all currently rendered StandardMaterial texture
slots on `TEXCOORD_0`:

- base color;
- metallic-roughness;
- normal;
- occlusion;
- emissive.

Unsupported transformed UV1 remains diagnostic-only, which is the correct
boundary before adding broader UV set handling.

## Recommendation

Stop adding texture-transform slots for now. The next task should be a cleanup
or architecture-alignment slice around StandardMaterial route/prepared-resource
lifetime, cache reporting, or generic material-family app routing before IBL,
shadows, binary GLB viewer work, or transformed UV1 support.
