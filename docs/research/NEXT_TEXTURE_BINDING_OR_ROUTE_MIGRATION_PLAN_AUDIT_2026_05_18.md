# Next Texture-Binding Or Route-Migration Plan Audit

Date: 2026-05-18

## Scope

Audit the `task-1253` plan that selected unresolved glTF texture-binding
browser diagnostics as the next implementation slice.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/NEXT_TEXTURE_BINDING_OR_ROUTE_MIGRATION_SLICE_PLAN_2026_05_18.md`
- `docs/research/INVALID_GLTF_RENDER_STATE_BROWSER_DIAGNOSTIC_AUDIT_2026_05_18.md`
- `packages/render/src/assets/gltf-asset-mapping.ts`
- `packages/render/src/materials/gltf-material.ts`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Findings

Pass. The selected follow-up is concrete enough for one focused run and
preserves the architecture boundaries.

The unresolved texture-binding fixture should remain in the existing
`standard-gltf-texture` expected-failure harness. It can use source glTF data
that makes texture or sampler resolution fail, then assert that source mapping
diagnostics and app status explain why the material was not registered.

Boundary checks:

- ECS remains authoritative because the scene is still authored through app
  facade entity/component helpers.
- Render extraction remains the no-draw boundary because the missing material
  handle explains the skipped mesh draw after invalid source registration.
- WebGPU remains backend-owned because the invalid material should stop before
  texture upload, material preparation, pipeline creation, or draw submission.
- JSON status should expose stable diagnostic fields only, not raw texture
  bytes, sampler objects, or GPU/backend resource handles.

## Recommendation

Implement `task-1255` next.

Keep deferred:

- app-level non-built-in material adapter route migration;
- prepared-resource cache/lifetime changes;
- shader behavior changes;
- WebGPU upload changes;
- IBL and shadows;
- binary GLB loading and GLB viewer behavior.

## Validation

Documentation-only audit. Validate with touched-file formatting and final
`git diff --check`.
