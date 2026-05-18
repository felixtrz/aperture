# Next Material Route Or Standard Follow-Up After App Adapter Diagnostics Plan — 2026-05-18

## Context

Built-in app adapter registration now has deterministic validation for duplicate
and missing built-in families. That closes a defensive gap in the route spine,
but the validation report is still a focused helper and not yet surfaced through
broader app diagnostics.

## Candidate A — Material Route Architecture

Surface built-in app adapter registry validation in the WebGPU app route
diagnostics/report path.

Pros:

- Turns the new validation helper into an app-level inspection surface.
- Keeps route spine work moving before broader non-built-in adapter migration.
- Remains JSON-safe and renderer-owned without touching ECS/source assets.

Cons:

- Requires careful scoping so the default app path does not start emitting noisy
  diagnostics when valid.

## Candidate B — StandardMaterial/glTF Fidelity

Add a GLB-derived browser fixture for `normalTexture` or `occlusionTexture`
using `TEXCOORD_1`.

Pros:

- Continues glTF UV set fidelity.
- Builds on the recently proven UV1 shader/readiness infrastructure.

Cons:

- More fixture-heavy than the route follow-up.
- The most common UV1 texture intersections are already proven for base-color
  and metallic-roughness.

## Candidate C — Diagnostics/Tooling

Add a tracker lint rule that flags stale "missing app-level adapter diagnostics"
wording once app-level diagnostics are wired.

Pros:

- Useful after Candidate A.

Cons:

- Premature until the app-level diagnostics surface exists.

## Selected Follow-Up

Select Candidate A: surface built-in app adapter registry validation in the
WebGPU app diagnostics/report path.

The implementation should remain narrow: expose a JSON-safe validation summary
when building or reporting the built-in app resource adapter registry, assert the
default app path stays valid and quiet, and add a test-only invalid registry
case to prove duplicate/missing diagnostics can be inspected.

## Proposed Task

### task-1436 — Surface built-in app adapter validation in app diagnostics

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/app.ts`,
`packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`, and
targeted WebGPU app/adapter tests.
Reference anchor:
`docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_APP_ADAPTER_DIAGNOSTICS_PLAN_2026_05_18.md`,
`docs/ARCHITECTURE.md`, `docs/DECISIONS.md` decision 0010,
`docs/MEDIUM_LONG_TERM_GOALS.md`,
`packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`,
`packages/webgpu/src/webgpu/app.ts`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- The default WebGPU app route/resource adapter registry reports valid
  built-in family registration without adding noisy diagnostics.
- A test-only invalid built-in app adapter registry can surface duplicate and
  missing-family diagnostics in JSON-safe app diagnostics or an app report.
- The report omits adapter callbacks, app objects, source asset payloads, and raw
  GPU handles.
- Keep app-level non-built-in material rendering, route renames, GLB viewer
  work, IBL, shadows, and broad PBR work deferred.
