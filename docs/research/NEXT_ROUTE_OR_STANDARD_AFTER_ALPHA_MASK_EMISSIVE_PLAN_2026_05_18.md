# Next Route Or Standard Follow-Up After Alpha Mask Emissive Plan - 2026-05-18

## Context

`task-1466` added a combined base-color alpha-mask emissive browser fixture. It
reuses the multi-texture status helper, but the alpha-mask and alpha-blend
browser tests now repeat screenshot/readback comparison structure.

Reference anchors inspected:

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/GLB_COMBINED_BASE_COLOR_ALPHA_MASK_EMISSIVE_BROWSER_COVERAGE_AUDIT_2026_05_18.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Candidates

### Material Route Architecture

Start real app-level non-built-in material adapter rendering. This remains a
major architecture milestone, but the route cleanup in this run was enough for
now and the criteria still call for a focused implementation plan before
product-facing custom material behavior.

### StandardMaterial / glTF Fidelity

Add another combined browser fixture, such as base-color alpha-blend emissive.
This would add useful transparency/emissive coverage, but the alpha texture
pixel/readback assertions now have enough repetition that another fixture should
first reduce test risk.

### Diagnostics / Tooling

Extract a focused alpha texture pixel/readback assertion helper for the
StandardMaterial browser tests. The helper can cover opaque-versus-masked and
opaque-versus-translucent comparisons while keeping render-state/status
assertions scenario-specific.

## Selected Follow-Up

Select the diagnostics/tooling slice: extract a shared alpha texture
pixel/readback assertion helper.

Why:

- It is small and test-only.
- It follows the same maintenance pattern as `task-1449`.
- It makes the next alpha-blend/emissive combined fixture safer.
- It does not change runtime behavior or public diagnostics.

## Backlog Entry

```md
### task-1470 — Extract alpha texture browser pixel assertion helper

Category: `docs-tooling`
Package/write-scope: `test/e2e/standard-gltf-texture.spec.ts` only.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_ALPHA_MASK_EMISSIVE_PLAN_2026_05_18.md`,
`test/e2e/standard-gltf-texture.spec.ts`, and existing alpha-mask/alpha-blend
browser tests.

Acceptance criteria:

- Extract a helper for screenshot/readback comparisons shared by alpha-mask
  texture and combined alpha-mask emissive tests.
- Keep alpha-blend translucent comparisons scenario-specific unless the helper
  can support them without weakening assertions.
- Preserve render-state, mapping, readiness, resource, and pipeline assertions.
- Run the full `standard-gltf-texture.spec.ts` Playwright file.
```
