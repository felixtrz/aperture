# StandardMaterial Sampler Readiness Alignment Plan

Date: 2026-05-17

Task: `task-1043`

## Context

StandardMaterial now has two related inspection surfaces:

- `createStandardMaterialTextureReadinessReport()` reports dependency readiness,
  UV support, texture transform support, semantic, and color-space compatibility.
- `createStandardMaterialSamplerFidelityReport()` reports sampler fidelity
  warnings for mip filtering without mips, LOD range mismatches, and authored
  anisotropy that is not yet part of readiness reporting.

These should stay separate unless a warning affects whether the material can be
honestly rendered.

## Reference Anchors Inspected

- `packages/render/src/materials/standard-sampler-fidelity.ts`
- `packages/render/src/materials/standard-texture-readiness.ts`
- `packages/render/src/materials/gltf-sampler.ts`
- `references/three.js/examples/jsm/loaders/GLTFLoader.js`
- `references/three.js/src/textures/Texture.js`
- `references/engine/src/framework/parsers/glb-parser.js`
- `references/engine/src/platform/graphics/texture.js`

## Recommendation

Do not fold sampler fidelity warnings into `StandardMaterialTextureReadiness`
yet. The current warnings explain quality/fidelity gaps, not hard readiness
blockers:

- single-mip textures with mip filtering can still render, but may differ from
  glTF viewer expectations;
- `lodMaxClamp` beyond the available mip range is a sampler fidelity mismatch,
  not a missing dependency;
- authored anisotropy is currently not represented in readiness diagnostics, but
  WebGPU rendering can proceed without it.

The next implementation should instead add a small alignment helper that pairs
texture readiness and sampler fidelity reports into a compact combined summary.
This gives diagnostics consumers a single view of "blocking readiness issues"
versus "non-blocking sampler fidelity warnings" without changing rendering or
readiness semantics.

## Recommended Slice

Add `createStandardMaterialTextureSamplerAlignmentSummary()` in the render
package.

Suggested summary fields:

- `materialKey`
- `textureReady`
- `samplerFidelityReady`
- `blockingTextureDiagnosticCount`
- `samplerWarningCount`
- `byField`: per texture field with texture slot readiness and sampler warning
  count when present

The helper should consume existing JSON-safe report values and produce compact
JSON-safe output. It should not inspect the registry, create resources, generate
mips, or mutate source assets.

## Acceptance Criteria For Implementation

- Tests cover a material with blocking texture readiness diagnostics and
  non-blocking sampler warnings.
- Tests prove deterministic field ordering and JSON safety.
- Existing texture readiness and sampler fidelity report behavior remains
  unchanged.
- Render package typecheck passes.

## Non-Goals

- Do not change StandardMaterial readiness semantics in this slice.
- Do not generate mipmaps, alter sampler creation, or add anisotropy support.
- Do not add default app-frame report fields.
- Do not move WebGPU cache/resource ownership into render-package diagnostics.

## Follow-Up Task

Keep `task-1044` as the implementation follow-up for this alignment summary.
