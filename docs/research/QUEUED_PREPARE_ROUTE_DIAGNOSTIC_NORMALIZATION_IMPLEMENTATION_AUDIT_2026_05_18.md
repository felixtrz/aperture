# Queued Prepare-Route Diagnostic Normalization Implementation Audit

Date: 2026-05-18

Task: `task-1623`

## Scope

Audit the `task-1622` queued prepare-route app diagnostic normalization
extraction.

## Findings

- The helper now lives in
  `packages/webgpu/src/webgpu/queued-material-prepare-route-diagnostics.ts`.
- `queued-built-in-app-resource-set.ts` delegates missing-adapter and
  material-mismatch normalization to the helper while keeping route traversal
  and adapter policy unchanged.
- The previous public `WebGpuAppUnsupportedMaterialQueueDiagnostic` type remains
  re-exported from the built-in resource-set module.
- Targeted tests cover missing-adapter normalization, material-mismatch
  normalization, and passthrough for unknown diagnostics.

## Boundary Check

- ECS authority, render extraction, snapshots, route traversal, adapter
  registration, frame-resource preparation, and browser fixtures are unchanged.
- The change only moves app-facing diagnostic normalization out of the collector.
- WebGPU remains the only backend, and diagnostics stay JSON-safe.

## Validation

- `pnpm exec vitest run test/webgpu/queued-material-prepare-route-diagnostics.test.ts`
- `pnpm run typecheck:test`

## Recommendation

Proceed to tracker/backlog alignment. The next planning task should continue
the production route/prepared-resource cleanup track and avoid broad app-level
non-built-in rendering until helper boundaries are cleaner.
