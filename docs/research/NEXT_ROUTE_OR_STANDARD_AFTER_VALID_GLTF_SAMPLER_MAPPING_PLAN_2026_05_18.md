# Next Route Or Standard Follow-Up After Valid glTF Sampler Mapping Plan

Date: 2026-05-18

Task: `task-1564`

## Context

`task-1561` added valid non-default glTF sampler enum mapping coverage. The
browser fixture now proves source sampler enums are preserved in JSON-safe
status and mapped into prepared sampler settings, but it intentionally stops
short of a visual out-of-range UV proof for wrapping behavior.

## Candidates

### Route Architecture Candidate

Add a public helper for extracting the material queue route report diagnostic
from app diagnostics.

Pros:

- Would centralize repeated test scanning.
- Could help future tools consume route diagnostics.

Cons:

- `task-1556` found no current field-name ambiguity.
- No external consumer needs this API yet.
- It does not advance the glTF/material fidelity gap exposed by the latest
  sampler work.

Decision: defer.

### StandardMaterial/glTF Fidelity Candidate

Add a browser visual proof for valid glTF sampler wrap behavior using
out-of-range UVs.

Pros:

- Builds directly on the valid sampler enum mapping coverage.
- Closes the main caveat from `task-1562`: source and mapped sampler status are
  proven, but repeat/mirror-repeat behavior is not yet visually asserted in the
  glTF-shaped fixture.
- Can reuse concepts from the existing controlled StandardMaterial repeat
  sampler proof while staying inside the glTF browser fixture.

Cons:

- Requires careful UV/sample selection to stay deterministic.
- Should not become a generalized sampler test matrix.

Decision: select.

### Diagnostics / Tooling Candidate

Only update tracker/backlog after sampler mapping coverage.

Pros:

- Low risk.

Cons:

- Already handled by `task-1563`.
- Does not advance runtime or browser fidelity.

Decision: complete; no further tooling-only work now.

## Selected Follow-Up

### task-1567 — Add glTF sampler wrap visual browser proof

Category: `webgpu-render`
Package/write-scope:
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
and implementation files only if the fixture exposes a focused defect.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_VALID_GLTF_SAMPLER_MAPPING_PLAN_2026_05_18.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
`test/e2e/standard-texture-control.spec.ts`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Add a glTF-shaped browser scenario that uses a valid repeat or mirror-repeat
  sampler with UVs outside the 0..1 range.
- Assert JSON-safe sampler mapping status still preserves source enums and
  mapped sampler settings.
- Assert screenshot or readback samples distinguish wrapped sampling from clamp
  behavior.
- Keep the proof to one sampler/wrap behavior and defer sampler matrices, IBL,
  shadows, binary GLB loading, and real non-built-in app rendering.

## Next Step

Run `task-1565` to audit this selected follow-up plan before implementation.
