# StandardMaterial Texture-Control Harness Maintainability Audit - 2026-05-17

## Scope

Audit `examples/standard-texture-control.js` and
`test/e2e/standard-texture-control.spec.ts` after the controlled texture browser
harness grew to cover StandardMaterial base color, UV1, linear sampler,
metallic-roughness, normal maps, occlusion, emissive, missing source textures,
and missing tangents.

This audit does not refactor the harness or change runtime behavior.

## References Inspected

- `docs/ARCHITECTURE.md`
- `examples/standard-texture-control.js`
- `test/e2e/standard-texture-control.spec.ts`
- `docs/research/CONTROLLED_STANDARD_TEXTURE_TRANSFORM_DIAGNOSTICS_BROWSER_PLAN_2026_05_17.md`

## Findings

The harness is still boundary-safe:

- Authoring goes through `createWebGpuApp`, typed render asset collections,
  source mesh/material/texture/sampler assets, and ECS-facing components.
- GPU resources, readback buffers, pipelines, bind groups, and command
  submission remain inside `@aperture-engine/webgpu`.
- Browser status remains JSON-safe: it exposes keys, expected colors/settings,
  pipeline/layout strings, counters, diagnostics, and optional readback samples,
  not GPU objects or backend cache maps.

The maintainability risk is now real:

- `examples/standard-texture-control.js` is over 500 lines and scenario setup is
  spread through repeated `usesX` booleans and nested ternaries for mesh,
  texture handle, texture bytes, texture metadata, sampler settings, material
  bindings, lighting, and expected status fields.
- `test/e2e/standard-texture-control.spec.ts` is over 900 lines, with repeated
  status assertions and similar screenshot/readback checks for positive
  scenarios.
- Adding `base-color-transform` directly into the current branch structure would
  increase the chance of mismatched texture metadata, expected status, or
  lighting behavior.

## Recommended Cleanup

Before adding more scenarios, extract small local helpers inside the example and
test files. Keep this as local harness cleanup, not a public API.

Suggested example helpers:

- `scenarioFlags(selectedScenario)` for booleans and expected-failure metadata.
- `createScenarioMesh(aperture, meshAsset, flags)` for tangent/UV1 fixture
  wrapping.
- `createScenarioTextureAsset(aperture, flags)` for bytes, label, semantic,
  color space, and format.
- `createScenarioSamplerAsset(aperture, flags)` for nearest versus linear
  sampler settings.
- `createScenarioMaterialInput(flags, texture, sampler)` for the textured
  StandardMaterial binding.
- `createScenarioExpectations(flags)` for status-only expected values.

Suggested Playwright helpers:

- shared positive status assertion for rendered two-peer scenarios;
- shared expected-failure assertion for no-submission diagnostics;
- shared readback sample lookup and color-distance helpers.

## Follow-Up

Add a focused cleanup task before `base-color-transform` if possible. The
cleanup should not move fixtures outside the example, introduce public API, or
change rendered behavior. Its validation should include the full
`standard-texture-control` Playwright spec and `pnpm run check`.
