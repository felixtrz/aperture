# Next Route Prepared Or glTF Fidelity After Vector Diagnostic Plan

Date: 2026-05-18

## Scope

Plan the next focused follow-up after invalid glTF scalar, texture scalar, and
vector/color factor diagnostics.

## References Inspected

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_INVALID_VECTOR_FACTOR_AUDIT_2026_05_18.md`
- `docs/research/APP_LEVEL_GENERIC_MATERIAL_ADAPTER_ROUTE_BOUNDARY_PLAN_2026_05_18.md`
- `docs/research/GENERIC_MATERIAL_FAMILY_FRAME_RESOURCE_ADAPTER_INTERFACE_PLAN_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-material-adapter.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-set.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `test/webgpu/queued-material-app-resource-item.test.ts`
- `test/webgpu/queued-material-frame-resource-set.test.ts`
- `test/webgpu/webgpu-app.test.ts`
- `packages/render/src/materials/gltf-material.ts`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Candidates

### Route / Prepared-Resource Candidate

Audit generic material-family frame-resource adapter migration readiness after
the latest diagnostic hardening.

Pros:

- Returns focus to the material architecture spine: source asset readiness,
  queue routing, prepared resources, route summaries, and draw submission.
- The existing generic app route item, adapter registry, frame-resource
  collector, test-only custom family coverage, and app route diagnostics provide
  enough evidence for a precise readiness check.
- A readiness audit can identify the smallest implementation slice without
  rushing a broad migration through app-owned WebGPU callbacks.

Risks:

- It is planning/audit work rather than immediate implementation.

### StandardMaterial / glTF Fidelity Candidate

Add another browser diagnostic for a different invalid vector field, such as
`emissiveFactor`.

Pros:

- Easy to implement and validates another source field.

Risks:

- It would be another nearby invalid-field fixture after several diagnostic
  slices. The project would benefit more from re-checking the route/prepared
  boundary before selecting more field-level coverage.

### Diagnostics / Tooling Candidate

Add a browser status summary for repeated glTF mapping diagnostics.

Pros:

- Could make multi-diagnostic examples easier for agents to scan.

Risks:

- No immediate browser fixture currently needs a grouped summary; existing
  detailed diagnostic arrays remain JSON-safe and actionable.

## Selected Follow-Up

Select a new task:

### Audit Generic Material-Family Frame-Resource Adapter Readiness

Category: `audit-refactor`

Package/write-scope:

- `docs/research`
- targeted tests only if a tiny corrective assertion is clearly needed

Reference anchor:

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/APP_LEVEL_GENERIC_MATERIAL_ADAPTER_ROUTE_BOUNDARY_PLAN_2026_05_18.md`
- `docs/research/GENERIC_MATERIAL_FAMILY_FRAME_RESOURCE_ADAPTER_INTERFACE_PLAN_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-material-adapter.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-set.ts`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `test/webgpu/queued-material-app-resource-item.test.ts`
- `test/webgpu/queued-material-frame-resource-set.test.ts`
- `test/webgpu/webgpu-app.test.ts`

Acceptance criteria:

- Identify the smallest coherent implementation slice for generic
  material-family frame-resource adapter migration.
- Confirm which app-owned callbacks, adapter-owned resource creation, route
  diagnostics, JSON-safe summaries, and hot-path scratch boundaries must remain
  stable.
- Recommend whether to implement the migration slice next or add one more
  targeted route/prepared-resource regression first.
- Do not change app-level non-built-in rendering, binary GLB loading, IBL,
  shadows, GLB viewer behavior, or rendered material behavior.

## Deferred

- Additional invalid glTF field fixtures can continue later, but the next
  architecture-sensitive step should first re-check route/prepared-resource
  migration readiness.
