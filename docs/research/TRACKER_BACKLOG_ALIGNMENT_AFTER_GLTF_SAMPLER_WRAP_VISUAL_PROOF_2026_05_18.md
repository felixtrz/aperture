# Tracker/Backlog Alignment After glTF Sampler Wrap Visual Proof

Date: 2026-05-18

Task: `task-1569`

## Updates

- Updated `docs/index.html` to mention the valid glTF repeat sampler visual
  browser proof and point the next focus at post-sampler-wrap planning.
- Updated `docs/render-pipeline-comparison.html` to include valid glTF repeat
  sampler visual coverage in the render pipeline status.
- Marked `task-1567` through `task-1569` complete in `agent/BACKLOG.md`.
- Added ready follow-up tasks `task-1570` through `task-1574` so the next run
  can choose a focused route or StandardMaterial follow-up before implementing.

## Ready Queue

1. `task-1570` — plan next route or StandardMaterial follow-up after sampler
   wrap proof.
2. `task-1571` — audit selected post-sampler-wrap follow-up plan.
3. `task-1572` — implement selected post-sampler-wrap follow-up.
4. `task-1573` — audit selected post-sampler-wrap implementation.
5. `task-1574` — audit tracker/backlog alignment after selected follow-up.

## Validation

- `pnpm run check:progress`

## Recommendation

Start with `task-1570`. Compare one generic route/prepared-resource candidate
against one StandardMaterial/glTF fidelity candidate and one tooling candidate,
then select exactly one focused implementation follow-up.
