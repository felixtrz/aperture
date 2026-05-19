# Custom Material Source Validation Taxonomy Implementation Audit

Date: 2026-05-19

Task: `task-1714`

## Scope

Audit the `task-1713` taxonomy implementation.

Reference files inspected:

- `docs/research/NEXT_SOURCE_VALIDATION_OR_GLTF_AFTER_DECISION_0012_PLAN_2026_05_19.md`
- `docs/research/CUSTOM_MATERIAL_SOURCE_VALIDATION_TAXONOMY_PLAN_AUDIT_2026_05_19.md`
- `docs/research/CUSTOM_MATERIAL_SOURCE_VALIDATION_DIAGNOSTICS_TAXONOMY_2026_05_19.md`
- `docs/DECISIONS.md` Decision 0012
- `docs/DIAGNOSTICS_SUMMARIES.md`
- `docs/ARCHITECTURE.md`

## Findings

- Added a non-binding taxonomy for future custom material source validation
  diagnostics.
- The taxonomy uses a dedicated `customMaterialSource.*` prefix and separates
  source-shape validation from route, dependency readiness, preparation,
  frame-resource, pipeline, and app facade diagnostics.
- It defines candidate codes, severities, stable fields, JSON-safe payload
  limits, disallowed live-object values, validation phases, and relationships to
  existing built-in material and route diagnostics.
- It preserves Decision 0012 by keeping custom source assets data-only and
  banning raw WebGPU handles, callbacks, adapter instances, mutable caches, and
  full source objects from diagnostics payloads.
- No runtime validators, public TypeScript APIs, package exports, app facade
  options, examples, browser tests, shaders, prepared-resource adapters, IBL,
  shadows, binary GLB loading, or rendered custom material families changed.

## Validation

Covered by final run-level validation for this automation cycle.

## Recommendation

Proceed to tracker/backlog alignment. A good next implementation candidate is a
test-only expected input/output fixture for source validation diagnostics, but
runtime validators should wait until the public custom source TypeScript shape
is introduced deliberately.
