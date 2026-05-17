# GLB Registry Handoff Boundary Audit - 2026-05-17

## Scope

Audited the source asset registry handoff introduced around:

- `packages/render/src/assets/gltf-source-registration.ts`
- `test/assets/gltf-source-registration.test.ts`
- `test/assets/gltf-source-registration-json.test.ts`
- `test/assets/gltf-source-registration-dependencies.test.ts`
- `docs/research/GLB_SOURCE_ASSET_REGISTRY_REGISTRATION_CONTRACT_PLAN_2026_05_17.md`
- `docs/research/GLB_ECS_AUTHORING_COMMAND_HANDOFF_PLAN_2026_05_17.md`

Reference anchors:

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/research/GLB_ORCHESTRATION_REPORT_BOUNDARY_AUDIT_2026_05_17.md`
- `docs/research/GLB_SOURCE_ASSET_REGISTRY_REGISTRATION_CONTRACT_PLAN_2026_05_17.md`
- Aperture `AssetRegistry`
- Bevy glTF sub-asset loading and scene spawning separation
- PlayCanvas container resource loading vs entity instantiation separation

## Result

No boundary drift was found.

- Registry handoff writes only source `TextureAsset`, `SamplerAsset`, and
  `MaterialAsset` entries into `AssetRegistry`.
- Written entries are marked `ready` and keep JSON-safe registration reports.
- Duplicate keys are skipped with diagnostics instead of overwriting existing
  entries.
- Partial failure is best-effort: valid entries can be written while skipped
  entries remain explicit in the report.
- Material registry entries record texture/sampler dependencies through normal
  `AssetRegistry` dependency edges.
- Existing texture/sampler entries can satisfy material dependencies without
  being overwritten.
- The helper does not author ECS entities, create direct `Entity` references,
  decode images, fetch external resources, create render snapshots, or touch
  WebGPU.

## Validation

- `pnpm run check:boundaries`
- `pnpm exec vitest run test/assets/gltf-source-registration.test.ts
test/assets/gltf-source-registration-json.test.ts
test/assets/gltf-source-registration-dependencies.test.ts`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`

All passed before the end-of-run validation.

## Follow-Up

The next GLB implementation should not jump directly to ECS spawning. The next
safe slice is minimal mesh primitive source asset planning, because the ECS
authoring plan now explicitly depends on mesh handles, node traversal, transform
mapping, and material handle resolution.
