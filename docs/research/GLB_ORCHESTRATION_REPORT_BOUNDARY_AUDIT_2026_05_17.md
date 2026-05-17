# GLB Orchestration Report Boundary Audit - 2026-05-17

## Scope

Audited the new GLB orchestration report helper:

- `packages/render/src/assets/gltf-asset-mapping.ts`
- `packages/render/src/assets/gltf-root.ts`
- GLB material, texture, sampler helper tests and JSON fixture tests

Reference anchors:

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/research/GLB_ROOT_MATERIAL_TEXTURE_HELPER_BOUNDARY_AUDIT_2026_05_17.md`
- `docs/research/MINIMAL_GLB_ASSET_MAPPING_ORCHESTRATION_REPORT_PLAN_2026_05_17.md`
- three.js `GLTFLoader`
- PlayCanvas `glb-parser`
- Bevy glTF asset loading

## Result

No drift was found.

- The orchestration helper validates root JSON, maps material-referenced
  textures, plans deterministic handle keys, and maps materials through the
  existing resolver boundary.
- Planned handle keys are deterministic and JSON-safe:
  `gltf:texture:<index>:<slot>`, `gltf:sampler:<index>:<slot>`, and
  `material:gltf:material:<index>`.
- The helper does not mutate assets, author ECS commands, decode images, fetch
  resources, create render snapshots, or touch WebGPU.
- Diagnostics preserve source layer, severity, material index, texture index,
  sampler index, slot, field, and message where available.
- Orchestration JSON uses nested JSON-safe helper values and does not embed raw
  image byte arrays.

## Validation

- `pnpm run check:boundaries`
- `pnpm exec vitest run test/assets/gltf-asset-mapping-json.test.ts
test/assets/gltf-asset-mapping.test.ts test/assets/gltf-root.test.ts
test/materials/gltf-report-json.test.ts
test/materials/gltf-material-texture-integration.test.ts
test/materials/gltf-texture.test.ts test/materials/gltf-material.test.ts
test/materials/gltf-sampler.test.ts`

Both passed.

## Recommendation

The next GLB work should plan registry mutation as a separate explicit contract.
Do not combine registry writes with ECS scene/node authoring or WebGPU
preparation. Keep each layer testable:

1. orchestration report,
2. source asset registry registration,
3. ECS authoring commands,
4. render extraction/preparation,
5. WebGPU resource creation.
