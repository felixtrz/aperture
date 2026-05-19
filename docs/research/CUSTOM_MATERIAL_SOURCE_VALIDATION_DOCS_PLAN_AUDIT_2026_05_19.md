# Custom Material Source Validation Docs Plan Audit

Date: 2026-05-19

Task: `task-1727`

## Scope

Audit the `task-1726` selected follow-up before implementation.

Reference files inspected:

- `docs/research/NEXT_PACKAGE_VALIDATOR_OR_GLTF_AFTER_TEST_FIXTURE_PLAN_2026_05_19.md`
- `docs/DIAGNOSTICS_SUMMARIES.md`
- `docs/DECISIONS.md` Decision 0012
- `docs/research/CUSTOM_MATERIAL_SOURCE_VALIDATION_DIAGNOSTICS_TAXONOMY_2026_05_19.md`
- `docs/research/CUSTOM_MATERIAL_SOURCE_VALIDATION_FIXTURE_MATRIX_2026_05_19.md`
- `test/materials/custom-material-source-validation-fixture.test.ts`

## Findings

- The selected follow-up is concrete and docs-only.
- Promoting the boundary into `docs/DIAGNOSTICS_SUMMARIES.md` is safe now that
  Decision 0012, the taxonomy, the fixture matrix, and the test-only guardrail
  all agree on source-vs-route separation.
- The docs update should not imply that a package-level validator, public custom
  material source type, app-owned adapter facade, or rendered custom material
  family exists.
- The section should make `customMaterialSource.*` diagnostics distinct from
  `queuedMaterialPrepareRoute.*`, `webGpuApp.*`, StandardMaterial texture
  readiness/fidelity, and renderer preparation diagnostics.
- JSON-safe payload guidance should stay compact and avoid copying the full
  taxonomy into the public summary page.

## Recommendation

Implement `task-1728` as selected in `docs/DIAGNOSTICS_SUMMARIES.md`, then run
format/progress validation.
