# Tracker/Backlog Alignment After Emissive-Factor glTF Mapping

Date: 2026-05-18

Task: `task-1609`

## Updates

- Marked `task-1605` through `task-1609` complete in `agent/BACKLOG.md`.
- Added ready follow-up tasks `task-1610` through `task-1614`.
- No public tracker percentage changed; this was focused render-bridge unit
  coverage for the material mapping contract.

## Ready Queue

1. `task-1610` — plan next route or StandardMaterial follow-up after
   emissive-factor mapping coverage.
2. `task-1611` — audit selected post-emissive-mapping follow-up plan.
3. `task-1612` — implement selected post-emissive-mapping follow-up.
4. `task-1613` — audit selected post-emissive-mapping implementation.
5. `task-1614` — audit tracker/backlog alignment after selected follow-up.

## Validation

- Pending: `pnpm run check:progress`

## Recommendation

Start with `task-1610`. Keep the next slice narrow and avoid broad PBR,
non-built-in rendering, IBL, shadows, or binary GLB loading.
