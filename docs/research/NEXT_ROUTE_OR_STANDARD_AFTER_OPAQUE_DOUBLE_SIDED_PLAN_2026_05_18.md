# Next Route Or Standard Follow-Up After Opaque Double-Sided Coverage

Date: 2026-05-18

Task: `task-1575`

## Context

`task-1572` added opaque `doubleSided: true` glTF browser coverage. The
StandardMaterial/glTF browser fixture now covers several render-state, sampler,
texture dependency, and material scalar/vector fidelity paths.

While inspecting sampler follow-ups, one narrow gap remains visible: glTF
textures may omit `texture.sampler`, in which case default sampler behavior
should still be mapped and reported honestly. The underlying sampler mapper
already supports default values, but the browser fixture status helper currently
falls back to the explicit clamp sampler source when no sampler source exists.

## Candidates

### Generic Route / Prepared-Resource Candidate

Move another built-in collector responsibility into a generic route helper.

Pros:

- Advances the material-family architecture spine.
- Reduces built-in-specific collector weight.

Cons:

- The next responsibility needs a separate audit to avoid moving adapter policy
  together with generic traversal.
- This would be a larger direction change than the current browser fidelity
  gap.

Decision: defer.

### StandardMaterial/glTF Fidelity Candidate

Add browser coverage for an omitted glTF sampler source and report default
sampler mapping honestly.

Pros:

- Targets a specific glTF behavior: `textures[n].sampler` is optional.
- Keeps the source asset and prepared sampler distinction clear.
- Can be tested in the existing glTF browser fixture with one scenario and one
  status helper correction.

Cons:

- This is mostly status/default mapping coverage, not new rendered pixels.
- It should not broaden into a full sampler matrix.

Decision: select.

### Diagnostics / Tooling Candidate

Add only tracker/backlog cleanup after opaque double-sided coverage.

Pros:

- Low risk.

Cons:

- Already handled by `task-1574`.
- Does not address the observed default-sampler reporting gap.

Decision: complete; no tooling-only task now.

## Selected Follow-Up

### task-1577 — Add omitted glTF sampler default mapping browser coverage

Category: `webgpu-render`
Package/write-scope:
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
and implementation files only if the fixture exposes a focused defect.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_OPAQUE_DOUBLE_SIDED_PLAN_2026_05_18.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`packages/render/src/materials/gltf-sampler.ts`,
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
`references/three.js/src/textures/Texture.js`, and
`references/engine/src/platform/graphics/texture.js`.

Acceptance criteria:

- Add a glTF-shaped browser scenario whose texture omits the `sampler` field.
- Preserve `source: null` or equivalent JSON-safe status for the omitted sampler
  source rather than pretending an authored sampler exists.
- Assert mapped sampler defaults are repeat addressing and linear filtering.
- Assert one texture resource, one sampler resource, one draw, no diagnostics,
  and no raw backend resources in JSON status.

## Next Step

Run `task-1576` to audit this selected follow-up before implementation.
