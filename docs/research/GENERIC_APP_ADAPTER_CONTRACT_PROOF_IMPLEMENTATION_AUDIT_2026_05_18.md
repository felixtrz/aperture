# Generic App Adapter Contract Proof Implementation Audit

Date: 2026-05-18

Task: `task-1651`

## Scope

Audit the `task-1650` test-only generic app adapter contract proof.

## Findings

- The proof stays unit-level and test-only. It does not add a public custom
  material source asset, app adapter registration API, shader code, GPU
  resources, examples, or browser fixtures.
- `QueuedMaterialPrepareRouteAdapter` and `QueuedMaterialPrepareRouteContext`
  now allow a generic test-only material object instead of requiring the public
  `MaterialAsset` union. Built-in adapters still validate only known built-in
  material assets.
- The new regression proves one test-only route family through:
  `createQueuedMaterialAdapterRegistry()`, `routeQueuedMaterialPrepare()`,
  `createQueuedMaterialAppResourceItem()`, and
  `prepareQueuedMaterialFrameResourceSet()`.
- The test covers successful resource-key mapping and JSON-safe failure
  diagnostics for frame-resource creation without raw GPU handles.
- The change preserves the closed public `MaterialKind` union. Arbitrary
  family keys are still internal adapter/route keys, not user-facing material
  authoring.

## Boundary Check

- ECS remains authoritative; the test fixture is not an ECS-owned or public
  source asset.
- Rendering remains derived from queue/app items and prepared resource keys.
- WebGPU remains the only backend; the test uses fake resources and never
  initializes a device.
- Diagnostics remain JSON-safe and do not include raw GPU handles.

## Recommendation

Proceed to tracker/backlog alignment. The next route implementation slice should
be selected by a short planning pass after this proof; likely candidates are a
generic app adapter registration policy audit or a prepared-resource contract
shell for non-built-in families.
