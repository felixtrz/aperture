# Next Material Route Or Standard Follow-Up After GLB Combined Base Color Occlusion Emissive Plan - 2026-05-18

## Context

Two combined StandardMaterial browser fidelity slices landed in this run:
base-color plus metallic-roughness plus normal, and base-color plus occlusion
plus emissive. The next slice should reduce repetition or move architecture
forward without losing the tight browser-safety loop.

Reference anchors inspected:

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/GLB_COMBINED_BASE_COLOR_OCCLUSION_EMISSIVE_BROWSER_COVERAGE_AUDIT_2026_05_18.md`

## Candidates

### Material Route Architecture

Start app-level non-built-in material adapter rendering. This remains the main
architecture gap, but it still needs an API decision and should not be rushed at
the end of a texture-fidelity-heavy run.

### StandardMaterial / glTF Fidelity

Add another combined texture fixture, such as base-color plus alpha-mask plus
emissive. This would add coverage, but the E2E file now has enough repeated
multi-texture assertion shape that another slice should first reduce test
duplication.

### Diagnostics / Tooling

Extract a focused helper for multi-texture StandardMaterial browser status
assertions. The helper can keep existing coverage unchanged while making the
next combined fixture less error-prone.

## Selected Follow-Up

Select the diagnostics/tooling slice: extract shared multi-texture
StandardMaterial browser status assertions.

Why:

- It is small and test-only.
- It reduces duplication introduced by the recent combined texture scenarios.
- It keeps the next implementation safer without changing runtime architecture.

## Backlog Entry

Add `task-1449` after the selected-plan audit:

```md
### task-1449 — Extract multi-texture StandardMaterial browser assertion helper

Category: `docs-tooling`
Package/write-scope: `test/e2e/standard-gltf-texture.spec.ts` only.
Reference anchor:
`docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_GLB_COMBINED_BASE_COLOR_OCCLUSION_EMISSIVE_PLAN_2026_05_18.md`,
`docs/ARCHITECTURE.md`, and the existing combined StandardMaterial browser
tests.

Acceptance criteria:

- Extract a small helper for asserting multi-texture glTF asset mapping,
  readiness slots, resource counts, and pipeline keys.
- Refactor the combined base-color plus metallic-roughness, combined
  base-color/metallic-roughness/normal, and combined
  base-color/occlusion/emissive tests to use it.
- Keep screenshot/readback assertions scenario-specific.
- Run the full `standard-gltf-texture.spec.ts` Playwright file.
```
