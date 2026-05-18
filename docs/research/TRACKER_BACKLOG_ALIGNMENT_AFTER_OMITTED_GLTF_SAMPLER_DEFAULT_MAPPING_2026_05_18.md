# Tracker/Backlog Alignment After Omitted glTF Sampler Default Mapping

Date: 2026-05-18

Task: `task-1579`

## Updates

- Updated `docs/index.html` to mention omitted glTF sampler source/default
  mapping browser coverage.
- Updated `docs/render-pipeline-comparison.html` to include omitted sampler
  default coverage in the render pipeline status.
- Marked `task-1575` through `task-1579` complete in `agent/BACKLOG.md`.
- Added ready follow-up tasks `task-1580` through `task-1584`.

## Ready Queue

1. `task-1580` — plan next route or StandardMaterial follow-up after omitted
   sampler coverage.
2. `task-1581` — audit selected post-omitted-sampler follow-up plan.
3. `task-1582` — implement selected post-omitted-sampler follow-up.
4. `task-1583` — audit selected post-omitted-sampler implementation.
5. `task-1584` — audit tracker/backlog alignment after selected follow-up.

## Validation

- `pnpm run check:progress`

## Recommendation

Start with `task-1580`. The next planning slice should decide whether to return
to generic material-route architecture or close one more narrow
StandardMaterial/glTF fidelity gap.
