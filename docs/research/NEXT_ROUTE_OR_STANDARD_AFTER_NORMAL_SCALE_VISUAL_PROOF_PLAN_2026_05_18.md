# Next route or StandardMaterial follow-up after normal-scale visual proof - 2026-05-18

## Scope

Compare one route architecture candidate, one StandardMaterial/glTF fidelity
candidate, and one diagnostics/tooling candidate after the deterministic
`normalTexture.scale` browser proof.

Reference anchors inspected:

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/DECISIONS.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `packages/webgpu/src/webgpu/queued-source-assets.ts`
- `packages/webgpu/src/webgpu/material-queue-route-report.ts`
- `references/three.js/src/renderers/common/Bindings.js`
- `references/engine/src/scene/materials/standard-material.js`

## Candidate A - Route architecture boundary cleanup

Add another small helper around the built-in app route collector so more route
report state becomes family-generic before real non-built-in app rendering.

Pros:

- Aligns with the material-family route spine and decision 0010.
- Reduces the chance that built-in collector details become permanent
  architecture.

Risks:

- The most obvious generic helpers were already extracted recently.
- Another route cleanup now would be more valuable after a concrete new
  material-family adapter pressure test exposes the next seam.

## Candidate B - StandardMaterial glTF metallic-roughness dependency diagnostics

Add a glTF-shaped browser scenario where the metallic-roughness texture or
sampler dependency is unavailable, then assert JSON-safe readiness diagnostics,
zero prepared texture/sampler work for that slot, no draw submission, and no raw
GPU handles.

Pros:

- Directly improves glTF honesty for a core StandardMaterial/PBR texture slot.
- Browser-verifiable and small: it can reuse the existing delayed dependency
  fixture style without adding binary GLB loading.
- Keeps source material assets renderer-independent and leaves GPU resources in
  the WebGPU backend.

Risks:

- It is fidelity work rather than route cleanup, so route genericization still
  needs a follow-up after another implementation slice.

## Candidate C - Diagnostics/tooling cleanup

Extract a shared scalar-vs-textured browser assertion helper for glTF texture
fixtures now that normal-scale uses side-by-side readback samples.

Pros:

- Keeps the growing Playwright spec easier to scan.
- Low risk.

Risks:

- Mostly test hygiene; it does not materially advance the material pipeline.
- It can wait until one more texture-dependency scenario shows the next useful
  assertion shape.

## Selection

Select Candidate B.

Queued follow-up:

### task-1536 - Add metallic-roughness dependency diagnostics browser coverage

Category: `webgpu-render`
Package/write-scope:
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
and implementation files only if the fixture exposes a focused defect.
Reference anchor:
this plan, `docs/ARCHITECTURE.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`packages/render/src/materials/gltf-material.ts`,
`packages/webgpu/src/webgpu/standard-shader.ts`,
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Add a glTF-shaped browser scenario with an unavailable
  `metallicRoughnessTexture` texture or sampler dependency.
- Assert JSON-safe readiness/dependency diagnostics identify the
  metallic-roughness slot and dependency status.
- Assert no draw submission and no raw GPU handles leak through status JSON.
- Keep IBL, shadows, binary GLB loading, broad PBR work, and app-level
  non-built-in rendering deferred.

## Validation

Planning-only task; covered by final formatting/check validation.
