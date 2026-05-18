# Next Route Or Standard Follow-Up After Prepare-Route Diagnostic Normalization

Date: 2026-05-18

Task: `task-1625`

## Context

`task-1622` moved queued prepare-route app diagnostic normalization into
`queued-material-prepare-route-diagnostics.ts`. The built-in app resource-set
collector now delegates missing-adapter and material-mismatch diagnostics to a
focused helper, while route traversal, adapter registration, frame-resource
preparation, and public diagnostic codes stay unchanged.

The next slice should keep reducing built-in route/prepared-resource coupling
without broadening into app-level non-built-in rendering.

## Candidates

### Production Route / Prepared-Resource Cleanup

Extract frame-resource route app diagnostic construction out of
`queued-built-in-frame-resource-set.ts`.

Pros:

- Mirrors the prepare-route diagnostic normalization cleanup at the next
  route stage.
- Keeps `QueuedMaterialFrameResourceRouteShell` as the generic route payload
  while isolating the app-facing `webGpuApp.frameResourceRoute` diagnostic.
- Can be covered with targeted unit tests for route shell construction,
  diagnostic shape, JSON safety, and facade-vs-backend key preservation.
- Does not change successful-frame reports, adapter policy, resource
  preparation, or draw submission.

Cons:

- The diagnostic remains app/built-in-facing until a real non-built-in app
  material adapter exists.
- This is cleanup, not a new rendered feature.

Decision: select. It advances the material-route spine with a small boundary
cleanup and avoids the broad collector rewrite risk.

### StandardMaterial / glTF Fidelity

Add another focused browser or mapper regression for a remaining glTF material
edge case.

Pros:

- StandardMaterial/glTF fidelity remains a near-term proof-point requirement.
- Recent browser fixtures have made this path productive and well-covered.

Cons:

- The medium-term goals still call out the route/prepared-resource spine as the
  current architectural risk.
- Recent runs already added substantial sampler, emissive, alpha, normal, and
  dependency coverage.

Decision: defer until after the frame-resource route diagnostic cleanup and
tracker alignment.

### Diagnostics / Tooling

Write a route diagnostics overview document without code changes.

Pros:

- Could clarify the route-report, prepare-route, and frame-resource diagnostic
  layers for future agents.

Cons:

- Existing audits already document the relevant boundaries.
- A focused helper extraction is small enough to do before a broader overview
  is useful.

Decision: defer. Add docs only if the implementation audit finds the boundary
is still hard to follow.

## Selected Follow-Up

### task-1627 — Extract frame-resource route app diagnostic helper

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/queued-material-frame-resource-route-diagnostics.ts`,
`packages/webgpu/src/webgpu/queued-built-in-frame-resource-set.ts`, and targeted
WebGPU tests.
Reference anchor:
this plan, `docs/ARCHITECTURE.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/research/QUEUED_PREPARE_ROUTE_DIAGNOSTIC_NORMALIZATION_IMPLEMENTATION_AUDIT_2026_05_18.md`,
`docs/research/FRAME_RESOURCE_ROUTE_SHELL_APP_DIAGNOSTICS_BOUNDARY_AUDIT_2026_05_17.md`,
`packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`,
`packages/webgpu/src/webgpu/queued-built-in-frame-resource-set.ts`,
`references/three.js/src/renderers/common/Pipeline.js`, and
`references/engine/src/scene/frame-graph.js`.

Acceptance criteria:

- Move app-facing `webGpuApp.frameResourceRoute` diagnostic construction into a
  focused frame-resource route diagnostics helper.
- Keep the existing diagnostic code, message, and route payload shape
  unchanged.
- Add targeted tests proving diagnostic shape, JSON safety, and preservation of
  facade queue keys versus backend resource keys.
- Preserve successful-frame report shape: do not emit successful frame-resource
  route shells in default app diagnostics.
- Do not change frame-resource preparation, adapter registration policy, draw
  submission, StandardMaterial/glTF mapping, binary GLB loading, IBL, shadows,
  or app-level non-built-in material rendering.

## Next Step

Run `task-1626` to audit this selected follow-up before implementation.
