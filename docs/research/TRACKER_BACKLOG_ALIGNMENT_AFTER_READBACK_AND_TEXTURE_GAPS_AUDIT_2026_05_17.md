# Tracker/Backlog Alignment After Readback And Texture Gaps Audit - 2026-05-17

## Scope

Audit public tracker and backlog alignment after:

- app-facade current-texture readback planning;
- StandardMaterial texture browser gap audit;
- controlled metallic-roughness browser verification planning;
- loading/failed base-color texture browser diagnostics.

## References Inspected

- `docs/index.html`
- `docs/render-pipeline-comparison.html`
- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/APP_FACADE_CURRENT_TEXTURE_READBACK_PLAN_2026_05_17.md`
- `docs/research/STANDARD_MATERIAL_TEXTURE_BROWSER_GAP_AUDIT_2026_05_17.md`
- `docs/research/CONTROLLED_STANDARD_METALLIC_ROUGHNESS_BROWSER_VERIFICATION_PLAN_2026_05_17.md`
- `examples/standard-texture-control.js`
- `test/e2e/standard-texture-control.spec.ts`
- `scripts/check-progress-tracker.mjs`

## Findings

- The tracker still pointed at `task-1077` as next work and described only the
  missing-texture StandardMaterial browser diagnostics path.
- The render-pipeline comparison page still listed loading/failed browser
  variants as missing.
- The backlog correctly had `task-1081` for app-facade readback and now has
  `task-1082` for the controlled metallic-roughness browser proof.
- No new decision record is needed. The work stays inside documented
  ECS-authored material assets, render extraction, WebGPU-owned resources, and
  app-facade diagnostics boundaries.

## Updates Made

- Updated `docs/index.html` to show current texture-browser gap audit status,
  loading/failed browser diagnostics, and `task-1081` as the next focus.
- Updated `docs/render-pipeline-comparison.html` so phase 3 no longer lists
  loading/failed browser variants as missing and now calls out controlled
  metallic-roughness browser proof plus app-facade readback as remaining work.

## Result

Tracker and backlog are aligned with the current StandardMaterial browser
coverage. The next recommended task remains `task-1081` because exact
app-facade readback will make future metallic-roughness and sampler assertions
less dependent on screenshot sampling.
