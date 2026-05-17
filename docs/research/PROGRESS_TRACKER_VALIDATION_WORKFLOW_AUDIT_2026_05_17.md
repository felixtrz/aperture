# Progress Tracker Validation Workflow Audit - 2026-05-17

## Scope

Audit the public progress tracker workflow and the new local validation script.

## References Inspected

- `AGENTS.md`
- `README.md`
- `docs/index.html`
- `docs/render-pipeline-comparison.html`
- `scripts/check-progress-tracker.mjs`
- `package.json`
- GitHub Pages `docs/` source rule recorded in current agent workflow docs.

## Findings

The workflow is boundary-safe:

- `scripts/check-progress-tracker.mjs` reads only local static files.
- The check does not make network requests and does not require GitHub Pages,
  credentials, browser automation, or exact percentage values.
- The check validates two freshness dates and all six render-pipeline phase
  status entries.
- `pnpm run check:progress` is wired into `pnpm run check`, so broad validation
  catches stale or structurally incomplete tracker pages.
- `AGENTS.md`, `README.md`, and the tracker footer tell agents when to update
  `docs/index.html`, when render-pipeline work also needs
  `docs/render-pipeline-comparison.html`, and which command validates tracker
  freshness.

## Known Limits

- The freshness threshold defaults to seven days. This is a guardrail for
  automation runs, not a release promise.
- The script intentionally does not validate exact percentages, task ids, or
  public Pages deployment status.
- The script does not parse HTML semantically; it performs stable static checks
  against the current tracker markup.

## Follow-Up

No corrective refactor is required.

If the tracker markup changes substantially, update
`scripts/check-progress-tracker.mjs` in the same patch as the markup change.

## Validation

- `pnpm run check:progress`
- `node --check scripts/check-progress-tracker.mjs`
- `pnpm run check`
