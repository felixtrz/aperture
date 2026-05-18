# Tracker/backlog alignment after metallic-roughness dependency diagnostics - 2026-05-18

## Scope

Audit tracker and backlog alignment after adding
`metallicRoughnessTexture` dependency diagnostics browser coverage.

Reference anchors inspected:

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/index.html`
- `docs/render-pipeline-comparison.html`
- `agent/BACKLOG.md`
- `docs/research/METALLIC_ROUGHNESS_DEPENDENCY_DIAGNOSTICS_BROWSER_COVERAGE_AUDIT_2026_05_18.md`

## Findings

- The public tracker now records metallic-roughness dependency diagnostics as a
  covered StandardMaterial/glTF browser path.
- Render pipeline status now lists slot-specific metallic-roughness dependency
  diagnostics alongside the existing invalid texture/sampler dependency matrix.
- The ready backlog has been refilled with three planning/audit/tracker tasks so
  at least five categorized, scoped tasks remain available.

## Recommendation

Start `task-1534`: audit the remaining StandardMaterial/glTF
texture-dependency gaps after the normal-scale and metallic-roughness dependency
coverage. Use that audit to pick the next narrow browser-verifiable fidelity
slice or to return to route-boundary cleanup if dependency coverage is now
sufficient.

## Validation

- `pnpm run check:progress`
