# Prepared Resource Lifetime Pressure After UV1 Audit

Date: 2026-05-18

## Scope

Audit whether finite transformed `TEXCOORD_1` support increased prepared
StandardMaterial cache invalidation, bind group, diagnostics, or app route
pressure.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/research/STANDARD_MATERIAL_TRANSFORMED_UV1_SUPPORT_AUDIT_2026_05_18.md`
- `docs/research/STANDARD_MATERIAL_ROUTE_PREPARED_RESOURCE_CLEANUP_AUDIT_2026_05_18.md`
- `docs/research/GENERIC_ROUTE_PREPARED_RESOURCE_PRESSURE_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/prepared-standard-material-cache.ts`
- `packages/webgpu/src/webgpu/standard-material-buffer.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `test/webgpu/prepared-standard-material-cache.test.ts`
- `test/webgpu/webgpu-app.test.ts`

## Findings

Pass. Transformed UV1 support did not add prepared-resource lifetime pressure
that needs immediate cleanup.

Prepared StandardMaterial cache keys still use:

- source material handle key;
- source material version;
- pipeline key;
- bind group layout key;
- texture and sampler dependency handle/version segments for textured variants.

The UV set selection and `KHR_texture_transform` values are packed into the
StandardMaterial uniform buffer, not into new WebGPU resource families. Because
prepared material cache keys already include the source material version, edits
to `texCoord` or transform source data invalidate the prepared material buffer
through the existing source-version path. Texture and sampler dependency cache
segments remain correctly limited to texture/sampler handle versions.

The shader-side UV1 change adds an optional `uv1` vertex input and a uniform
`texCoord` selection path. It does not create a new pipeline family, material
route, app diagnostics field, prepared texture type, sampler type, or bind group
layout. Texture and sampler GPU resources remain renderer-owned; source
material assets continue to carry only handles and serializable texture
metadata.

## Risks

No immediate corrective test is needed for UV1 lifetime pressure. The next
observable risk is still architectural accumulation around StandardMaterial:
more source-side fidelity diagnostics are fine, but adding IBL, shadows, a GLB
viewer, or a new material family should wait until route/prepared-resource
contracts are kept generic.

## Recommendation

Proceed with the selected color-space format diagnostics slice from
`task-1222`, then audit it with `task-1226`. Keep prepared-resource lifetime
cleanup deferred unless the diagnostics implementation changes source material
versioning, prepared cache keys, WebGPU resource creation, or app report
routing.
