# Custom Material Source Validation Test Helper Implementation Audit

Date: 2026-05-19

Task: `task-1724`

## Scope

Audit the `task-1723` test-only fixture implementation.

Reference files inspected:

- `docs/research/NEXT_VALIDATOR_HELPER_OR_GLTF_AFTER_FIXTURE_MATRIX_PLAN_2026_05_19.md`
- `docs/research/CUSTOM_MATERIAL_SOURCE_VALIDATION_TEST_HELPER_PLAN_AUDIT_2026_05_19.md`
- `test/materials/custom-material-source-validation-fixture.test.ts`
- `docs/research/CUSTOM_MATERIAL_SOURCE_VALIDATION_FIXTURE_MATRIX_2026_05_19.md`
- `docs/DECISIONS.md` Decision 0012
- `docs/ARCHITECTURE.md`

## Findings

- Added a local test-only custom material source validation fixture in
  `test/materials/custom-material-source-validation-fixture.test.ts`.
- The helper covers valid minimal shape, invalid discriminator, reserved and
  malformed family keys, invalid labels, render-state failures, pipeline-key
  failures, malformed bindings/dependencies, metadata warnings, and live
  renderer object/callback/typed-array rejection.
- Diagnostics use the `customMaterialSource.*` prefix and the test asserts route
  or app diagnostic codes are not mixed into this source-shape layer.
- JSON-safety coverage verifies serialized diagnostics omit raw hidden handles,
  source payload byte fields, and byte arrays.
- The helper stays local to the test file and is not exported from any package.
- No public custom material source API, runtime package validator, app facade
  option, shader, prepared-resource adapter, browser fixture, rendered custom
  family, IBL, shadows, or binary GLB loading changed.

## Validation

- `pnpm exec vitest run test/materials/custom-material-source-validation-fixture.test.ts`

## Recommendation

Proceed to tracker/backlog alignment. The custom material source docs/test
guardrail is now strong enough to return to either a package-level validation
design plan or a StandardMaterial/glTF browser fidelity slice.
