# StandardMaterial Normal-Map Browser Boundary Audit - 2026-05-17

## Scope

Audit the controlled `standard-texture-control?scenario=normal-map` browser
verification added in `task-1086`.

This audit checks architecture boundaries only. It does not add tangent
generation, GLB normal-map import, sampler comparisons, UV1 behavior, texture
transforms, IBL, shadows, or a missing-tangent browser scenario.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/CONTROLLED_STANDARD_NORMAL_MAP_BROWSER_VERIFICATION_PLAN_2026_05_17.md`
- `examples/standard-texture-control.js`
- `test/e2e/standard-texture-control.spec.ts`
- `packages/render/src/materials/standard-normal-map-readiness.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `test/webgpu/webgpu-app.test.ts`

## Findings

The normal-map browser proof stays within the ECS-authoritative runtime shape:

- Authoring still happens through `createWebGpuApp`, typed render asset
  collections, stable texture/sampler/material handles, and ECS-facing
  mesh/material/light/camera components.
- The local tangent helper produces a source `MeshAsset` with a `TANGENT`
  vertex attribute before registration. It does not add runtime tangent
  generation, mutate renderer state, or make WebGPU own mesh authoring data.
- The normal texture is a source texture asset with `semantic: "normal"` and
  `colorSpace: "data"`. GPU texture, sampler, bind group, pipeline, and
  readback ownership remain inside `@aperture-engine/webgpu`.
- Published status remains JSON-safe: it reports handle keys, expected normal
  bytes, pipeline keys, mesh layout keys, resource counters, diagnostics, and
  optional app-facade readback results. It does not expose GPU handles, command
  encoders, backend caches, or raw browser objects.
- Playwright now proves the `standard|normalTexture|opaque|back|less|none`
  pipeline, `POSITION,NORMAL,TEXCOORD_0,TANGENT` layout, texture/sampler
  resources, no diagnostics, screenshot distinction, and readback distinction.

The visible normal-map assertion uses scenario-specific lighting and a
deliberately tilted encoded normal so the current direct-light shader produces a
clear difference on the flat controlled plane. That is appropriate for browser
coverage of the authored normal slot, but it is not a claim of full glTF normal
map fidelity.

## Follow-Up

The planned negative browser path is still not covered. Add a focused scenario
for `normal-map-missing-tangents` that authors a normal texture on a mesh without
`TANGENT`, expects `render.standardNormalMap.missingTangents`, and verifies no
draw submission for the invalid frame.

The broader remaining texture-browser gaps are unchanged: occlusion, emissive,
UV1, sampler comparisons, texture transforms, GLB mapping, IBL, and shadows.

## Validation

- `node --check examples/standard-texture-control.js`
- `pnpm exec prettier --check examples/standard-texture-control.js test/e2e/standard-texture-control.spec.ts`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec playwright test test/e2e/standard-texture-control.spec.ts`
