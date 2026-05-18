# Unknown material route family diagnostics plan audit - 2026-05-18

## Scope

Audit the selected follow-up from
`NEXT_ROUTE_OR_STANDARD_AFTER_OCCLUSION_EMISSIVE_DEPENDENCY_PLAN_2026_05_18.md`.

Reference anchors inspected:

- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md` decision 0010
- `docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_OCCLUSION_EMISSIVE_DEPENDENCY_PLAN_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `packages/webgpu/src/webgpu/material-queue-route-report.ts`
- `references/three.js/src/renderers/common/Bindings.js`
- `references/engine/src/scene/materials/standard-material.js`

## Audit

The selected follow-up is concrete enough for one focused run:

- It is a test-only route diagnostics regression, not a public custom material
  API.
- The expected diagnostic is explicit:
  `webGpuApp.unsupportedMaterialQueueFamily`.
- The no-work expectations are explicit: no routed resources and no raw source
  assets, app objects, or GPU handles in JSON.

Architecture fit:

- Decision 0010 remains intact because unsupported family keys are treated as
  route metadata, not valid source material authoring.
- Renderer-owned resource preparation remains behind adapters.
- ECS/render extraction boundaries are preserved because the regression should
  operate on queued/extracted route data, not mutate ECS or renderer state into
  a fallback family.

## Recommendation

Implement `task-1550` next. Keep it as a route diagnostics regression; do not
add public custom material authoring, shader registration, or app-level
non-built-in rendering.

## Validation

Documentation-only audit; covered by final formatting/check validation.
