# Next Route-Boundary Or glTF Fidelity Slice Plan

Date: 2026-05-18

## Scope

Compare three narrow follow-up options after the route-family key boundary,
unregistered route-key app diagnostic, and optional glTF material-extension
warning fixtures.

## References Inspected

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/research/UNREGISTERED_ROUTE_KEY_APP_DIAGNOSTIC_AUDIT_2026_05_18.md`
- `docs/research/OPTIONAL_GLTF_MATERIAL_EXTENSION_WARNING_STATUS_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/material-queue-route-report.ts`
- `examples/standard-gltf-texture.js`

## Candidates

### Route-Key Diagnostics Summary Regression

Add targeted app-level coverage that inspects the grouped route report after a
syntactically valid but unregistered route family key is queued.

Pros:

- Directly hardens Decision 0010's no-fallback route-family boundary.
- Uses existing app diagnostics and route-report surfaces.
- Keeps the work inside tests unless a tiny JSON bridge gap appears.
- Proves grouped summaries remain JSON-safe and useful for agents.

Risks:

- It is mostly diagnostic coverage; it does not move rendering capability
  forward by itself.

### Optional-Extension Warning Aggregation / Status

Extend the optional material-extension browser scenario to cover warning
aggregation in status or multiple unsupported optional extension codes.

Pros:

- Improves glTF authoring feedback and status readability.
- Builds on the current success-with-warning browser fixture.

Risks:

- The current fixture already proves the most important behavior: optional
  unsupported extensions do not block base StandardMaterial rendering.
- Aggregation shape may be premature until more glTF diagnostics exist.

### StandardMaterial / glTF Fidelity Candidate

Pick the next narrow StandardMaterial import fidelity gap, such as another
texture-info validation edge or a small material-factor mapping regression.

Pros:

- Moves closer to practical glTF PBR coverage.
- Keeps user-visible asset import behavior improving.

Risks:

- The material path already has several recent diagnostic slices.
- Larger fidelity work could easily outrun the route/prepared-resource boundary
  that now needs a clean follow-up.

## Selected Follow-Up

Select `task-1309`:

### Add Route-Key Diagnostics Summary Regression

Category: `runtime-orchestration`

Package/write-scope:

- `test/webgpu/webgpu-app.test.ts`
- `packages/webgpu/src/webgpu` only if a tiny diagnostic bridge fix is required

Reference anchor:

- `docs/research/UNREGISTERED_ROUTE_KEY_APP_DIAGNOSTIC_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/material-queue-route-report.ts`
- existing app-level route diagnostics tests in `test/webgpu/webgpu-app.test.ts`

Acceptance criteria:

- Add coverage for grouped route diagnostics after a valid-but-unregistered
  route key failure.
- Assert the JSON-safe route report includes the failed custom family, skipped
  counts, and diagnostic summary counts.
- Confirm no raw GPU/backend handles leak into the report.
- Do not add app-level non-built-in material rendering, fallback rendering, IBL,
  shadows, binary GLB loading, or GLB viewer behavior.

## Deferred

- Real non-built-in material adapter routing remains deferred until there is a
  source asset and prepared-resource contract.
- Optional-extension warning aggregation remains a good glTF diagnostics follow
  up after route diagnostics are locked down.
- Broader StandardMaterial PBR fidelity remains the main rendering capability
  track, but it should continue as narrow vertical slices.
