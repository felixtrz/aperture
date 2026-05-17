# Retained Backend Cache Summary Grouping Boundary Audit - 2026-05-17

## Scope

Audit the retained backend cache summary report shape after adding texture and
sampler retained-cache counts.

The goal is to verify that flat retained-cache fields remain descriptive
backend metadata and do not blur facade readiness, per-frame counters, or
resource-family ownership.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/research/RETAINED_BACKEND_CACHE_SUMMARY_GROUPING_PLAN_2026_05_17.md`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/prepared-mesh-cache.ts`
- `packages/webgpu/src/webgpu/prepared-app-material-resource.ts`
- `packages/webgpu/src/webgpu/app-texture-sampler-resources.ts`
- `test/webgpu/webgpu-app.test.ts`

## Findings

### Flat fields preserve ownership

The app report keeps retained backend cache summaries as explicit flat fields:

- `preparedMeshCache`
- `preparedMaterialCache`
- `textureSamplerCache`

No generic grouping was added. This avoids implying that all retained backend
resources share the same ownership, eviction, or preparation semantics.

### Facade readiness remains separate

Renderer-independent facade summaries remain separately named:

- `preparedMeshFacade`
- `preparedMaterialFacade`

The retained backend cache summaries do not replace facade readiness and do not
control snapshot pruning.

### Per-frame counters remain separate

Creation/reuse counters still describe frame work. Retained cache summaries
describe backend cache state after the frame. Eviction reports are not included
in the app report yet.

That separation keeps report consumers from treating a retained cache count as
proof that the current frame created or reused a resource.

### JSON coverage spans resource families

The app JSON regression now checks a Standard textured route where retained
mesh, material, texture, and sampler backend cache summaries all participate.
The test verifies representative source labels and GPU/source payload markers
are absent from the retained summary subset.

### No compatibility risk introduced

No report fields were renamed or nested. Existing flat fields remain intact.

## Result

No report-shape ownership drift found.

The next useful work should move back toward the material/render pipeline spine,
using the now-clear retained cache summaries as diagnostics rather than adding
more report reshaping.
