# Standard glTF texture dependency gap audit after metallic-roughness coverage - 2026-05-18

## Scope

Inventory remaining browser-verifiable StandardMaterial/glTF texture dependency
gaps after normal-scale visual proof and metallic-roughness dependency
diagnostics coverage.

Reference anchors inspected:

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `docs/research/METALLIC_ROUGHNESS_DEPENDENCY_DIAGNOSTICS_BROWSER_COVERAGE_AUDIT_2026_05_18.md`

## Current covered slots

- `baseColorTexture`: covered through the existing delayed dependency browser
  fixture, including loading texture and failed sampler diagnostics.
- `normalTexture`: covered through the existing delayed dependency browser
  fixture, including failed texture and loading sampler diagnostics.
- `metallicRoughnessTexture`: covered through the new
  `metallic-roughness-delayed-dependencies` browser fixture, including loading
  texture, failed sampler, zero draw submission, zero prepared resources, and
  JSON-safe status.

## Remaining gaps

- `occlusionTexture`: positive rendering and strength are covered, but
  unavailable texture/sampler dependency diagnostics are not isolated in a
  slot-specific browser scenario.
- `emissiveTexture`: positive rendering and transform mapping are covered, but
  unavailable texture/sampler dependency diagnostics are not isolated in a
  slot-specific browser scenario.
- Combined multi-texture dependency interactions are only partially covered by
  the base-color/normal delayed fixture. This is acceptable for now because the
  immediate gap is slot coverage, not a broad dependency matrix.

## Recommended follow-up

Queue a focused browser scenario for occlusion/emissive delayed dependencies
rather than expanding into a full matrix:

- Use one GLB-shaped material with both `occlusionTexture` and `emissiveTexture`
  bindings.
- Mark one occlusion dependency loading and one emissive dependency failed.
- Assert JSON-safe dependency/readiness diagnostics, no draw submission, zero
  prepared texture/sampler/material resources, and no raw GPU handles.

This improves StandardMaterial/glTF honesty for the remaining secondary texture
slots while keeping binary GLB loading, IBL, shadows, and broad PBR work
deferred.

## Validation

Documentation-only audit; covered by final formatting/check validation.
