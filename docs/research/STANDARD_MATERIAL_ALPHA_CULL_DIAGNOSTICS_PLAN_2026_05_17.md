# StandardMaterial Alpha/Cull Diagnostics Plan - 2026-05-17

## Goal

Add a narrow diagnostics/test slice for StandardMaterial alpha mode and
double-sided culling behavior without broad PBR shader changes.

The slice should make the current render-state contract easier to inspect:

```text
StandardMaterial source renderState
  -> material pipeline key tokens
  -> queue phase
  -> WebGPU depth/blend/cull descriptor state
```

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/MINIMAL_GLB_MATERIAL_MAPPING_PLAN_2026_05_17.md`
- `docs/research/ALPHA_TRANSPARENT_QUEUE_CONSUMPTION_PLAN_2026_05_17.md`
- `packages/render/src/materials/factories.ts`
- `packages/render/src/materials/validation.ts`
- `packages/render/src/materials/gltf-material.ts`
- `packages/render/src/materials/pipeline-key.ts`
- `packages/render/src/rendering/extraction.ts`
- `packages/webgpu/src/webgpu/material-render-state.ts`
- `packages/webgpu/src/webgpu/standard-material-buffer.ts`
- `packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`
- `packages/webgpu/src/webgpu/built-in-material-queue-phase.ts`
- `test/materials/gltf-material.test.ts`
- `test/materials/materials.test.ts`
- `test/webgpu/standard-material-buffer.test.ts`
- `test/webgpu/standard-pipeline-descriptor.test.ts`
- `test/webgpu/built-in-material-queue-phase.test.ts`

## Existing Contract

- glTF `OPAQUE`, `MASK`, and `BLEND` map to Aperture `alphaMode: "opaque"`,
  `"mask"`, and `"blend"`.
- glTF `doubleSided: true` maps to `cullMode: "none"`; otherwise the default is
  back-face culling.
- `alphaMode: "blend"` must use non-`none` blend state and disable depth writes
  on the source render state.
- Material pipeline keys encode alpha mode, cull mode, depth compare, and blend
  preset.
- WebGPU descriptor planning resolves the pipeline key into primitive culling,
  color-target blend state, and depth-write behavior.
- StandardMaterial uniform packing stores `alphaCutoff` and feature flags for
  alpha mask, alpha blend, and double-sided culling.
- Queue routing allows StandardMaterial transparent draws only for alpha blend;
  unsupported transparent families or unsupported blend presets produce
  JSON-safe diagnostics.

## Proposed Slice

Add a small WebGPU diagnostics helper rather than altering render behavior:

```ts
createStandardMaterialRenderStateSummary({
  material,
  materialKey,
  pipelineKey,
  renderPhase,
  depthFormat,
});
```

The helper should be pure and JSON-safe. It should not accept or return GPU
handles. It should summarize:

- source render state: `alphaMode`, `alphaCutoff`, `cullMode`, `depth.write`,
  and `blend.preset`;
- derived flags: `alphaMask`, `alphaBlend`, and `doubleSided`;
- pipeline tokens/resolved state: alpha mode, cull mode, depth compare,
  depth-write enabled, and blend preset/presence;
- queue phase when supplied;
- diagnostics copied from render-state validation, plus optional mismatch
  diagnostics when supplied pipeline tokens disagree with source render state.

Keep diagnostics informational and warning-oriented. Do not block or reroute
draws in this helper; queue validation and pipeline descriptor planning already
own runtime behavior.

## Focused Tests

Add or expand tests to cover:

- opaque StandardMaterial: no blend, back cull, depth write enabled;
- mask StandardMaterial: alpha cutoff and alpha-mask flag are visible, no blend,
  depth write remains enabled;
- blend StandardMaterial: alpha-blend flag, alpha blend preset, depth writes
  disabled when authored correctly;
- double-sided StandardMaterial: `cullMode: "none"` and double-sided flag are
  visible;
- invalid authoring diagnostics: out-of-range alpha cutoff, blend with source
  depth writes enabled, and blend with `blend.preset: "none"`;
- optional source/pipeline mismatch diagnostics for alpha or cull token drift.

## Non-Goals

- Do not change StandardMaterial shader lighting or PBR equations.
- Do not add new alpha modes, alpha hash, transmission, or order-independent
  transparency.
- Do not change queue routing, sorting, or actual WebGPU pipeline creation
  behavior unless tests expose an existing bug.
- Do not move GPU state into render/source material assets.

## Backlog Follow-Up

`task-0964` already has the right shape. Tighten its target to the helper above
and focused tests; keep `task-0965` as the boundary audit after implementation.
