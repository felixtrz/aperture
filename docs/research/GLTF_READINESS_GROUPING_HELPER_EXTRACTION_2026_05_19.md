# GLTF Readiness Grouping Helper Extraction — 2026-05-19

## Task

`task-1824` verified the grouped GLTF readiness status is generated through a
small named helper rather than embedded directly in the status object literal.

## Result

`examples/gltf-scene.js` now uses `createReadinessGrouping` from
`publishFrameStatus` before calling `publishStatus`. The helper builds:

- `readiness.ibl.status`
- `readiness.ibl.phases`
- `readiness.shadow.status`
- `readiness.shadow.phases`

Detailed report objects remain unchanged under `ibl` and `shadow`.

## Validation

The existing GLTF scene Playwright test verifies the grouped readiness status
alongside the detailed reports and rendered pixels.

## Follow-Up

If more examples need the same readiness grouping, move the helper into a small
testable package module. For now it remains example-local because its input is
the GLTF scene's specific telemetry bundle.
