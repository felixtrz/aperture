# GLB Alpha/Double-Sided Render-State Diagnostics Plan

Date: 2026-05-17

## Scope

Plan the smallest GLB-derived browser diagnostics slice for material render
state: alpha mode and double-sided/cull behavior.

This is a planning slice. It does not implement the scenario, add new blending
features, change StandardMaterial shading, add order-independent transparency,
or claim full glTF render-state fidelity.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `packages/render/src/materials/gltf-material.ts`
- `packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`
- `test/materials/gltf-material.test.ts`
- `test/webgpu/standard-pipeline-descriptor.test.ts`

## Current State

glTF material mapping already maps source material fields into
`StandardMaterial.renderState`. The WebGPU StandardMaterial path encodes alpha
mode, cull mode, depth state, and blend preset into pipeline keys and descriptor
plans.

The GLB browser fixture currently focuses on texture slots. It reports pipeline
keys but does not yet publish an explicit JSON-safe source/render-state mapping
summary for GLB-derived materials.

## Selected First Slice

Add a diagnostics/status-only browser scenario before adding more visual
render-state complexity.

Scenario: `standard-gltf-texture?scenario=alpha-mask-double-sided`.

Material shape:

- `pbrMetallicRoughness.baseColorFactor`: fixed opaque scalar color;
- `alphaMode`: `"MASK"`;
- `alphaCutoff`: `0.35`;
- `doubleSided`: `true`;
- no texture binding required in the first render-state slice unless the
  existing GLB fixture helper requires one texture for source-registration
  shape. Prefer texture-free if the mapping path supports it.

Expected mapped render state:

- `alphaMode: "mask"`;
- `alphaCutoff: 0.35`;
- `cullMode: "none"`;
- `blend.preset: "none"`;
- depth test/write remains enabled with compare `"less"`.

Expected pipeline key:

- `standard|alpha-test|none|less|none` for scalar StandardMaterial, or the
  equivalent current key shape if a minimal texture binding remains necessary.

## Expected Browser Status

Publish a JSON-safe `standardTexture.renderState` or adjacent
`standardMaterial.renderState` object with:

- glTF source fields: `alphaMode`, `alphaCutoff`, `doubleSided`;
- mapped render state fields: `alphaMode`, `alphaCutoff`, `cullMode`, `blend`,
  and depth compare/write flags;
- pipeline key and mesh layout key;
- draw/resource counters and diagnostics.

Do not publish GPU pipelines, bind groups, command encoders, backend caches, or
raw WebGPU objects.

## Expected Assertions

The Playwright scenario should assert:

- status is rendered and JSON-safe;
- mapped render-state fields match the glTF source fields;
- extraction queues one draw with zero diagnostics;
- pipeline key reflects alpha-test and no culling;
- draw count is one;
- no WebGPU validation warnings are emitted.

This slice does not need a pixel-alpha edge test. It proves source-to-pipeline
render-state mapping in the browser. Pixel-level alpha-mask behavior can follow
after a dedicated masked texture fixture.

## Non-Goals

- No transparent blending proof in the first slice.
- No additive/custom blend mode.
- No sorting or multi-object transparency behavior.
- No double-sided visual proof with backfaces.
- No binary `.glb` loader/browser fetch path.

## Follow-Up Task

### task-1121 — Add GLB alpha-mask double-sided render-state browser diagnostics

Category: `runtime-orchestration`
Package/write-scope: `examples/standard-gltf-texture.js`,
`test/e2e/standard-gltf-texture.spec.ts`, and targeted material/pipeline tests
only if existing coverage exposes a mapping gap.
Reference anchor:
`docs/research/GLB_ALPHA_DOUBLE_SIDED_RENDER_STATE_DIAGNOSTICS_PLAN_2026_05_17.md`,
`packages/render/src/materials/gltf-material.ts`, and
`packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`.

Acceptance criteria:

- Add `standard-gltf-texture?scenario=alpha-mask-double-sided` with glTF source
  fields for `MASK` alpha and `doubleSided: true`.
- Browser status reports JSON-safe source and mapped render-state fields,
  pipeline keys, draw/resource counters, and diagnostics.
- Playwright verifies alpha-test/no-cull pipeline behavior and zero WebGPU
  validation warnings without claiming transparent blending or full
  double-sided visual fidelity.
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "alpha-mask"`
  and `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts` pass.
