# Next Route Or Standard Follow-Up After Sampler Wrap Visual Proof

Date: 2026-05-18

Task: `task-1570`

## Context

`task-1567` added a browser-visible glTF repeat sampler proof. The
StandardMaterial/glTF path now covers valid sampler enum preservation, mapped
prepared sampler settings, and one wrapped-versus-clamped out-of-range UV
sample.

The next slice should avoid broad sampler matrices and choose one remaining
route or StandardMaterial gap that is still small enough for a focused run.

## Candidates

### Generic Route / Prepared-Resource Candidate

Start converting the current built-in app route collector into a generic
material-family queue collector.

Pros:

- Advances the longer-term architecture spine for non-built-in material
  families.
- Reduces the risk that the current StandardMaterial-heavy app route becomes a
  permanent special case.

Cons:

- The next useful slice needs more precise ownership boundaries before editing
  route traversal.
- Recent collector work already extracted diagnostics and queued source asset
  helpers; another collector step risks broadening into adapter policy.

Decision: defer until a plan can name one specific collector responsibility to
move.

### StandardMaterial/glTF Fidelity Candidate

Add a browser proof for glTF opaque `doubleSided: true` render-state behavior.

Pros:

- Builds on existing alpha-mask and alpha-blend double-sided coverage without
  adding a new material route.
- Exercises a real glTF render-state mapping that matters for imported
  metallic-roughness materials.
- Can reuse the existing backface sample pattern and only add one scenario and
  one Playwright assertion.

Cons:

- This is another fixture-level browser proof, not route architecture work.
- It should stay limited to opaque double-sided behavior and avoid expanding
  into a full alpha/cull matrix.

Decision: select.

### Diagnostics / Tooling Candidate

Add a public helper for reading the route-report diagnostic section from app
diagnostics.

Pros:

- Would reduce repeated test scanning if route report diagnostics become a
  public inspection surface.

Cons:

- No external consumer needs it yet.
- The field-naming audit confirmed the current surface is not ambiguous.

Decision: defer.

## Selected Follow-Up

### task-1572 — Add opaque double-sided glTF browser coverage

Category: `webgpu-render`
Package/write-scope:
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
and implementation files only if the fixture exposes a focused defect.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_SAMPLER_WRAP_VISUAL_PROOF_PLAN_2026_05_18.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
`references/three.js/src/materials/Material.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Add a glTF-shaped browser scenario for `alphaMode` default/opaque plus
  `doubleSided: true`.
- Assert JSON-safe render-state status maps to `alphaMode: "opaque"` and
  `cullMode: "none"`.
- Assert a backface screenshot/readback sample renders non-clear content.
- Defer alpha/cull matrices, binary GLB loading, IBL, shadows, and real
  non-built-in app rendering.

## Next Step

Run `task-1571` to audit this selected follow-up before implementation.
