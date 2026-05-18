# Mixed-Family Routed Resource Summary Field-Shape Plan Audit

Date: 2026-05-18

Task: `task-1616`

## Scope

Audit the selected `task-1617` follow-up from
`NEXT_ROUTE_OR_STANDARD_AFTER_INVALID_EMISSIVE_FACTOR_MAPPING_PLAN_2026_05_18.md`.

## Findings

- The selected follow-up is concrete enough for one focused implementation
  slice: add assertions to the existing mixed built-in app route test.
- The proposed scope is test-only and stays within the public app diagnostics
  JSON surface.
- The test protects the generic `routedResourceSet` summary shape on the
  successful mixed-family route path without changing route traversal, adapter
  policy, frame-resource preparation, shaders, or browser examples.

## Boundary Check

- ECS remains authoritative; the task does not add renderer-owned game state.
- Render extraction and snapshot contracts are unchanged.
- WebGPU remains the only backend and keeps ownership of GPU resources.
- JSON-safe diagnostics are strengthened by asserting old family-specific field
  names are absent from the serialized summary.

## Recommendation

Proceed with `task-1617` as scoped. Keep the implementation limited to
`test/webgpu/webgpu-app.test.ts` and do not broaden into app route refactors or
new StandardMaterial/glTF cases.
