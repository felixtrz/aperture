# Textured Standard Base-Color Prepared Boundary Audit - 2026-05-17

## Scope

Audit the base-color textured `StandardMaterial` prepared material helper and
app-route integration before adding app-route invalidation tests.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/RENDER_ASSET_PREPARATION.md`
- `docs/research/STANDARD_TEXTURED_PREPARED_DEPENDENCY_HANDOFF_PLAN_2026_05_17.md`
- `docs/research/SCALAR_STANDARD_PREPARED_APP_ROUTE_BOUNDARY_AUDIT_2026_05_17.md`
- `packages/webgpu/src/webgpu/prepared-standard-material-cache.ts`
- `packages/webgpu/src/webgpu/standard-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/app-texture-sampler-resources.ts`
- `packages/webgpu/src/webgpu/standard-frame-resources.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `test/webgpu/prepared-standard-material-cache.test.ts`
- `test/webgpu/webgpu-app.test.ts`

## Findings

- The base-color textured Standard prepared helper owns only WebGPU-derived
  group-2 material resources: the Standard material uniform buffer, the
  Standard group-2 material bind group, logical resource keys, source material
  version metadata, and base-color texture/sampler source-version dependency
  segments.
- Texture and sampler GPU resources remain prepared by
  `app-texture-sampler-resources.ts` and are passed into the material helper as
  dependencies. The prepared material cache does not own source texture assets,
  source sampler assets, texture upload state, sampler creation policy, or app
  texture/sampler cache maps.
- Light resources remain frame-derived. Group-3 light buffers and light bind
  groups are still produced by `standard-frame-resources.ts` from the extracted
  `RenderSnapshot`, and no light state is included in prepared material cache
  keys.
- The app route only uses the textured prepared helper for exactly
  base-color-textured Standard materials. Metallic-roughness, normal, occlusion,
  and emissive textured variants still fall back to the existing Standard
  frame-resource path until they receive explicit prepared-resource coverage.
- Prepared material reuse counters remain JSON-safe scalar report fields. The
  public report exposes creation/reuse counts for prepared material buffers and
  prepared material bind groups, but not cache maps, raw GPU buffers, raw bind
  groups, descriptors, texture views, samplers, or device handles.
- Source material assets, texture assets, sampler assets, and ECS authoring
  components remain authoritative outside WebGPU. The WebGPU route reads ready
  source asset versions and creates derived backend resources only after render
  extraction.

## Follow-Up Guardrails

- `task-0829` should cover source texture and source sampler version
  invalidation through the app route, while keeping broader textured Standard
  families out of scope.
- Future metallic-roughness, normal, occlusion, and emissive prepared-resource
  work should be added one family or one coherent family set at a time, with
  direct helper tests before app-route integration.
- Group-3 light resources must remain outside textured Standard material cache
  keys, even after additional texture families are prepared.

## Outcome

No boundary drift was found. The base-color textured Standard route follows the
same staged ownership model as textured unlit: source assets stay authoritative,
texture/sampler resources stay in the WebGPU texture/sampler path, and prepared
material resources stay backend-owned and derived.
