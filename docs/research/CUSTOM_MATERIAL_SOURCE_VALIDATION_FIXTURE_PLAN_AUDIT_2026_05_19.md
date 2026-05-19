# Custom Material Source Validation Fixture Plan Audit

Date: 2026-05-19

Task: `task-1717`

## Scope

Audit the `task-1716` selected follow-up before implementation.

Reference files inspected:

- `docs/research/NEXT_SOURCE_VALIDATION_FIXTURE_OR_GLTF_AFTER_TAXONOMY_PLAN_2026_05_19.md`
- `docs/research/CUSTOM_MATERIAL_SOURCE_VALIDATION_DIAGNOSTICS_TAXONOMY_2026_05_19.md`
- `docs/DECISIONS.md` Decision 0012
- `docs/DIAGNOSTICS_SUMMARIES.md`
- `docs/ARCHITECTURE.md`

## Findings

- The selected follow-up is concrete enough for one focused run: a docs-only
  fixture matrix with expected custom source validation diagnostics.
- The fixture matrix is a safe bridge between taxonomy and implementation
  because it does not introduce a public TypeScript source shape, runtime
  validator, app facade option, prepared-resource adapter, or rendered custom
  material family.
- The matrix should keep source validation examples separate from route,
  dependency readiness, preparation, frame-resource, pipeline, and app facade
  diagnostics.
- Expected outputs should include only stable diagnostic fields and JSON-safe
  primitive payloads.
- The matrix must continue to ban raw source asset objects, WebGPU handles,
  callbacks, adapter instances, mutable caches, typed arrays, and source payload
  bytes.

## Recommendation

Implement `task-1718` as selected. Keep the result in `docs/research` and
clearly mark it non-binding until a public source TypeScript shape and runtime
validator are deliberately added.
