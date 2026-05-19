# Custom Material Source Validation Fixture Implementation Audit

Date: 2026-05-19

Task: `task-1719`

## Scope

Audit the `task-1718` fixture matrix implementation.

Reference files inspected:

- `docs/research/NEXT_SOURCE_VALIDATION_FIXTURE_OR_GLTF_AFTER_TAXONOMY_PLAN_2026_05_19.md`
- `docs/research/CUSTOM_MATERIAL_SOURCE_VALIDATION_FIXTURE_PLAN_AUDIT_2026_05_19.md`
- `docs/research/CUSTOM_MATERIAL_SOURCE_VALIDATION_FIXTURE_MATRIX_2026_05_19.md`
- `docs/research/CUSTOM_MATERIAL_SOURCE_VALIDATION_DIAGNOSTICS_TAXONOMY_2026_05_19.md`
- `docs/DECISIONS.md` Decision 0012
- `docs/ARCHITECTURE.md`

## Findings

- Added a non-binding fixture matrix for future custom material source
  validation tests.
- The matrix covers minimal valid shape, invalid discriminator, family-key
  failures, label warnings, render-state failures, pipeline-key failures,
  binding/dependency declaration failures, metadata warnings, and live renderer
  object rejection.
- Expected diagnostic examples use the `customMaterialSource.*` prefix and
  include only stable JSON-safe fields such as code, severity, field, familyKey,
  expected, and primitive actual values.
- The matrix explicitly excludes raw source objects, source payload bytes,
  WebGPU handles, callbacks, adapter objects, caches, maps, sets, typed arrays,
  promises, and class instances from expected diagnostics.
- No public TypeScript source shape, runtime validator, package export, app
  facade option, shader, prepared-resource adapter, browser fixture, rendered
  custom family, IBL, shadows, or binary GLB loading changed.

## Validation

Covered by final run-level validation for this automation cycle.

## Recommendation

Proceed to tracker/backlog alignment. The next useful source-validation slice is
either a deliberately test-only validator helper plan or a return to
StandardMaterial/glTF browser fidelity if the docs-only custom source track has
enough guardrails for now.
