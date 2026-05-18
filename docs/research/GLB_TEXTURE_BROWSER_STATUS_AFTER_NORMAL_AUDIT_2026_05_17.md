# GLB Texture Browser Status After Normal Audit

Date: 2026-05-17

## Scope

Audit `examples/standard-gltf-texture.js` and
`test/e2e/standard-gltf-texture.spec.ts` after adding GLB-derived base-color,
metallic-roughness, normal-map, sampler status, and texture-transform diagnostic
coverage.

This audit does not change runtime behavior.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `packages/render/src/assets/gltf-asset-mapping.ts`
- `packages/render/src/assets/gltf-source-registration-orchestration.ts`

## Findings

No ownership drift found.

- The GLB browser fixture still uses glTF mapping/source registration reports to
  create source assets before authoring ECS mesh/material components.
- The renderer remains a derived view of extracted snapshots; the example does
  not introduce scene nodes or make WebGPU state authoritative.
- GPU textures, samplers, buffers, pipelines, bind groups, queues, and command
  encoders remain inside `@aperture-engine/webgpu`.
- Browser status remains JSON-safe. It publishes scenario ids, source/mapped
  sampler fields, material/texture/sampler/mesh handle keys, mapping counts,
  registration stages, expected slot metadata, pipeline/layout keys,
  diagnostics, draw/resource counters, and optional readback pixels.
- The status does not publish raw texture bytes, GPU resources, backend cache
  maps, queues, encoders, or WebGPU handles.

## Maintainability Notes

The local GLB helpers are now useful but should stay local:

- `createGltfScenarioConfig` is the right home for scenario flags, material
  model strings, texture slot selection, and expected status metadata.
- `expectRenderedGltfTextureStatus` and
  `expectExpectedGltfTextureFailureStatus` keep repeated e2e assertions aligned
  without creating a public test helper.
- The next texture slot additions should extend the local scenario config first
  rather than adding new top-level branches.

Concrete follow-up:

- Occlusion and emissive can reuse the existing scenario/status pattern from
  `docs/research/GLB_OCCLUSION_EMISSIVE_BROWSER_FIXTURE_SPLIT_PLAN_2026_05_17.md`.
- If another two GLB scenarios land, repeat this audit before adding more slots
  or moving helpers into shared test utilities.

## Validation

The audited state was covered by:

- `node --check examples/standard-gltf-texture.js`
- `pnpm run typecheck:test`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts`
- `pnpm run check:progress`
- `pnpm run check`
