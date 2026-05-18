# Next Route Or Standard Follow-Up After Base-Color Factor Tint Coverage

Date: 2026-05-18

Task: `task-1635`

## Context

`task-1632` added a browser-verifiable StandardMaterial/glTF proof that a
non-white `baseColorFactor` tints `baseColorTexture`. Recent route work also
split route-report diagnostic assembly, prepare-route app diagnostic
normalization, source-asset indexing, frame-resource route diagnostics, and
diagnostics summary collectors into focused helpers.

The next slice should keep the route/prepared-resource spine understandable
before adding another helper or a broader non-built-in adapter.

## Candidates

### Production Route / Prepared-Resource Cleanup

Extract another small helper from the built-in route collector or
frame-resource path.

Pros:

- Route/prepared-resource cleanup remains the central architecture risk.
- Several boundaries are now split enough that future non-built-in support is
  closer.

Cons:

- The obvious next implementation, real app-level non-built-in material adapter
  rendering, is too broad for one safe run.
- Additional helper extraction without a map of the current route diagnostics
  layers risks making the route spine harder for agents to navigate.

Decision: defer one slice. Use the next task to document the route diagnostic
layers and then choose a concrete cleanup.

### StandardMaterial / glTF Fidelity

Add another browser proof for a remaining scalar-plus-texture interaction such
as metallic/roughness scalar factors multiplied by
`metallicRoughnessTexture`.

Pros:

- It would continue tightening glTF PBR fidelity.
- It can likely reuse the existing StandardMaterial glTF fixture.

Cons:

- It is more visual/lighting-sensitive than the base-color factor proof.
- The route helper work has created enough split diagnostic surfaces that a
  short map will reduce future implementation risk.

Decision: defer until after the route diagnostics map.

### Diagnostics / Tooling

Write a concise route diagnostics map for the current queue, prepare-route,
frame-resource, app-report, and diagnostics-summary layers.

Pros:

- Captures the current helper boundaries after several rapid extractions.
- Helps future agents choose the next route/prepared-resource slice without
  re-reading many audit files.
- Documentation-only, so it preserves package boundaries and avoids broad
  non-built-in rendering.

Cons:

- It does not add runtime behavior.
- It should stay concise and not become a new architecture spec.

Decision: select. The next implementation should create a focused
agent-readable route diagnostics map.

## Selected Follow-Up

### task-1637 — Document current material route diagnostics layers

Category: `docs-tooling`
Package/write-scope:
`docs/research/MATERIAL_ROUTE_DIAGNOSTICS_MAP_2026_05_18.md` and backlog only.
Reference anchor:
this plan, `docs/ARCHITECTURE.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/DECISIONS.md`,
`packages/webgpu/src/webgpu/material-queue-route-report.ts`,
`packages/webgpu/src/webgpu/queued-material-prepare-route.ts`,
`packages/webgpu/src/webgpu/queued-material-prepare-route-diagnostics.ts`,
`packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`,
`packages/webgpu/src/webgpu/queued-material-frame-resource-route-diagnostics.ts`,
and `packages/webgpu/src/webgpu/app-diagnostics-summary.ts`.

Acceptance criteria:

- Map each current route diagnostic layer to its source module, diagnostic
  codes, and JSON/public surface.
- Call out which helpers are generic route infrastructure and which remain
  built-in/app compatibility policy.
- Identify two concrete next route/prepared-resource cleanup candidates and
  one reason each should or should not be selected next.
- Do not change runtime code, public APIs, app examples, or browser fixtures.

## Next Step

Run `task-1636` to audit this documentation follow-up before writing it.
