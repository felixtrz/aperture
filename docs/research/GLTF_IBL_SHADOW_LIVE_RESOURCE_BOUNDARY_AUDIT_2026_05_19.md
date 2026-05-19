# GLTF IBL/Shadow Live-Resource Boundary Audit — 2026-05-19

## Scope

Audited the GLTF scene path after live IBL and shadow resources were added:

- app-owned IBL diffuse/specular texture resources and IBL samplers;
- live StandardMaterial IBL group 4 bind groups;
- live shadow depth texture resources;
- uploaded directional shadow matrix buffer resources;
- live shadow comparison sampler and StandardMaterial shadow group 5 bind
  groups.

This audit checks the renderer boundary only. It does not implement IBL shader
sampling, shadow-map pass encoding, pass submission, or StandardMaterial shadow
sampling.

## Reference Anchors Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `examples/gltf-scene.js`
- `packages/webgpu/src/webgpu/app-environment-resources.ts`
- `packages/webgpu/src/webgpu/standard-material-ibl-bind-group.ts`
- `packages/webgpu/src/webgpu/standard-material-shadow-bind-group.ts`
- `packages/webgpu/src/webgpu/shadow-depth-texture-resource.ts`
- `packages/webgpu/src/webgpu/shadow-matrix-buffer-resource.ts`
- `docs/research/FIRST_SHADOW_PASS_COMMAND_ENCODING_PLAN_2026_05_19.md`
- `references/engine/src/scene/graphics/env-lighting.js`
- `references/engine/src/scene/renderer/render-pass-shadow-directional.js`
- `references/three.js/src/extras/PMREMGenerator.js`
- `references/three.js/src/renderers/common/Bindings.js`
- `references/three.js/src/renderers/webgl/WebGLShadowMap.js`

Common reference pattern: environment prefiltering/bindings and shadow-map work
are renderer-owned resource/pass concerns. Scene or material authoring carries
semantic intent and stable references; the renderer prepares GPU resources and
encodes passes from that derived state.

## Findings

The live IBL/shadow resource boundary still matches Aperture's architecture.

- ECS and extraction carry stable handles and packets:
  `EnvironmentPacket`, `ShadowRequestPacket`, light packets, mesh draw packets,
  transforms, and material handles. The GLTF example derives IBL/shadow
  readiness from `report.snapshot` and source asset handles, not by storing GPU
  handles in ECS.
- GPU resources remain in `@aperture-engine/webgpu`. IBL textures, samplers,
  bind groups, shadow depth textures, shadow matrix buffers, and shadow bind
  groups are created by WebGPU helpers or private app cache state.
- The app environment resource cache is private and keyed by app object through
  `WeakMap`; it is not exported as authoritative gameplay state. Cache summaries
  expose counts only.
- JSON helpers omit raw GPU handles. Texture reports expose descriptor metadata
  and resource keys, matrix-buffer reports expose byte size and matrix keys,
  sampler reports expose descriptor metadata, and bind-group reports expose
  group/layout/resource keys plus entry resource keys.
- Deferred phases are still honest. GLTF status distinguishes live resources
  from shader sampling and shadow rendering, and the readiness grouping keeps
  IBL sampling plus shadow rendering marked `deferred`.

## Corrective Notes

No code correction was required for this audit.

Two diagnostic labels are now stale in wording but not behavior:

- `standardMaterialShadowBindGroup.bindGroupCreationDeferred`
- `shadowSamplerResource.bindGroupDeferred`

The live bind-group resource report correctly shows group 5 availability and
created/reused counts, so these descriptor/sampler diagnostics do not block the
next slice. Rename them in a later cleanup only if they start confusing status
readers.

## Tracker And Backlog Alignment

The tracker and backlog remain aligned with the current state:

- public progress points at the GLTF scene path, IBL/shadow readiness, live
  renderer resources, and deferred shader/pass work;
- `task-1859` is the correct next implementation slice because it moves shadow
  work from resource readiness into command-encoding readiness without changing
  ECS ownership or claiming visible shadow sampling.

## Recommendation

Implement `task-1859`: add a JSON-safe `ShadowPassCommandEncodingReport` over
the existing shadow pass plan, depth texture resources, matrix buffer resources,
caster draw lists, and command plans. Keep the report as a readiness/encoding
surface first; do not wire StandardMaterial shadow sampling in this slice.
