# Standard glTF Fidelity Gap Audit Plan Audit - 2026-05-18

## Scope

Audit the selected follow-up from
`NEXT_ROUTE_OR_STANDARD_AFTER_SOURCE_ASSET_INDEX_HELPER_PLAN_2026_05_18.md`.

Reference anchors inspected:

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/DECISIONS.md`
- `docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_SOURCE_ASSET_INDEX_HELPER_PLAN_2026_05_18.md`
- `docs/research/QUEUED_SOURCE_ASSET_INDEX_HELPER_EXTRACTION_AUDIT_2026_05_18.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Findings

The selected follow-up is concrete enough for one focused audit run. It is
bounded to current StandardMaterial/glTF browser fixtures and must recommend one
browser-verifiable implementation slice.

The plan preserves the architecture constraints:

- ECS remains authoritative because the audit targets app-authored
  StandardMaterial assets and extracted route diagnostics.
- Render extraction and WebGPU ownership remain unchanged.
- Route helper cleanup is paused before the next candidate would become a broad
  collector rewrite.
- IBL, shadows, binary GLB loading, and app-level non-built-in rendering remain
  deferred unless the audit finds a direct blocker.

## Recommendation

Proceed with the selected audit. It should compare concrete fidelity candidates
and pick one implementation task rather than extending the route cleanup loop.

## Validation

Documentation-only audit; covered by final formatting and progress checks.
