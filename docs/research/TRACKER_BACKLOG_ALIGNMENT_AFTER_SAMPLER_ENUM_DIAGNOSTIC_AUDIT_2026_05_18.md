# Tracker Backlog Alignment After Sampler Enum Diagnostic Audit

Date: 2026-05-18

## Scope

Audit tracker and backlog alignment after invalid glTF sampler-index and
sampler-enum browser diagnostic coverage.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/index.html`
- `docs/render-pipeline-comparison.html`
- `agent/BACKLOG.md`
- `docs/research/INVALID_GLTF_SAMPLER_INDEX_BROWSER_DIAGNOSTIC_AUDIT_2026_05_18.md`
- `docs/research/INVALID_GLTF_SAMPLER_ENUM_BROWSER_DIAGNOSTIC_AUDIT_2026_05_18.md`

## Findings

Pass after tracker and backlog updates.

The public tracker now records invalid sampler-index and invalid sampler-enum
browser diagnostics. The render pipeline comparison keeps six phase-status
entries and lists both sampler failure paths as working collect/prepare
diagnostics with zero prepared-resource assertions.

The ready backlog remains concrete and categorized after completed tasks move to
`agent/COMPLETED.md`:

- `task-1294` — plan material-family extensibility contract.
- `task-1295` — plan optional glTF material-extension warning status.
- `task-1297` — audit material-family extensibility contract plan.
- `task-1298` — audit optional glTF material-extension warning status plan.
- `task-1299` — audit tracker/backlog alignment after extensibility or
  optional-extension planning.

## Recommendation

Start with `task-1294` unless the next run wants to stay entirely on
StandardMaterial/glTF fidelity, in which case start with `task-1295`.

Keep deferred:

- app-level non-built-in material adapter routing until `task-1294` settles the
  extensibility contract;
- IBL, shadows, binary GLB loading, and GLB viewer behavior.

## Validation

- `pnpm run check:progress`
