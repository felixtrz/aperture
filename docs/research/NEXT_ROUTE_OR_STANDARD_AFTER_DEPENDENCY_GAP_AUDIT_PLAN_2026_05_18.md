# Next route or StandardMaterial follow-up after dependency gap audit - 2026-05-18

## Scope

Compare one route architecture candidate, one StandardMaterial/glTF fidelity
candidate, and one diagnostics/tooling candidate after the texture dependency
gap and route-boundary audits.

Reference anchors inspected:

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/DECISIONS.md`
- `docs/research/STANDARD_GLTF_TEXTURE_DEPENDENCY_GAP_AUDIT_AFTER_METALLIC_ROUGHNESS_2026_05_18.md`
- `docs/research/GENERIC_MATERIAL_ROUTE_BOUNDARY_BEFORE_NON_BUILT_IN_APP_MIGRATION_AUDIT_2026_05_18.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Candidate A - Route boundary diagnostics fixture

Add a test-only unknown route family app diagnostic fixture to further prove
route reports stay family-generic and JSON-safe.

Pros:

- Continues the route-boundary cleanup without starting custom material
  rendering.
- Aligns with decision 0010.

Risks:

- Less user-facing than closing real glTF texture dependency coverage.
- The current route boundary is already coherent enough to pause for one
  fidelity slice.

## Candidate B - Occlusion/emissive dependency browser coverage

Add a GLB-shaped browser scenario with both `occlusionTexture` and
`emissiveTexture` bindings where one occlusion dependency is loading and one
emissive dependency has failed.

Pros:

- Closes the remaining StandardMaterial/glTF secondary texture dependency gap
  found by `task-1534`.
- Reuses existing dependency readiness and JSON-safe status paths.
- Browser-verifiable with no shader or renderer architecture expansion.

Risks:

- Adds another fixture to an already large Playwright file; keep assertions
  focused and avoid helper churn unless necessary.

## Candidate C - Test helper cleanup

Extract delayed-dependency assertion helpers for the base/normal and
metallic-roughness scenarios before adding more dependency fixtures.

Pros:

- Would reduce local test duplication.

Risks:

- Mostly hygiene and not required to prove the next user-visible gap.
- Helper extraction can follow if the occlusion/emissive fixture creates
  meaningful duplication.

## Selection

Select Candidate B.

Queued follow-up:

### task-1542 - Add occlusion/emissive dependency diagnostics browser coverage

Category: `webgpu-render`
Package/write-scope:
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
and implementation files only if the fixture exposes a focused defect.
Reference anchor:
this plan,
`docs/research/STANDARD_GLTF_TEXTURE_DEPENDENCY_GAP_AUDIT_AFTER_METALLIC_ROUGHNESS_2026_05_18.md`,
`docs/ARCHITECTURE.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`packages/render/src/materials/gltf-material.ts`,
`packages/webgpu/src/webgpu/standard-shader.ts`,
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Add a GLB-shaped browser scenario with unavailable occlusion/emissive texture
  or sampler dependencies.
- Assert JSON-safe readiness/dependency diagnostics identify both affected
  slots and statuses.
- Assert no draw submission, no pipeline keys, and no prepared GPU resources.
- Keep IBL, shadows, binary GLB loading, broad PBR work, and app-level
  non-built-in rendering deferred.

## Validation

Planning-only task; covered by final formatting/check validation.
