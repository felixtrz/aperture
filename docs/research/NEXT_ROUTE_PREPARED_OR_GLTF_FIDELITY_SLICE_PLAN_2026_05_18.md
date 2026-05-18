# Next Route, Prepared-Resource, Or glTF Fidelity Slice Plan

Date: 2026-05-18

## Scope

Compare the next route, prepared-resource/cache, or remaining
StandardMaterial/glTF fidelity slice after invalid render-state and unresolved
texture-binding browser diagnostics.

## References Inspected

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/research/UNRESOLVED_GLTF_TEXTURE_BINDING_BROWSER_DIAGNOSTIC_AUDIT_2026_05_18.md`
- `docs/research/ROUTE_SUMMARY_GROUP_CLEAN_AFTER_FAILED_REGRESSION_AUDIT_2026_05_18.md`
- `packages/render/src/assets/gltf-asset-mapping.ts`
- `packages/render/src/materials/gltf-material.ts`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Candidates Compared

### Route-migration candidate

Add a test-only non-built-in adapter through a broader app-level frame-resource
route.

Why this is deferred:

- Route reports, route summary groups, and stale-state resets are now covered.
- The app facade still has built-in frame-resource buckets, so a real app-level
  non-built-in route remains a larger boundary change.
- The next implementation should avoid widening app route behavior immediately
  after several source-diagnostic browser slices.

### Prepared-resource/cache-reporting candidate

Add reporting around skipped invalid-material scenarios to prove no prepared
material resources or backend cache entries are created.

Why this is deferred:

- Current browser statuses already prove no pipeline keys and no draw calls for
  invalid source mapping.
- Cache-level reporting is valuable, but it is more useful once the remaining
  malformed texture-info source diagnostic is covered through the browser
  harness.

### StandardMaterial/glTF fidelity candidate

Add browser/status coverage for malformed glTF texture-info fields such as
invalid `index` or `texCoord` on a StandardMaterial texture slot.

Why this is useful:

- Unit coverage already exercises invalid texture-info diagnostics.
- Browser coverage now includes unsupported required extensions, invalid
  render-state fields, and unresolved texture bindings.
- Malformed texture-info fields are the remaining small source-diagnostic
  browser gap before returning to route migration or prepared-resource/cache
  reporting.

## Selected Follow-Up

Select the StandardMaterial/glTF fidelity candidate:
`task-1259 — Add invalid glTF texture-info browser diagnostic fixture`.

The slice should:

- add one expected-failure `standard-gltf-texture` scenario with malformed
  texture-info fields;
- assert JSON-safe `gltfMaterial.invalidTextureInfo` diagnostics include
  material, field, slot, and value context;
- assert invalid material mapping prevents material registration, mesh draw
  extraction, pipeline key creation, and draw submission;
- leave shader behavior, WebGPU upload, route migration, IBL, shadows, binary
  GLB loading, GLB viewer behavior, and new material families unchanged.

## Validation

Plan-only task. Validate with touched-file formatting and final
`git diff --check`.
