# StandardMaterial Route Prepared Resource Cleanup Audit

Date: 2026-05-18

## Scope

Audit the targeted cleanup regression added after expanding StandardMaterial
texture-transform uniform packing to 208 bytes.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/research/STANDARD_MATERIAL_ROUTE_PREPARED_RESOURCE_CLEANUP_PLAN_2026_05_18.md`
- `docs/research/GENERIC_ROUTE_PREPARED_RESOURCE_PRESSURE_AUDIT_2026_05_18.md`
- `test/webgpu/webgpu-app.test.ts`
- `test/webgpu/standard-material-buffer.test.ts`
- `references/three.js/src/renderers/common/Pipelines.js`
- `references/engine/src/platform/graphics/shader-processor-glsl.js`
- `references/engine/src/platform/graphics/texture.js`

## Findings

The cleanup implementation stayed within the selected regression-test scope.
No new WebGPU app route, material family, prepared-resource type, pipeline key,
or diagnostics field was introduced.

The app-level StandardMaterial texture-resource regression now exercises a
finite base-color texture transform while preserving the existing cache reuse
path:

- first frame creates the StandardMaterial material buffer, texture, sampler,
  bind groups, light buffer, and pipeline;
- second frame reuses the material buffer, texture, sampler, bind groups, light
  buffer, and pipeline;
- later texture and sampler version changes still invalidate the prepared
  StandardMaterial cache through the existing source-version path.

The diagnostics boundary remains generic. The regression asserts the JSON-safe
`routedResourceSet` summary for the `standard` family and the direct-light
readiness keys without exposing GPU descriptors or raw WebGPU objects.

The local reference patterns align with the current Aperture direction:

- Three.js keeps pipeline reuse behind cache keys derived from render object and
  shader state.
- The engine reference separates material/view/mesh resource binding shapes and
  tracks texture property versions that can invalidate bind groups.
- Aperture's version keeps source ECS/material assets separate from renderer
  owned prepared resources, with app diagnostics exposing summaries rather than
  retained resource objects.

## Validation

- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts test/webgpu/standard-material-buffer.test.ts`

## Recommendation

This cleanup slice is complete. The next work can safely move to planning the
next material boundary decision. Prefer a docs-only selection between
transformed `TEXCOORD_1` support and lighting/IBL contract work before adding
more StandardMaterial shader fields.
