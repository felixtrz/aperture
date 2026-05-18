# Non-Built-In Route Shell Regression Audit

Date: 2026-05-18

Task: `task-1664`

## Scope

Audit the `task-1663` non-built-in prepared-resource route shell regression.

Reference files inspected:

- `docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_REGISTRY_VALIDATION_PLAN_2026_05_18.md`
- `docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_REGISTRY_VALIDATION_PLAN_AUDIT_2026_05_18.md`
- `docs/research/NON_BUILT_IN_APP_MATERIAL_ADAPTER_DECOMPOSITION_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`
- `test/webgpu/queued-material-frame-resource-route.test.ts`

## Findings

- The regression is test-only and uses a `test-preview` route family without
  adding public source material authoring, app registration APIs, shaders,
  examples, browser fixtures, or GPU resource creation.
- The route shell carries non-built-in family metadata, facade mesh/material
  resource keys, backend prepared mesh/material keys, source version, frame, and
  pipeline key through the existing generic shell contract.
- The summary reports only key-presence booleans and sorted diagnostic code
  counts. It intentionally omits facade/backend resource keys and raw diagnostic
  payloads.
- JSON assertions guard against raw GPU handles and fixture-only resource
  handles leaking through the summary surface.
- No production implementation change was needed; the existing route shell
  contract was already generic enough for this prepared-resource metadata slice.

## Boundary Check

- ECS remains authoritative; the test uses queue fixtures only.
- Rendering remains derived from queued route metadata and prepared resource
  keys.
- WebGPU resources remain backend-owned; the test does not instantiate any GPU
  API object.
- Public material kinds remain closed.

## Validation

- `pnpm exec vitest run test/webgpu/queued-material-frame-resource-route.test.ts`
- `pnpm run typecheck:test`

## Recommendation

Align tracker/backlog state and then select the next focused route or
StandardMaterial follow-up. Good candidates are either the next generic
app-level adapter registration slice or a deferred StandardMaterial/glTF
metallic-roughness scalar-factor browser proof.
