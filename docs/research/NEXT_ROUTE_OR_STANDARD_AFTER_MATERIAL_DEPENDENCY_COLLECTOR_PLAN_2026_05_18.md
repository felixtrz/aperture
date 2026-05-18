# Next Route Or Standard Follow-Up After Material Dependency Collector Extraction

Date: 2026-05-18

Task: `task-1590`

## Context

`task-1587` extracted app material dependency readiness diagnostic collection
from `app.ts` into `app-diagnostics-summary.ts`. That finished a small
diagnostics-surface cleanup after the route-report collector extraction, so the
next slice should avoid adding another helper unless it unlocks route or
material behavior directly.

## Candidates

### Generic Route / Prepared-Resource Candidate

Start a real app-level non-built-in material-family route migration or move more
built-in collector traversal into a generic collector.

Pros:

- Directly advances the longer-term generic material-family route spine.
- Would reduce the risk that built-in route wrappers become permanent
  architecture.

Cons:

- Existing criteria still point to a larger boundary change: source asset
  contract, queue contract, prepare contract, app route contract, diagnostics,
  and browser verification all need to line up.
- The remaining built-in collector work mixes traversal, adapter policy,
  compatibility diagnostics, and app resource creation.
- A broad route migration is too large for the next focused follow-up.

Decision: defer.

### StandardMaterial / glTF Fidelity Candidate

Add a browser proof for glTF `emissiveFactor` without `emissiveTexture`.

Pros:

- Medium-term material goals explicitly include StandardMaterial emissive
  factors before broader PBR features.
- Three.js and the local reference engine both treat emissive color/factor as a
  base material input that can work with or without an emissive texture.
- Aperture already covers emissive texture, emissive texture transform, and
  combined emissive texture paths, but not a glTF-shaped emissive-factor-only
  browser path.
- The slice should stay in the existing glTF browser fixture with no route,
  shader, IBL, shadow, binary GLB, or non-built-in material changes.

Cons:

- It is another browser fixture, not route architecture cleanup.
- It must avoid growing into a full material-factor matrix.

Decision: select.

### Diagnostics / Tooling Candidate

Add more direct tests around app report JSON diagnostic collection.

Pros:

- Low risk after `task-1587`.
- Could further harden diagnostics.

Cons:

- The last two implementation slices already handled diagnostics helper
  extraction.
- Another diagnostics-only helper would not advance route architecture or glTF
  fidelity.

Decision: defer.

## Selected Follow-Up

### task-1592 — Add emissive-factor-only glTF browser coverage

Category: `webgpu-render`
Package/write-scope:
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
and implementation files only if the fixture exposes a focused defect.
Reference anchor:
this plan, `docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
`references/three.js/src/materials/MeshStandardMaterial.js`,
`references/three.js/src/renderers/webgl/WebGLMaterials.js`,
`references/engine/src/scene/materials/standard-material.js`, and
`references/engine/src/scene/shader-lib/wgsl/chunks/standard/frag/emissive.js`.

Acceptance criteria:

- Add a glTF-shaped StandardMaterial browser scenario with `emissiveFactor` and
  no `emissiveTexture`.
- Assert the scenario registers no texture or sampler assets, creates no
  texture or sampler GPU resources, and uses the scalar StandardMaterial opaque
  pipeline.
- Assert JSON-safe status exposes the expected emissive factor without raw GPU
  handles or source texture payloads.
- Assert screenshot or readback samples distinguish rendered emissive output
  from clear color.
- Keep emissive texture matrices, IBL, shadows, binary GLB loading, and
  app-level non-built-in rendering deferred.

## Next Step

Run `task-1591` to audit this selected follow-up before implementation.
