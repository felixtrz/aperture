# GLB Import Facade Mesh Mapping Boundary Audit - 2026-05-17

## Scope

Audited optional mesh primitive/accessor/mesh-construction report creation
inside the report-driven import facade from `task-0734` and `task-0735`.

Audited files:

- `docs/research/GLB_IMPORT_FACADE_OPTIONAL_MESH_MAPPING_PLAN_2026_05_17.md`
- `packages/render/src/assets/gltf-report-driven-import.ts`
- `test/assets/gltf-report-driven-import.test.ts`
- `test/assets/gltf-report-driven-import-json.test.ts`

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `packages/render/src/assets/gltf-mesh-primitive.ts`
- `packages/render/src/assets/gltf-accessor-validation.ts`
- `packages/render/src/assets/gltf-accessor-decoding.ts`
- `packages/render/src/assets/gltf-mesh-asset-construction.ts`
- Existing mesh source registration and ECS command planning boundaries.

## Findings

No boundary drift found.

Optional mesh mapping in the import facade remains a pure source-data report
path. When enabled, it composes primitive mapping, accessor validation, accessor
decoding, and mesh construction reports from glTF JSON plus caller-provided
buffer bytes. It does not register mesh source assets, mutate `AssetRegistry`,
mutate `EcsWorld`, author ECS commands, replay ECS commands, run transform
resolution, run render extraction, create render packets or snapshots, upload
WebGPU buffers, fetch external resources, or use browser APIs.

The facade rejects `provided.meshConstruction` when `createMeshAssets` is true,
keeping the authoritative mesh construction report unambiguous.

The JSON projection delegates to existing mesh report JSON helpers. Constructed
mesh vertex/index typed arrays are summarized by array type and length rather
than embedded as raw buffers.

## Validation

- Ownership scan found only expected JSON-safety assertions; it found no
  forbidden imports or mutation/render/WebGPU APIs.
- `pnpm run check:boundaries` passed.
- `pnpm exec vitest run test/assets/gltf-report-driven-import.test.ts test/assets/gltf-report-driven-import-json.test.ts`
  passed.
- `pnpm exec tsc --noEmit -p tsconfig.test.json` passed during the mesh
  composition and JSON test slices.

## Follow-Ups

No corrective refactor is needed.

The next facade work should be conservative: either add focused diagnostics for
optional material/mesh stage conflicts or plan a narrow source-registration
orchestration helper that keeps `AssetRegistry` mutation explicit.
