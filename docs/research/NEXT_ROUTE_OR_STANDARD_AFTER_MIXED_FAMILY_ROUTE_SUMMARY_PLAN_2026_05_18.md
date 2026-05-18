# Next Route Or Standard Follow-Up After Mixed-Family Route Summary Coverage

Date: 2026-05-18

Task: `task-1620`

## Context

`task-1617` pinned the mixed built-in app diagnostics summary shape on the
generic `routedResourceSet` field. The next slice should move from
field-shape guards into a production route/prepared-resource cleanup.

## Candidates

### Material Route / Prepared-Resource Candidate

Extract queued prepare-route diagnostic normalization out of
`queued-built-in-app-resource-set.ts`.

Pros:

- Reduces one remaining built-in collector responsibility without changing
  route traversal, adapter policy, or frame-resource creation.
- Keeps generic `queuedMaterialPrepareRoute.*` diagnostics and app-facing
  `webGpuApp.*` diagnostics separated behind a focused helper.
- Can be covered with targeted unit tests for missing-adapter and
  material-mismatch diagnostics.

Cons:

- Still leaves the built-in collector as the compatibility wrapper.
- Does not enable app-level non-built-in rendering by itself.

Decision: select. This is a small production cleanup that advances the route
spine more than another summary assertion.

### StandardMaterial / glTF Fidelity Candidate

Add another browser fixture for a remaining glTF material edge case.

Pros:

- StandardMaterial/glTF coverage remains important for the proof point.

Cons:

- Recent work already added emissive-factor browser coverage and valid/invalid
  mapper coverage.
- The architecture docs call out generic material-route cleanup as the more
  urgent current risk.

Decision: defer.

### Diagnostics / Tooling Candidate

Only update tracker/backlog state after mixed-family summary coverage.

Pros:

- Low risk.

Cons:

- Already handled by `task-1619`.
- Does not reduce collector responsibility or route/prepared-resource coupling.

Decision: complete; no tooling-only follow-up now.

## Selected Follow-Up

### task-1622 — Extract queued prepare-route app diagnostic normalization

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/queued-material-prepare-route-diagnostics.ts`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`, and targeted
WebGPU tests.
Reference anchor:
this plan, `docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`packages/webgpu/src/webgpu/queued-material-prepare-route.ts`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`, and recent
route collector cleanup audits.

Acceptance criteria:

- Move missing-adapter and material-mismatch app diagnostic normalization into a
  focused helper module.
- Keep the existing public diagnostic codes and messages unchanged.
- Add targeted tests for both normalized diagnostic paths and passthrough of
  unknown diagnostics.
- Preserve ECS authority, render extraction, WebGPU-only backend ownership, and
  JSON-safe diagnostics.
- Do not change route traversal, adapter registration policy, frame-resource
  preparation, browser examples, glTF mapping, binary GLB loading, IBL, shadows,
  or non-built-in material rendering.

## Next Step

Run `task-1621` to audit this selected follow-up before implementation.
