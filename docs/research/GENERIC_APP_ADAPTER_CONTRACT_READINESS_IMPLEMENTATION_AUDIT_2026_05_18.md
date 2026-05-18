# Generic App Adapter Contract Readiness Implementation Audit

Date: 2026-05-18

Task: `task-1648`

## Scope

Audit the `task-1647` readiness audit for architecture drift, missing
constraints, and next-task suitability.

## Findings

- The audit correctly separates generic-ready contracts from built-in app
  policy boundaries.
- The recommended next task is test-only and does not add public source
  material kinds, app adapter registration options, shader code, GPU resources,
  examples, or browser fixtures.
- The audit preserves Decision 0010 by treating arbitrary route-family strings
  as internal adapter/route keys, not as a public custom material authoring API.
- The selected next slice can validate `QueuedMaterialAdapterRegistry`,
  `routeQueuedMaterialPrepare()`, `QueuedMaterialAppResourceItem`, and
  `prepareQueuedMaterialFrameResourceSet()` without touching WebGPU device
  initialization or browser behavior.
- No runtime code changes are needed before the test-only proof.

## Boundary Check

- ECS remains authoritative. The proposed fixture is not ECS state and does not
  introduce renderer-owned source materials.
- Rendering remains a derived view of extracted snapshots and prepared resource
  keys.
- WebGPU remains the only backend; the next slice uses fake resources only for
  unit-level contract validation.
- Snapshot and diagnostic surfaces remain JSON-safe.
- The public `MaterialKind` union remains closed.

## Recommendation

Proceed to tracker/backlog alignment. Refill the backlog with the test-only
generic app adapter contract proof as the next ready task, followed by the
usual plan audit, implementation audit, and tracker alignment tasks.
