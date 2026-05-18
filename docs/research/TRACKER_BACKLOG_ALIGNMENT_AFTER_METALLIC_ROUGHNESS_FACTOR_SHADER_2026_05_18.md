# Tracker Backlog Alignment After Metallic-Roughness Factor Shader

Date: 2026-05-18

Task: `task-1670`

## Scope

Align tracker and backlog state after the StandardMaterial metallic-roughness
factor shader contract regression.

Reference files inspected:

- `docs/NORTH_STAR.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/research/METALLIC_ROUGHNESS_FACTOR_SHADER_CONTRACT_AUDIT_2026_05_18.md`
- `agent/BACKLOG.md`
- `docs/index.html`
- `docs/render-pipeline-comparison.html`

## Updates

- Updated `docs/index.html` to mention metallic-roughness texture factor
  shader contract coverage and set the next focus to selecting app adapter
  registration or glTF browser fidelity follow-up.
- Updated `docs/render-pipeline-comparison.html` prepare-phase status to list
  metallic-roughness texture factor shader contract coverage.

## Validation

- `pnpm run check:progress`

## Recommendation

Use the next run to select a concrete follow-up between app-level adapter
registration planning and a browser-level StandardMaterial/glTF fidelity slice.
