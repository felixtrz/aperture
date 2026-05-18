# Queued Prepare-Route Diagnostic Normalization Plan Audit

Date: 2026-05-18

Task: `task-1621`

## Scope

Audit the selected `task-1622` follow-up from
`NEXT_ROUTE_OR_STANDARD_AFTER_MIXED_FAMILY_ROUTE_SUMMARY_PLAN_2026_05_18.md`.

## Findings

- The selected cleanup is small enough for one focused implementation slice:
  move queued prepare-route diagnostic normalization from the built-in collector
  into a focused helper module.
- The helper should preserve existing `webGpuApp.unsupportedMaterialQueueFamily`
  and `webGpuApp.materialQueueAssetMismatch` output exactly.
- Targeted unit tests can cover missing-adapter normalization, material-mismatch
  normalization, and passthrough for unknown diagnostics without requiring a
  WebGPU device or browser fixture.

## Boundary Check

- The task does not change ECS state, render extraction, snapshots, adapter
  registration, route traversal, or frame-resource preparation.
- WebGPU remains the only backend and GPU resources stay backend-owned.
- JSON-safe diagnostics remain the only public surface affected.
- App-level non-built-in rendering, binary GLB loading, IBL, shadows, and GLB
  viewer behavior remain deferred.

## Recommendation

Proceed with `task-1622` as scoped. Keep the implementation limited to the new
helper module, its targeted tests, and replacing the private built-in collector
function call.
