# GLTF Scene Post-Descriptor Resource Alignment Audit

Date: 2026-05-19

## Scope

Audited the GLTF scene resource chain after:

- `ShadowPassPlanReport`,
- `StandardMaterialShadowReadinessReport`, and
- `IblTexturePreparationReport`.

Reference anchors:

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/DECISIONS.md`
- `references/engine/src/scene/renderer/render-pass-shadow-directional.js`
- `references/engine/src/scene/renderer/shadow-renderer.js`
- `references/engine/src/scene/graphics/env-lighting.js`
- `references/three.js/src/renderers/WebGLRenderer.js`
- `references/three.js/src/renderers/webgl/WebGLShadowMap.js`
- `references/three.js/src/extras/PMREMGenerator.js`

## Findings

The new GLTF scene IBL/shadow reports preserve the intended boundary:

- ECS remains authoritative for source scene authoring and extracted shadow /
  environment packets.
- `packages/webgpu` owns renderer-side descriptor and readiness reports.
- JSON output carries only stable keys, counts, dimensions, formats, readiness
  booleans, status strings, and diagnostics.
- No `GPUTexture`, `GPUTextureView`, `GPURenderPass`, `GPUCommandEncoder`,
  `queue.submit`, WebGL fallback, mutable scene graph, or material adapter
  shortcut was introduced.
- StandardMaterial IBL and shadow readiness remain diagnostic surfaces. No WGSL
  shader sampling, bind-group layout changes, or visible IBL/shadow lighting is
  claimed.

Validation used for the audit:

- `pnpm run check:boundaries`
- `rg` scan for raw WebGPU handles / command submission / WebGL / scene graph
  shortcuts in the new report helpers and GLTF scene status path
- Existing targeted and GLTF scene validations from tasks `1801` through `1803`

## Follow-Up

The next task should update the public dashboard/resource status view and refill
the ready queue toward real renderer-owned work:

1. IBL upload/prefilter planning beyond descriptor keys.
2. Shadow matrix/camera data packing for the extracted directional shadow.
3. Shadow pass command planning against prepared caster draw data.
4. StandardMaterial shader binding metadata for shadow and IBL resources.
5. A follow-up audit before enabling visible shader sampling.
