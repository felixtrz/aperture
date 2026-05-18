# Next Route Or Standard Follow-Up After Route Diagnostics Naming Audit Plan

Date: 2026-05-18

Task: `task-1557`

## Context

`task-1556` confirmed that public material queue route diagnostics should keep
their nested payload under `report`. No compatibility alias is needed right now,
so the next useful slice should advance either the generic route spine or the
remaining StandardMaterial/glTF fidelity gaps without changing the public route
diagnostic shape.

## Candidates

### Route Architecture Candidate

Add a public route-report reader helper that accepts diagnostic arrays and
returns the `webGpuApp.materialQueueRouteReport` payload.

Pros:

- Would centralize the existing app/test scan pattern.
- Could make future route diagnostics consumers less repetitive.

Cons:

- `task-1556` found no current field-name ambiguity.
- The helper would mostly wrap a small local scan and risks creating API surface
  before there is an external consumer.

Decision: defer.

### StandardMaterial/glTF Fidelity Candidate

Add browser coverage for a valid non-default glTF sampler mapping.

Pros:

- `docs/MEDIUM_LONG_TERM_GOALS.md` explicitly lists sampler behavior as part of
  the target StandardMaterial/glTF coverage.
- Existing tests cover default sampler mapping, invalid sampler indices, invalid
  sampler enum values, and delayed sampler dependencies, but they do not prove a
  valid non-default sampler configuration reaches the prepared sampler resource
  and JSON-safe browser status.
- The slice stays vertical and narrow: one fixture scenario, one browser test,
  no IBL/shadows/GLB viewer work, and no route architecture churn.

Cons:

- It is a fidelity/status proof, not a new route architecture capability.
- A visual repeat/wrap proof may require a larger UV setup; this slice should
  first prove mapping/status/resource behavior.

Decision: select.

### Diagnostics / Tooling Candidate

Update tracker/backlog only after the route naming audit.

Pros:

- Low risk and keeps dashboard wording fresh.

Cons:

- Does not advance runtime behavior.
- The selected sampler slice is concrete enough to implement before another
  tracker-only task.

Decision: defer until after the selected implementation and audit.

## Selected Follow-Up

### task-1561 — Add valid non-default glTF sampler mapping browser coverage

Category: `webgpu-render`
Package/write-scope:
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
and implementation files only if the fixture exposes a focused defect.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`packages/render/src/materials/gltf-material.ts`,
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Add a glTF-shaped browser scenario with a valid non-default sampler enum
  combination such as repeat wrapping and linear filtering.
- Assert JSON-safe asset-mapping status includes the original glTF sampler enum
  values and the mapped sampler settings.
- Assert the rendered path creates exactly one sampler resource and one texture
  resource, submits a draw, and exposes no raw GPU handles.
- Keep visual wrap-repeat proof, IBL, shadows, binary GLB loading, broad PBR
  work, and app-level non-built-in rendering deferred unless this fixture
  exposes a focused defect.

## Next Step

Run `task-1558` to audit this selected follow-up plan before implementation.
