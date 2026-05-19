# GLTF Scene Shadow Caster Command Plan Implementation — 2026-05-19

## Task

`task-1813` added a JSON-safe shadow caster command-plan readiness report.

## Reference Anchors

- `references/engine/src/scene/renderer/render-pass-shadow-directional.js`
- `references/three.js/src/renderers/webgl/WebGLShadowMap.js`
- Local `shadow-pass-plan`, `directional-shadow-view-projection-plan`,
  `shadow-matrix-buffer-descriptor`, and `shadow-caster-draw-list-plan`
  helpers.

The reference engines run shadow rendering after shadow targets, light-view
state, and caster draw lists are known. Aperture keeps this as a derived
readiness contract over extracted packets and renderer-owned descriptors, rather
than creating a live command encoder or mutable shadow scene.

## Implementation

- Added `createShadowCasterCommandPlanReadinessReport`.
- The report composes:
  - shadow pass-plan readiness,
  - directional view/projection planning,
  - shadow matrix-buffer descriptor readiness,
  - caster draw-list filtering, and
  - deferred GPU command encoding.
- The GLTF scene status now exposes `shadow.commandPlan` with command keys,
  matrix-buffer offsets, draw counts, and deferred command encoding status.

## Boundary Notes

- No `GPUCommandEncoder`, render pass, texture allocation, or draw submission is
  created.
- Command plans reference stable keys and extracted draw metadata only.
- ECS remains authoritative for light, shadow request, and mesh draw authoring;
  command encoding remains renderer-owned future work.

## Validation

- Added targeted coverage in
  `test/webgpu/shadow-caster-command-plan-readiness.test.ts`.
- Updated `test/e2e/gltf-scene.spec.ts` expectations for the browser status.
