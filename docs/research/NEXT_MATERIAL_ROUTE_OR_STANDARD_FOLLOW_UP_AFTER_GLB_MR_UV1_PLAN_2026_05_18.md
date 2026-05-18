# Next Material Route Or Standard Follow-Up After GLB MR UV1 Plan — 2026-05-18

## Context

The latest browser slice proves GLB-derived metallic-roughness texture sampling
through transformed `TEXCOORD_1`. StandardMaterial now has good focused browser
coverage for individual glTF texture slots, several transform cases, UV1
readiness, alpha modes, and invalid dependency diagnostics.

The next slice should keep advancing the material/render architecture spine
without starting GLB viewer work, IBL, shadows, route renames, or custom
material rendering.

## Candidate A — Material Route Architecture

Add duplicate or missing-family diagnostics around the built-in app resource
adapter registration factory.

Pros:

- Continues tightening the generic route spine.
- Low implementation risk.
- Helps future non-built-in material routing fail clearly.

Cons:

- Mostly defensive after the adapter registry smoke slice.
- Does not improve rendered StandardMaterial/glTF behavior.

## Candidate B — StandardMaterial/glTF Fidelity

Add GLB-derived browser coverage for a single StandardMaterial using both
`baseColorTexture` and `metallicRoughnessTexture`.

Pros:

- Exercises the combined material-family shader/pipeline path through the
  browser app, not just unit-level pipeline/resource tests.
- Verifies multiple texture/sampler dependencies are registered, prepared, and
  bound for one StandardMaterial draw.
- Advances practical glTF material coverage without pretending full PBR,
  binary GLB loading, IBL, or shadows are complete.

Cons:

- Requires a fixture with two resolved texture slots and careful status
  assertions.
- Pixel expectations should stay qualitative enough to avoid overfitting the
  current direct-light MVP shader.

## Candidate C — Diagnostics/Tooling

Add a stale public-tracker wording check for route/material features that have
recently moved from missing to working.

Pros:

- Reduces dashboard drift.
- Cheap to validate.

Cons:

- Tooling-only; the current proof path benefits more from another
  StandardMaterial browser fidelity slice.

## Selected Follow-Up

Select Candidate B: add GLB-derived combined base-color plus metallic-roughness
StandardMaterial browser coverage.

The task should remain narrow: extend the existing `standard-gltf-texture`
fixture with one combined-material scenario, assert JSON-safe status for both
texture slots/dependencies and the combined pipeline key, and use screenshot or
readback pixels to prove the combined texture path affects output.

## Proposed Task

### task-1426 — Add GLB combined base-color metallic-roughness browser coverage

Category: `webgpu-render`
Package/write-scope:
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`;
targeted StandardMaterial/glTF mapping code only if the fixture exposes a bug.
Reference anchor:
existing StandardMaterial GLB texture fixtures,
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, `references/bevy/crates/bevy_pbr/src/gltf.rs`,
`references/three.js/src/renderers/webgpu/utils/WebGPUTextureUtils.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Add a GLB-derived StandardMaterial browser fixture with both
  `baseColorTexture` and `metallicRoughnessTexture` resolved.
- Verify JSON-safe status includes both texture/sampler mappings, material
  readiness for both slots, expected resource counts, and the combined
  `standard|baseColorTexture|metallicRoughnessTexture|...` pipeline key.
- Verify a screenshot or readback pixel proves the combined textured material
  affects rendered output.
- Keep binary GLB loading, GLB viewer work, IBL, shadows, route renames, broad
  PBR completeness, and non-built-in material rendering deferred.
