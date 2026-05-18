# Next Post-Extension Fidelity Or Route Slice Plan

Date: 2026-05-18

## Scope

Compare the next narrow follow-up after unsupported required glTF extension
browser coverage and route-summary cleanup.

## References Inspected

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/research/UNSUPPORTED_REQUIRED_GLTF_EXTENSION_BROWSER_DIAGNOSTIC_AUDIT_2026_05_18.md`
- `docs/research/MATERIAL_FAMILY_ROUTE_MIGRATION_CRITERIA_AUDIT_2026_05_18.md`
- `docs/research/GENERIC_ROUTE_SUMMARY_STALE_STATE_REGRESSION_AUDIT_2026_05_18.md`
- `packages/render/src/materials/gltf-material.ts`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Candidates Compared

### StandardMaterial/glTF fidelity candidate

Add browser/status coverage for invalid glTF render-state fields:
`alphaMode`, `alphaCutoff`, and `doubleSided`.

Why this is useful:

- Unit coverage already proves source mapper diagnostics for invalid render-state
  fields.
- Browser coverage already proves valid alpha-mask/double-sided mapping and
  unsupported required extension propagation.
- The remaining honest-failure gap is showing that invalid render-state mapping
  reaches JSON-safe example status, skips invalid material registration, and
  avoids submitting a misleading draw.

This stays source-side and fixture-side. It does not need shader, WebGPU upload,
IBL, shadow, binary GLB, GLB viewer, or route migration work.

### Route-summary cleanup candidate

Add more route summary group tests around mixed skipped/prepared/failed prepare
statuses across multiple families.

Why this is less urgent:

- `task-1238` and `task-1243` cover the most important stale-state risks:
  reusable route report shells and clean groups after failed route summaries.
- More summary permutations would improve confidence, but they do not unlock the
  glTF fidelity path as directly as the invalid render-state browser diagnostic.

Keep this available if route summaries gain a reusable group shell or new app
route summary writer.

### Material-family migration criterion candidate

Add a test-only non-built-in material-family adapter route through prepare and
frame-resource summaries.

Why this is deferred:

- It is a useful migration criterion, but it is easy to overreach into
  app-level non-built-in rendering before the built-in route summaries are fully
  audited.
- The current app facade still terminates in built-in frame-resource buckets.
  A test-only adapter should wait until the next audit confirms the
  clean-after-failed group regression did not expose more hygiene work.

## Selected Follow-Up

Select the StandardMaterial/glTF fidelity candidate:
`task-1251 — Add invalid glTF render-state browser diagnostic fixture`.

The slice should:

- add a `standard-gltf-texture` scenario with invalid `alphaMode`,
  `alphaCutoff`, and `doubleSided` source values;
- assert `gltfMaterial.invalidField` diagnostics with `materialKey`, `field`,
  and `value` context in JSON-safe status;
- assert invalid mapping prevents material registration and draw submission;
- leave shader behavior, WebGPU upload, route migration, IBL, shadows, binary
  GLB loading, and GLB viewer behavior unchanged.

## Validation

Plan-only task. Validate with touched-file formatting, `pnpm run check:progress`
only if tracker pages are edited, and `git diff --check` in the final run
validation.
