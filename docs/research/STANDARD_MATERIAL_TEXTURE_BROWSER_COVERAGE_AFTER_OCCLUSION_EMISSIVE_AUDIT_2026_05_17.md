# StandardMaterial Texture Browser Coverage After Occlusion/Emissive Audit - 2026-05-17

## Scope

Audit StandardMaterial browser texture coverage after controlled
metallic-roughness, normal-map, occlusion, and emissive scenarios landed in
`examples/standard-texture-control.js`.

This audit does not change runtime behavior, shader code, app report schemas,
GLB import, IBL, shadows, sampler comparisons, UV1 handling, or texture
transforms.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/STANDARD_MATERIAL_TEXTURE_BROWSER_GAP_AUDIT_2026_05_17.md`
- `docs/research/STANDARD_NORMAL_MAP_BROWSER_BOUNDARY_AUDIT_2026_05_17.md`
- `docs/research/CONTROLLED_STANDARD_OCCLUSION_EMISSIVE_BROWSER_VERIFICATION_PLAN_2026_05_17.md`
- `examples/standard-texture-control.js`
- `test/e2e/standard-texture-control.spec.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `packages/render/src/materials/standard-texture-readiness.ts`

## Updated Slot Matrix

| StandardMaterial slot      | Browser status                                                                 | Remaining browser-visible gap                                                                                |
| -------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `baseColorTexture`         | Controlled positive proof plus missing/loading/failed source texture failures. | Missing sampler failure variants, UV1 sampling proof, sampler comparison, and texture-transform diagnostics. |
| `metallicRoughnessTexture` | Controlled positive proof.                                                     | No UV1, sampler comparison, texture-transform, GLB material, IBL, or shadow-integrated proof.                |
| `normalTexture`            | Controlled positive proof with tangent-enriched mesh.                          | Missing-tangent browser negative path remains open; UV1/sampler/transform/GLB coverage remains deferred.     |
| `occlusionTexture`         | Controlled positive proof under ambient-only lighting.                         | No combined material proof with IBL/shadows; UV1/sampler/transform/GLB coverage remains deferred.            |
| `emissiveTexture`          | Controlled positive proof under low-light conditions.                          | No combined material proof with GLB import; UV1/sampler/transform coverage remains deferred.                 |

## Boundary Check

The expanded controlled browser harness still follows the architecture:

- ECS authoring remains the source of truth via `createWebGpuApp`, typed asset
  collections, handles, and render authoring components.
- Rendering derives from extraction snapshots and WebGPU-owned prepared
  resources. The browser status reports keys, counters, pipeline/layout names,
  diagnostics, and optional readback samples, not GPU objects.
- Scenario-specific lighting is fixture data, not renderer policy.
- The normal-map tangent helper is local test/example fixture data and does not
  introduce automatic tangent generation or a mutable scene graph.

## Recommended Next Work

Keep `task-1091` for the normal-map missing-tangent browser negative path.
After that, `task-1089` and `task-1092` should plan UV1 and sampler comparison
proofs. Texture transforms, GLB import, IBL, and shadows should stay deferred
until the authored StandardMaterial browser coverage is stable.

## Validation

- `pnpm exec playwright test test/e2e/standard-texture-control.spec.ts`
- `pnpm run check`
