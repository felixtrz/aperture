# Bevy ECS/Render Alignment

This note records the Bevy reference pass requested on 2026-05-16 and turns it
into Aperture architecture guidance. It is a planning artifact only; it does not
vendor Bevy code or require Aperture to match Bevy names exactly.

## Scope

Use the local Bevy checkout as Aperture's primary architectural reference for:

- ECS-authored renderability.
- Mesh and material handles stored as components.
- Assets as typed collections referenced by handles.
- Separate simulation and render worlds.
- Explicit extract, prepare, queue, sort, and render stages.
- Material assets that package shader, bind group, render state, and pipeline
  specialization behavior.

Aperture should copy these patterns conceptually while keeping its own
TypeScript, WebGPU-only, and worker-snapshot constraints.

## Reference Checkout

- Bevy: `./references/bevy`, branch `main`,
  commit `370be1b02`

Representative files inspected:

- `crates/bevy_mesh/src/components.rs`
- `crates/bevy_pbr/src/mesh_material.rs`
- `crates/bevy_pbr/src/material.rs`
- `crates/bevy_pbr/src/pbr_material.rs`
- `crates/bevy_asset/src/assets.rs`
- `crates/bevy_asset/src/render_asset.rs`
- `crates/bevy_render/src/extract_param.rs`
- `crates/bevy_render/src/extract_component.rs`
- `crates/bevy_render/src/render_asset.rs`
- `crates/bevy_render/src/sync_world.rs`
- `crates/bevy_render/src/lib.rs`
- `crates/bevy_render/src/pipelined_rendering.rs`

## Bevy Patterns To Borrow

### Renderability Is Opt-In ECS Data

Bevy entities are just ECS entities until render-facing components are added.
For a mesh entity, Bevy commonly uses:

- `Mesh3d(Handle<Mesh>)`
- `MeshMaterial3d<M: Material>(Handle<M>)`
- `Transform`

Because Aperture is 3D-only and does not plan to support 2D rendering, the
Aperture component names should drop Bevy's dimensional suffix:

- `Mesh`: stable `MeshHandle`.
- `Material`: stable material handle for the mesh's primary material.
- `LocalTransform` / `WorldTransform`.

Aperture should adopt the same authoring principle:

- An entity is not renderable by identity.
- A mesh handle component opts an entity into mesh extraction.
- A material handle component supplies the render material.
- Transform, visibility, layer, and render order remain separate components.

Before the initial Bevy-alignment refactor, Aperture's `MeshRenderer` bundled
mesh and up to four material slot strings into one component. That worked as an
internal packet source, but it was not the end-state authoring model and has
been replaced by separate `Mesh` and `Material` components.

### Assets Are Typed Collections

Bevy stores assets in typed ECS resources such as `Assets<Mesh>` and
`Assets<StandardMaterial>`. Adding an asset returns a typed handle. Components
store handles, not asset payloads.

Aperture currently has stable handles and a generic `AssetRegistry`. That is
compatible with the North Star, but the next API layer should expose typed asset
collections:

- `Assets<MeshAsset>`
- `Assets<UnlitMaterialAsset>`
- `Assets<StandardMaterialAsset>`
- `Assets<TextureAsset>`
- `Assets<SamplerAsset>`

The generic registry can remain as the manifest/status/diagnostics substrate,
but authoring code should not have to manually build handle strings or pass
generic kind strings in common paths.

### Asset Extraction And GPU Preparation Are Separate

Bevy's `RenderAsset` trait separates:

- main-world source asset data,
- extraction into the render world,
- GPU preparation into `RenderAssets<A>`,
- removal/unload handling,
- optional ownership transfer through `RenderAssetUsages`.

Aperture needs the same split in TypeScript form:

- source asset collections in simulation/runtime state,
- extracted asset changes or snapshot references,
- renderer-owned prepared mesh/material/texture resources,
- clear usage/lifetime flags for main-only, render-only, or both.

This is especially important before PBR. PBR is not just a shader; it requires a
material asset type, texture dependencies, prepared bind data, pipeline keys,
and renderer-owned GPU resources.

### Render World Is Separate From Main World

Bevy runs rendering in a separate render ECS world. It synchronizes only the
entities that need render data, then extracts specific components. The sync step
tracks entity mapping; extraction copies data. Bevy explicitly avoids copying
all app components into the render world.

Aperture should keep its serializable `RenderSnapshot` as the worker-friendly
boundary, but use Bevy as the model for the stages around it:

```text
Simulation world
  -> sync/extract render-relevant entity data
  -> extract changed asset data
  -> render snapshot / extracted resources
  -> render world prepared resources
  -> queue draw items
  -> sort phases
  -> WebGPU submit
```

The render world may remain a TypeScript resource/cache container instead of a
full ECS world at first, but it should be documented and shaped like a derived
render app: prepared assets, view data, draw queues, phase items, pipeline
caches, bind group caches, diagnostics, and frame reports.

### Materials Are Asset Families With Render Contracts

Bevy's `Material` trait packages the render contract for a material family:

- source asset type,
- bind group data,
- shaders,
- alpha/depth/render-state behavior,
- pipeline specialization,
- queue behavior.

`StandardMaterial` is an asset that implements that contract. It is referenced
by Bevy's mesh-material component.

Aperture currently models materials as a discriminated union with a
`MaterialKind`. That is fine for the MVP data schema, but the renderer needs a
separate material-family registration layer before PBR becomes maintainable:

- material asset schema,
- material family id,
- shader family,
- bind group layout descriptor,
- prepare-bind-data function,
- pipeline key/specialization function,
- queue selection and render-state mapping,
- dependency declarations for textures/samplers/environment data.

## Aperture State Today

Strong alignment already exists:

- ECS is authoritative.
- Transforms are ECS-owned.
- Render extraction produces flat `RenderSnapshot` data.
- Mesh renderability is authored with separate `Mesh` and `Material` components.
- Mesh, material, texture, sampler, render target, and environment data use
  stable handles.
- WebGPU objects are renderer-owned.
- The committed spinning cube proves ECS transform data can drive a real
  WebGPU draw through extraction and renderer-side submission.

Gaps against the Bevy pattern:

- `AssetRegistry` is generic and status-oriented, not a typed authoring resource
  like `Assets<MeshAsset>` or `Assets<StandardMaterialAsset>`.
- Asset preparation is spread across examples and WebGPU helpers, not formalized
  as an extract/prepare contract.
- `RenderWorld` is currently a renderer-state cache, not yet an explicit
  render-app layer with prepare, queue, phase sort, and render schedules.
- Material families are represented by `MaterialKind`, but not yet registered
  as pluggable renderer contracts.
- Example setup still exposes too much render plumbing to users.

## Required Code Direction

These are the concrete code changes Aperture should make before pushing deeper
into PBR or complex lighting:

1. Add Bevy-style mesh and material authoring components.
   - Introduce a mesh handle component named `Mesh`.
   - Introduce a material handle component named `Material`.
   - Keep `Visibility`, `RenderLayer`, `RenderOrder`, `Enabled`, and
     `WorldTransform` as separate filters/inputs.
   - Replace `MeshRenderer`; do not preserve it for backward compatibility in
     this early prototype.

2. Decide the multi-material story explicitly.
   - MVP can use one mesh material component per entity.
   - Multi-material meshes can later use either separate primitive entities or a
     dedicated `MeshMaterialSlots` component.
   - Avoid hiding slot arrays inside the same component that identifies the
     mesh.

3. Add typed asset collection APIs over the registry.
   - `assets.meshes.add(createBoxMesh(...)) -> MeshHandle`
   - `assets.materials.standard.add(createStandardMaterial(...)) ->
MaterialHandle`
   - Preserve the generic registry for manifests, statuses, dependencies, and
     diagnostics.

4. Formalize render asset preparation.
   - Define a `RenderAssetAdapter<TSource, TPrepared>` style contract.
   - Add renderer-owned prepared asset stores for meshes, materials, textures,
     and samplers.
   - Track added/modified/removed asset versions.
   - Make GPU upload/preparation a render-world stage, not example code.

5. Split extraction into named stages.
   - Entity extraction: views, mesh draws, lights, environments, bounds.
   - Asset extraction: changed source assets and dependency readiness.
   - Prepare assets: build or update GPU-ready render assets.
   - Queue: produce draw items from prepared assets and snapshots.
   - Sort: order phase items.
   - Render: encode WebGPU commands.

6. Add a runtime/app facade after the bridge is cleaner.
   - Users should be able to declare ECS state, register assets, add systems,
     and start a frame loop without touching WebGPU plumbing.
   - Headless mode should run simulation and extraction without creating a
     WebGPU device or canvas.

## Required Doc And Roadmap Direction

Docs should be updated to make Bevy the explicit architecture anchor for the
ECS/render bridge:

- `docs/NORTH_STAR.md`: name Bevy as the closest conceptual reference for the
  ECS/render/asset bridge, while preserving Aperture's WebGPU-only and
  snapshot-first constraints.
- `docs/ARCHITECTURE.md`: describe the Bevy-inspired split between main ECS
  authoring data, render extraction, render asset preparation, draw queueing,
  phase sorting, and WebGPU submission.
- `docs/ROADMAP.md`: add a Bevy alignment gate before more PBR/lighting work.
- `docs/DECISIONS.md`: record a decision that Bevy's ECS/render bridge and
  asset/material patterns are the preferred architectural reference.
- `agent/BACKLOG.md`: prioritize the mesh/material component split, typed asset
  collections, and render asset preparation contract before expanding shader
  lighting.

## What Not To Copy

Aperture should not copy Bevy mechanically:

- Do not adopt Rust trait/generic API shapes that feel unnatural in TypeScript.
- Do not give up serializable snapshots, because they are key to worker-mode
  simulation.
- Do not require a render ECS world before the simpler render-world cache proves
  insufficient.
- Do not add broad plugin complexity before a small runtime facade exists.
- Do not implement PBR as a large shader-only slice without the material asset
  and prepare/queue architecture underneath it.

## Near-Term Recommendation

Pause the light shader contract backlog after the current unlit path and do the
bridge alignment first. The next best vertical slice is:

```ts
const mesh = assets.meshes.add(createBoxMesh());
const material = assets.materials.unlit.add(createUnlitMaterial({ color }));

world.spawn((
  LocalTransform.fromTranslation([0, 0, 0]),
  Mesh(mesh),
  Material(material),
));
```

Then extraction should derive the same `RenderSnapshot.meshDraws` data the
renderer already consumes today. That slice proves the Bevy-style authoring API
without rewriting the renderer, and it creates the right foundation for PBR
materials as assets.
