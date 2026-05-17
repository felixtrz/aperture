# Controlled StandardMaterial Texture Browser Verification Plan - 2026-05-17

## Scope

Plan the smallest browser-visible verification for StandardMaterial texture
sampling after semantic/color-space readiness diagnostics were confirmed and
promoted through extraction.

This is a planning slice. It does not implement new shaders, resource routes,
GLB loading, IBL, shadows, or texture-transform behavior.

## References Inspected

- `docs/research/STANDARD_METALLIC_ROUGHNESS_BROWSER_COVERAGE_PLAN_2026_05_17.md`
- `examples/materials-showcase.js`
- `test/e2e/materials-showcase.spec.ts`
- `examples/multi-entity.js`
- `test/e2e/multi-textured-unlit.spec.ts`
- `examples/webgpu-readback.js`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `test/webgpu/prepared-standard-material-cache.test.ts`

## Current State

The materials showcase already authors a StandardMaterial with base-color,
metallic-roughness, occlusion, and emissive textures. The Playwright test checks
that the feature list is published, the StandardMaterial cube is visible, and it
is visually distinct from Unlit and Matcap cubes.

That is useful smoke coverage, but it is not precise enough to prove texture
sampling. The cube rotates, lighting changes the final color, and the current
test samples broad screenshot regions instead of fixed readback points.

The multi-entity browser example already has the better verification pattern:
deterministic scene setup, authored tiny textures, explicit readback sample
points, expected color metadata, and Playwright pixel-distance assertions.

## Harness Check

The multi-entity browser example has the right readback pattern, but its shared
frame-resource path still goes through `createMultiMaterialUnlitFrameGpuResources()`.
That helper packs material buffers and group-2 entries through the unlit
resource path, so it is not a safe first host for StandardMaterial texture
verification.

## Decision

Add a small dedicated app-style browser example rather than expanding the
materials showcase or forcing StandardMaterial into the unlit multi-entity
harness.

The first implementation slice should add one controlled example that renders
two fixed StandardMaterial primitives:

- one scalar StandardMaterial baseline;
- one StandardMaterial using a base-color texture with a clearly different
  expected readback color.

The example should reuse the existing readback helper and status conventions
used by the unlit texture browser tests. It should assert:

- the StandardMaterial textured pipeline key is used;
- texture and sampler resources are created;
- the textured sample is visibly closer to the authored texture color than the
  scalar baseline sample;
- status JSON remains safe for app/browser diagnostics.

## Deferred Work

- Metallic-roughness, occlusion, and emissive pixel assertions should follow
  after the base-color proof is stable because lighting and tone interactions
  make exact colors less direct.
- Missing/not-ready StandardMaterial texture resource browser diagnostics should
  remain a separate negative-path scenario.
- GLB material import remains deferred until sampler conversion and
  texture-transform handling are covered.

## Follow-Up

Add a `runtime-orchestration` implementation task for a dedicated controlled
StandardMaterial texture example plus a focused Playwright test using existing
readback assertions. Keep generic multi-entity StandardMaterial support as a
separate frame-resource harness task if it becomes necessary.
