# Next App Adapter Or Diagnostics Follow-Up After Collision Policy

Date: 2026-05-18

Task: `task-1686`

## Context

The generic adapter registry now has two policy guards:

- built-in app resource families can validate alongside a test-only app-owned
  `test-preview` family key; and
- a colliding app-owned-style `standard` adapter does not override the first
  built-in-style registration.

Those guards make route-family registration behavior clearer, but the public
diagnostics docs still do not explain the material route diagnostic layers that
agents and users see in app reports.

## Candidates

### Explicit App-Owned Adapter Facade Candidate

Design or implement an app facade option for app-owned backend material
adapters.

Pros:

- Moves closer to real non-built-in app adapter support.
- Builds directly on the registry coexistence and collision guards.

Cons:

- Any public facade option would need a careful source-material boundary and
  likely a decision record before implementation.
- It risks implying custom material source authoring before that contract is
  designed.

Decision: defer until the public source/adapter contract is explicitly decided.

### StandardMaterial / glTF Fidelity Candidate

Add another browser fixture for remaining StandardMaterial/glTF behavior such
as texture-transform rotation or color-space status.

Pros:

- Continues proven browser-verifiable material fidelity work.
- Existing fixtures and Playwright helpers are mature.

Cons:

- It does not help explain the now-growing route diagnostic/reporting spine.

Decision: defer.

### Diagnostics / Tooling Candidate

Promote the research-level material route diagnostics map into the public
diagnostics docs.

Pros:

- The route-report, prepare-route, frame-resource route, app item, and summary
  layers are now stable enough to document as inspection surfaces.
- Helps humans and agents distinguish generic route infrastructure from
  built-in app compatibility policy.
- Keeps the work narrow and does not add public custom material authoring.

Cons:

- Documentation may need later updates if app-owned backend adapter registration
  becomes public.

Decision: select.

## Selected Follow-Up

### task-1688 — Document material route diagnostics layers

Category: `docs-tooling`
Package/write-scope:
`docs/DIAGNOSTICS_SUMMARIES.md`; tracker/backlog docs only if alignment changes.
Reference anchor:
this plan,
`docs/research/MATERIAL_ROUTE_DIAGNOSTICS_MAP_2026_05_18.md`,
`docs/research/APP_ADAPTER_BUILT_IN_COLLISION_REGRESSION_AUDIT_2026_05_18.md`,
`docs/DIAGNOSTICS_SUMMARIES.md`,
`packages/webgpu/src/webgpu/material-queue-route-report.ts`,
`packages/webgpu/src/webgpu/queued-material-prepare-route.ts`,
`packages/webgpu/src/webgpu/queued-material-prepare-route-diagnostics.ts`,
`packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`,
`packages/webgpu/src/webgpu/queued-material-frame-resource-route-diagnostics.ts`,
`packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`, and
`packages/webgpu/src/webgpu/app-diagnostics-summary.ts`.

Acceptance criteria:

- Add a concise public docs section that maps the current material route
  diagnostic layers, their JSON surfaces, and their ownership boundaries.
- Explicitly distinguish generic route infrastructure from built-in/app
  compatibility policy.
- Include JSON-safety guidance that excludes raw WebGPU handles, adapter
  callbacks, app objects, source asset payloads, override semantics, and
  fallback semantics.
- Do not add public custom material source APIs, app-level non-built-in
  rendering, IBL, shadows, binary GLB loading, or implementation changes.

## Next Step

Run `task-1687` to audit this selected follow-up plan before implementation.
