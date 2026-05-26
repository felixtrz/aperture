# Custom Material Source Validation Test Helper Plan Audit

Date: 2026-05-19

Task: `task-1722`

## Scope

Audit the `task-1721` selected follow-up before implementation.

Reference files inspected:

- `docs/research/NEXT_VALIDATOR_HELPER_OR_GLTF_AFTER_FIXTURE_MATRIX_PLAN_2026_05_19.md`
- `docs/research/CUSTOM_MATERIAL_SOURCE_VALIDATION_FIXTURE_MATRIX_2026_05_19.md`
- `docs/research/CUSTOM_MATERIAL_SOURCE_VALIDATION_DIAGNOSTICS_TAXONOMY_2026_05_19.md`
- `docs/DECISIONS.md` Decision 0012
- `docs/ARCHITECTURE.md`
- `test/materials/standard-proof-point.test.ts`
- `test/materials/gltf-report-json.test.ts`

## Findings

- The selected follow-up is concrete enough for one focused run: a test-only
  local helper and assertions in `test/materials`.
- The helper must stay inside the test file and must not be exported from
  the retired umbrella package, `@aperture-engine/render`, or any package entrypoint.
- The plan preserves Decision 0012 because it locks expected diagnostic shape
  without adding public source material APIs, runtime validators, app-owned
  adapter facades, prepared-resource adapters, or rendered custom families.
- The JSON-safety assertion should test serialized diagnostics, not full source
  objects, and should prove callbacks, raw object markers, typed arrays, and
  payload bytes do not appear in output.
- Keep the fixture representative rather than exhaustive; production validation
  will need a later public type and package-level tests.

## Recommendation

Implement `task-1723` as selected in a single `test/materials` file, then run
that targeted Vitest file plus typecheck/test validation if practical.
