# Generic Route Prepared Resource Pressure Audit

Date: 2026-05-18

## Scope

Audit whether the recent direct-light diagnostics and StandardMaterial texture
transform slices are increasing app-route or prepared-resource pressure enough
to require architecture cleanup before more material fidelity work.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/STANDARD_MATERIAL_NORMAL_TRANSFORM_SUPPORT_AUDIT_2026_05_18.md`
- `docs/research/STANDARD_MATERIAL_OCCLUSION_TRANSFORM_SUPPORT_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-set.ts`
- `packages/webgpu/src/webgpu/queued-built-in-frame-resource-set.ts`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-set-summary.ts`
- `packages/webgpu/src/webgpu/standard-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/prepared-standard-material-cache.ts`

## Findings

The recent texture-transform additions are not adding new route pressure yet:

- They stay inside the existing `standard` material family.
- Pipeline keys already encode texture-slot variants.
- The queued material frame-resource collector remains family-agnostic.
- Built-in app resource adapters still append through a common adapter table.
- App diagnostics summarize routed resources through generic family/pipeline
  buckets rather than new StandardMaterial-only arrays.

Prepared-resource pressure is growing but remains acceptable for one more
narrow texture slice:

- StandardMaterial now carries more uniform fields, but the fields are still a
  single source material buffer and bind group path.
- Texture/sampler dependencies are still resolved through existing
  StandardMaterial dependency plumbing.
- No renderer-owned GPU resource has moved into ECS or source assets.
- No new material family or app route was introduced for normal or occlusion
  transforms.

## Risks

The main risk is not the transform fields themselves. The risk is that each new
StandardMaterial texture variant keeps adding family-specific fixture and
diagnostic expectations while the generic material-family route remains
partially internal.

Watch for these triggers:

- another material family requiring app-status fields similar to
  `directLighting`;
- a non-built-in material family needing app facade rendering;
- repeated StandardMaterial-specific branches in queued app frame-resource
  preparation;
- prepared cache invalidation or lifetime reports becoming variant-specific.

## Recommendation

One more implementation slice is safe if it remains as narrow as the previous
transform work. The best next implementation is `emissiveTexture` finite
transform support on `TEXCOORD_0`, because it completes the currently rendered
glTF texture slots without introducing a new route, resource family, pass, IBL,
or shadow behavior.

After emissive transform support is audited, pause for a route cleanup or
prepared-resource lifetime task before larger lighting or GLB viewer work.
