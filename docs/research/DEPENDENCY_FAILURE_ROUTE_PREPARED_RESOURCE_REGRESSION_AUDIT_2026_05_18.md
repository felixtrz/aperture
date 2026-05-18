# Dependency Failure Route Prepared Resource Regression Audit

Date: 2026-05-18

## Scope

Audit the focused generic frame-resource dependency-failure regression added in
`task-1333`.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/GENERIC_MATERIAL_FAMILY_FRAME_RESOURCE_ADAPTER_READINESS_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-set.ts`
- `test/webgpu/queued-material-frame-resource-set.test.ts`

## Findings

Pass. The regression satisfies the selected acceptance criteria and stays within
the WebGPU route/prepared-resource test boundary.

The strengthened test keeps the existing dependency-failure path but now pins
the route-facing context explicitly:

- the failed item carries a test-only `custom-preview` family;
- the collector records the planned family and pipeline key;
- frame-resource option creation, frame-resource creation, and append callbacks
  remain uncalled after dependency failure;
- no mesh resources, material resource keys, bind groups, or first resources are
  produced;
- serialized output omits raw GPU handles, source asset payloads, and app
  objects.

Boundary checks:

- No ECS components, source asset contracts, render extraction, snapshots,
  browser examples, shaders, pipelines, or draw submission behavior changed.
- WebGPU resources remain backend-owned; the regression only verifies failed
  preparation does not expose them.
- App-level non-built-in material rendering, binary GLB loading, IBL, shadows,
  GLB viewer behavior, and rendered material behavior remain deferred.

## Recommendation

Run tracker/backlog alignment next, then plan the next material route or glTF
fidelity slice. The next architecture implementation can now consider a narrow
built-in wrapper migration over the generic collector with the dependency
failure contract pinned.

## Validation

- `pnpm exec vitest run test/webgpu/queued-material-frame-resource-set.test.ts`
