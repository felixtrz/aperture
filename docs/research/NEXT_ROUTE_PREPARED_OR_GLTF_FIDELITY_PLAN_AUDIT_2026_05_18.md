# Next Route, Prepared-Resource, Or glTF Fidelity Plan Audit

Date: 2026-05-18

## Scope

Audit the `task-1257` plan that selected malformed glTF texture-info browser
diagnostics as the next route/prepared/fidelity follow-up.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/NEXT_ROUTE_PREPARED_OR_GLTF_FIDELITY_SLICE_PLAN_2026_05_18.md`
- `docs/research/UNRESOLVED_GLTF_TEXTURE_BINDING_BROWSER_DIAGNOSTIC_AUDIT_2026_05_18.md`
- `packages/render/src/assets/gltf-asset-mapping.ts`
- `packages/render/src/materials/gltf-material.ts`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Findings

Pass. The selected follow-up is concrete enough for one focused run.

Malformed glTF texture-info diagnostics are a source-mapping concern. The
browser fixture can stay within the existing expected-failure harness and should
not require route migration, prepared-resource cache changes, shader changes,
WebGPU upload changes, or new material families.

Boundary checks:

- ECS remains authoritative because the fixture continues to author the scene
  through the app facade and ECS component helpers.
- Render extraction remains the no-draw boundary because invalid material
  registration should surface as a missing material handle.
- WebGPU remains backend-owned because invalid source mapping should stop before
  texture upload, material preparation, pipeline creation, or draw submission.
- JSON status should expose diagnostic scalar context only, not raw source
  texture objects, texture bytes, sampler objects, or backend handles.

## Recommendation

Implement `task-1259` next.

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
