# Next Route, Prepared-Resource, Or glTF Fidelity After Diagnostics Plan

Date: 2026-05-18

## Scope

Compare the next route, prepared-resource/cache, or remaining glTF fidelity
slice after the invalid-source browser diagnostics cluster.

## References Inspected

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/research/INVALID_GLTF_TEXTURE_INFO_BROWSER_DIAGNOSTIC_AUDIT_2026_05_18.md`
- `docs/research/UNRESOLVED_GLTF_TEXTURE_BINDING_BROWSER_DIAGNOSTIC_AUDIT_2026_05_18.md`
- `docs/research/MATERIAL_FAMILY_ROUTE_MIGRATION_CRITERIA_AUDIT_2026_05_18.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Candidates Compared

### Route-migration candidate

Move toward app-level non-built-in material-family routing.

Why this is deferred:

- Route-summary hygiene is now stronger, but the app facade still expects
  built-in frame-resource buckets.
- A real non-built-in route would touch app routing and prepared-resource
  contracts together, which is larger than the remaining run window should take
  on without a fresh audit.

### Prepared-resource/cache-reporting candidate

Extend an existing invalid-source browser fixture to assert that renderer
resource counts stay at zero.

Why this is useful:

- The invalid-source fixtures already prove no pipelines or draw calls are
  submitted.
- Adding explicit zero resource counts closes the next observable gap: invalid
  source mapping should not create prepared texture resources, samplers,
  material buffers, or bind groups.
- This remains an assertion over derived render/app status and does not change
  resource ownership or cache behavior.

### Remaining glTF fidelity candidate

Add another source-diagnostic browser fixture for a different malformed glTF
field.

Why this is deferred:

- The current browser suite now covers unsupported required extensions, invalid
  render state, unresolved texture bindings, and invalid texture-info fields.
- The next best value is proving these invalid-source paths also produce no
  prepared-resource work before returning to broader route migration.

## Selected Follow-Up

Select the prepared-resource/cache-reporting candidate:
`task-1264 — Add invalid-source no-prepared-resource browser summary`.

The slice should:

- extend one existing invalid-source `standard-gltf-texture` expected-failure
  scenario status assertion;
- assert zero texture resources, sampler resources, material buffers, bind
  groups, pipeline keys, draw packages, draw commands, and draw calls;
- keep the assertion JSON-safe and avoid raw GPU/backend resources;
- leave shader behavior, WebGPU upload, route migration, IBL, shadows, binary
  GLB loading, GLB viewer behavior, and new material families unchanged.

## Validation

Plan-only task. Validate with touched-file formatting and final
`git diff --check`.
