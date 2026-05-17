# App Texture Sampler Cache Summary Report Boundary Audit - 2026-05-17

## Scope

Audit the app report integration for retained texture/sampler backend cache
summaries.

The goal is to verify that `textureSamplerCache` stays separate from prepared
material cache ownership and remains JSON-safe.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/research/PREPARED_TEXTURE_SAMPLER_CACHE_SUMMARY_BOUNDARY_AUDIT_2026_05_17.md`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/app-texture-sampler-resources.ts`
- `packages/webgpu/src/webgpu/prepared-app-material-resource.ts`
- `test/webgpu/app-texture-sampler-resources.test.ts`
- `test/webgpu/webgpu-app.test.ts`

## Findings

### App report names ownership separately

`WebGpuAppResourceReuseReport` now includes `textureSamplerCache` as a retained
backend cache summary.

It remains separate from:

- `preparedMaterialCache`;
- `preparedMaterialFacade`;
- texture/sampler per-frame creation/reuse counters;
- prepared mesh cache/facade summaries.

This naming keeps material preparation dependencies from becoming material
cache ownership.

### Summary is JSON-safe

`textureSamplerCache` reports only:

- `textureEntries`
- `samplerEntries`
- `totalEntries`

Focused app tests assert representative GPU/source payload markers are absent
from the JSON report.

### Per-frame counters retain their meaning

The existing texture/sampler counters still answer "what happened this frame":

- `textureResourcesCreated`
- `textureResourcesReused`
- `samplerResourcesCreated`
- `samplerResourcesReused`

`textureSamplerCache` answers "what is retained by the backend cache after the
frame." Those questions remain separate.

### Prepared material cache is not broadened

Prepared material cache summaries still count built-in prepared material cache
entries by material family. They do not include texture/sampler resources even
when prepared materials depend on texture/sampler bindings.

## Result

No ownership drift found.

The next useful task is to plan whether retained backend cache summaries should
stay as flat app report fields or gain a grouped object while preserving
backward compatibility and clear resource-family ownership.
