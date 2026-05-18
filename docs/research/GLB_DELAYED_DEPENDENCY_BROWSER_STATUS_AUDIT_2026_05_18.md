# GLB Delayed Dependency Browser Status Audit - 2026-05-18

## Scope

Audit the `standard-gltf-texture?scenario=delayed-dependencies` browser status
after adding GLB-derived loading/failed texture and sampler dependency coverage.

This audit did not change runtime behavior.

## References Inspected

- `docs/research/GLB_STANDARD_MATERIAL_DEPENDENCY_DIAGNOSTICS_MATRIX_2026_05_17.md`
- `docs/ARCHITECTURE.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/render/src/materials/dependency-readiness.ts`
- `packages/render/src/materials/standard-texture-readiness.ts`

## Findings

The delayed dependency browser scenario stays on the intended source-asset
boundary:

- GLB-shaped mapping creates source material, texture, and sampler handles.
- Source registration initially writes ready source assets and dependency edges.
- The example then marks two source texture/sampler dependencies `loading` or
  `failed` in `AssetRegistry`.
- Render extraction emits render-facing diagnostics for non-ready StandardMaterial
  texture dependencies and skips draw extraction.
- `WebGpuApp` converts the blocked entity into a JSON-safe
  `webGpuApp.materialDependenciesNotReady` diagnostic with
  `materialDependencyReadiness`.

The published status preserves GLB-derived keys and readiness details for:

- `texture:gltf:texture:0:baseColorTexture` as `loading`;
- `sampler:gltf:sampler:0:baseColorTexture` as `failed`;
- `texture:gltf:texture:1:normalTexture` as `failed`;
- `sampler:gltf:sampler:1:normalTexture` as `loading`.

The status is still JSON-safe under `expectStatusJsonSafeForGpu`; it publishes
handle keys, plain status strings, diagnostic codes, and material dependency
readiness records. It does not publish source asset payload objects, texture
bytes, GPU textures, samplers, bind groups, pipelines, devices, queues, or
backend caches.

## Boundary Check

The failure is reported before WebGPU resource preparation. This matches the
architecture: source dependency readiness belongs to the ECS/render bridge and
app orchestration layer, while GPU resources remain renderer-owned and are not
created for blocked material dependencies.

## Gap

The scenario currently publishes material dependency readiness but does not
publish the separate StandardMaterial texture-readiness report. That report can
explain slot-level texture/sampler readiness in the same field vocabulary used
by `standardMaterialTexture.*` diagnostics.

This is a concrete status enhancement, not a renderer behavior blocker, and is
already tracked as `task-1141`.

## Follow-Up

- Keep `task-1141` ready to add JSON-safe StandardMaterial texture-readiness
  status for delayed dependencies.
- Avoid adding WebGPU preparation diagnostics for this scenario unless a future
  renderer path actually reaches GPU resource preparation.
