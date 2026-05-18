# Next App Adapter Or Standard Follow-Up After Factor Browser

Date: 2026-05-18

Task: `task-1676`

## Context

The previous slice proved browser-visible StandardMaterial metallic-roughness
behavior when scalar factors and a metallic-roughness texture are combined.
The route spine already has generic adapter registry validation and test-only
non-built-in route-shell metadata coverage. Public custom material source
authoring remains intentionally deferred by Decision 0010.

## Candidates

### Route / App Adapter Candidate

Add a focused generic adapter registry coexistence regression for built-in
families plus a test-only app-owned family.

Pros:

- Advances the next backend adapter registration-policy slice without exposing
  custom source material assets.
- Tests the exact boundary Decision 0010 allows: route and adapter family keys
  may be registry-driven strings while source material kinds remain closed.
- Keeps the work narrow and JSON-safe.

Cons:

- It is still a unit-level policy guard, not rendered non-built-in pixels.
- It does not add an app option for user-supplied adapters.

Decision: select.

### StandardMaterial / glTF Fidelity Candidate

Add another browser fixture for remaining glTF material fidelity such as
double-sided cull-state, color-space status, or texture transform rotation.

Pros:

- Continues visible StandardMaterial/glTF coverage.
- Existing `standard-gltf-texture` fixtures are well established.

Cons:

- Recent runs already added several browser fidelity proofs.
- The sharper near-term architecture risk is still the route/app adapter spine
  becoming permanently built-in-only.

Decision: defer until after this registry-policy guard.

### Diagnostics / Tooling Candidate

Promote the material route diagnostics map into stable user-facing docs.

Pros:

- Useful for agent-readable debugging.

Cons:

- The public diagnostics story may shift with app-owned adapter registration
  policy, so documenting it now could freeze names prematurely.

Decision: defer.

## Selected Follow-Up

### task-1678 — Add adapter registry coexistence regression

Category: `webgpu-render`
Package/write-scope:
`test/webgpu/queued-material-adapter-json.test.ts`; implementation files only
if the regression exposes a focused defect.
Reference anchor:
this plan, `docs/DECISIONS.md` Decision 0010,
`docs/research/NON_BUILT_IN_APP_MATERIAL_ADAPTER_DECOMPOSITION_2026_05_18.md`,
`packages/webgpu/src/webgpu/queued-material-adapter.ts`,
`packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`, and
Bevy's render-asset/material-family registry pattern in
`references/bevy/crates/bevy_render/src/render_asset.rs` and
`references/bevy/crates/bevy_pbr/src/material.rs`.

Acceptance criteria:

- Add a generic adapter registry regression with all built-in app resource
  families plus one test-only app-owned family.
- Assert validation succeeds when the expected family list includes the custom
  test family and all built-ins.
- Assert duplicate app-owned family diagnostics remain warnings with stable
  first/duplicate indexes and no built-in fallback semantics.
- Assert JSON output contains family keys and diagnostics only, with no adapter
  functions, raw GPU handles, public custom material source APIs, app-level
  non-built-in rendering, IBL, shadows, or binary GLB loading.

## Next Step

Run `task-1677` to audit this selected follow-up plan before implementation.
