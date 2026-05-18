# Next Material Route Or Standard Follow-Up After GLB Combined Texture Plan — 2026-05-18

## Context

The latest implementation added GLB-derived browser coverage for a
StandardMaterial with both `baseColorTexture` and `metallicRoughnessTexture`.
The individual and combined StandardMaterial texture paths now have a stronger
browser safety net. The next task can either keep extending glTF fidelity or
return to the material-route architecture spine.

## Candidate A — Material Route Architecture

Add duplicate and missing-family diagnostics around the built-in app resource
adapter registration factory.

Pros:

- Tightens the generic route spine after adding more StandardMaterial browser
  coverage.
- Helps ensure adapter metadata remains deterministic before broader app-level
  route migration.
- Keeps future non-built-in material rendering failures explicit instead of
  silently falling back to a built-in route.

Cons:

- Mostly defensive; it does not add a new rendered material behavior.

## Candidate B — StandardMaterial/glTF Fidelity

Add a GLB-derived browser fixture for another non-base-color texture slot using
`TEXCOORD_1`, such as normal or occlusion.

Pros:

- Continues improving glTF texture fidelity.
- Builds on the UV1 shader and readiness path already proven by base-color and
  metallic-roughness.

Cons:

- More fixture-heavy, and current coverage already proves the UV1 mechanism for
  two important StandardMaterial paths.
- Normal-map UV1 would also require tangent-sensitive pixel expectations.

## Candidate C — Diagnostics/Tooling

Add a progress-check rule for stale public tracker wording when a "missing"
item has recently been moved to working status.

Pros:

- Reduces dashboard drift.
- Low implementation risk.

Cons:

- Tooling-only; the route spine currently has a clearer architectural risk.

## Selected Follow-Up

Select Candidate A: add duplicate and missing-family diagnostics for the
built-in app resource adapter registration factory.

The implementation should stay in tests and the adapter registration module. It
should not change active route behavior, add non-built-in rendering, rename
route keys, or alter material source asset contracts.

## Proposed Task

### task-1431 — Add built-in app adapter registration diagnostics

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts` and
`test/webgpu/built-in-material-app-resource-adapter.test.ts`.
Reference anchor:
`docs/DECISIONS.md` decision 0010, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, existing built-in app adapter registry tests,
`references/three.js/src/renderers/common/Pipeline.js`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Duplicate built-in app adapter family registrations produce deterministic
  diagnostics without changing the active default registry behavior.
- Missing built-in family registrations produce deterministic diagnostics or a
  validation report suitable for JSON-safe app diagnostics.
- Existing default built-in adapter registration remains valid for Unlit,
  Matcap, Standard, and DebugNormal.
- Keep app-level non-built-in material rendering, route renames, GLB viewer
  work, IBL, shadows, and broad PBR work deferred.
