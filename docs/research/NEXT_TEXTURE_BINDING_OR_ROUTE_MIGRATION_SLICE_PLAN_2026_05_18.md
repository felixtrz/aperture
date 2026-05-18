# Next Texture-Binding Or Route-Migration Slice Plan

Date: 2026-05-18

## Scope

Compare the next narrow follow-up after invalid glTF render-state diagnostics.

## References Inspected

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/research/ROUTE_SUMMARY_GROUP_CLEAN_AFTER_FAILED_REGRESSION_AUDIT_2026_05_18.md`
- `docs/research/INVALID_GLTF_RENDER_STATE_BROWSER_DIAGNOSTIC_AUDIT_2026_05_18.md`
- `packages/render/src/assets/gltf-asset-mapping.ts`
- `packages/render/src/materials/gltf-material.ts`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Candidates Compared

### Unresolved glTF texture-binding browser diagnostic

Add a `standard-gltf-texture` expected-failure scenario where a material texture
slot cannot resolve to a valid texture or sampler binding.

Why this is useful:

- Unit coverage already verifies `gltfMaterial.unresolvedTextureBinding`
  behavior and texture/sampler dependency context.
- Browser coverage now proves unsupported required extensions and invalid
  render-state fields skip invalid material registration honestly.
- The next source-mapping honesty gap is unresolved texture binding propagation
  through app/example JSON status and no-draw behavior.

This remains source-mapping/status-side and should not require shader, WebGPU
upload, route migration, IBL, shadows, binary GLB loading, or GLB viewer work.

### Route-migration candidate

Introduce a test-only non-built-in material adapter through a broader app-level
route path.

Why this is deferred:

- Route summary group and route report stale-state hygiene are now covered.
- The app facade still terminates in built-in frame-resource buckets, so a real
  non-built-in app route remains larger than a single diagnostic slice.
- Adding this now risks broadening route behavior before the glTF fidelity
  expected-failure matrix is complete.

### Prepared-resource lifetime/cache candidate

Audit or extend prepared-resource cache summaries for invalid material mapping
and skipped draw paths.

Why this is deferred:

- The invalid mapping scenarios currently stop before prepared material
  resources should exist.
- Cache/lifetime reporting is more valuable after the unresolved binding fixture
  confirms another source-side no-registration/no-draw path.

## Selected Follow-Up

Select the unresolved glTF texture-binding browser diagnostic fixture:
`task-1255`.

The slice should:

- add one expected-failure `standard-gltf-texture` scenario with an unresolved
  texture or sampler binding;
- assert JSON-safe `gltfMaterial.unresolvedTextureBinding` diagnostics include
  material, field, slot, dependency kind, and texture/sampler context;
- assert invalid material mapping prevents material registration, mesh draw
  extraction, pipeline key creation, and draw submission;
- leave shader behavior, WebGPU upload, route migration, IBL, shadows, binary
  GLB loading, GLB viewer behavior, and new material families unchanged.

## Validation

Plan-only task. Validate with touched-file formatting and final
`git diff --check`.
