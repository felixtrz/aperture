# Generic Material-Family Preparation Handoff Plan - 2026-05-17

## Scope

Plan the handoff from family-specific app-frame material branches toward a
generic material-family preparation contract for unlit, Matcap, and Standard
materials.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/RENDER_ASSET_PREPARATION.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/GENERIC_TEXTURED_STANDARD_PREPARED_ROUTE_AUDIT_2026_05_17.md`
- `packages/webgpu/src/webgpu/prepared-unlit-material-cache.ts`
- `packages/webgpu/src/webgpu/prepared-standard-material-cache.ts`
- `packages/webgpu/src/webgpu/matcap-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/standard-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/unlit-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
- Bevy references:
  `references/bevy/crates/bevy_render/src/render_asset.rs`,
  `references/bevy/crates/bevy_pbr/src/material.rs`, and
  `references/bevy/crates/bevy_pbr/src/mesh_material.rs`.

## Bevy Pattern To Borrow

Bevy keeps source material assets in typed `Assets<M>` collections and exposes
mesh renderability through ECS handle components such as `Mesh3d` and
`MeshMaterial3d<M>`. Rendering then has separate material contracts for bind
group data, shaders, render state, pipeline specialization, extraction,
preparation, queueing, and phase sorting. Bevy's `RenderAsset` path explicitly
separates source assets, extracted changed assets, prepared render-world
resources, and unload handling.

Aperture should borrow that separation, not the Rust trait shape:

```text
source material asset
  -> texture/sampler/source dependency readiness
  -> prepared WebGPU material resources
  -> material-family queue resource key
  -> draw queue item / phase / pipeline key
```

## Current Aperture State

- Unlit and Standard have WebGPU-private prepared material caches.
- Matcap uses extracted app-frame helpers and texture/sampler preparation, but
  does not yet have a prepared material cache equivalent.
- Standard now has scalar and all current texture-family prepared routes for
  covered app shapes.
- Built-in material queue routing exists, but resource preparation still
  branches by family inside app-frame helpers.
- Prepared mesh resources are already shared across unlit, Matcap, and
  Standard app routes.

## Decision

Do not jump straight to a broad material plugin system.

Use a staged contract that first normalizes the prepared material resource
surface for existing built-in families, then moves app-route branching behind a
small material-family preparation adapter table.

Standard's single-texture-family helper and occlusion/emissive multi-family
helper should be consolidated during the first normalization slice, before
generic family routing spreads those details into a shared adapter.

## Target Contract

The first TypeScript contract can stay WebGPU-private:

```ts
interface PreparedBuiltInMaterialUse {
  readonly family: "unlit" | "matcap" | "standard";
  readonly status: "created" | "reused";
  readonly materialResourceKey: string;
  readonly bindGroupResourceKey: string;
  readonly material: unknown;
  readonly bindGroup: unknown;
}

interface BuiltInMaterialPrepareContext {
  readonly device: unknown;
  readonly assets: AssetRegistry;
  readonly sourceMaterialKey: string;
  readonly sourceVersion: number;
  readonly pipelineKey: string;
  readonly materialLayout: unknown;
  readonly textures: PreparedAppTextureSamplerResources;
  readonly caches: WebGpuOwnedMaterialCaches;
}
```

The actual implementation should use stronger family-specific generic types
instead of `unknown`, but the important boundary is the same:

- source asset handles and versions come in;
- prepared texture/sampler resources come in as dependencies;
- material buffer and group-2 bind group resources come out;
- ECS entities, render snapshots, lights, meshes, render passes, and command
  encoders stay outside the material preparation contract.

## Next Slices

1. Consolidate Standard textured prepared helper internals.
   - One helper should accept the set of supported Standard texture fields and
     produce resource metadata for one or many texture bindings.
   - Existing public wrappers can remain for focused tests.

2. Add a Matcap prepared material cache.
   - It should prepare only the Matcap group-2 material bind group from ready
     matcap texture/sampler GPU resources.
   - Texture/sampler resources should stay in the existing app texture/sampler
     cache.

3. Normalize unlit, Matcap, and Standard prepared material use results.
   - Family-specific resource objects can remain internally typed.
   - App frame-resource code should consume a common `status/resource` shape
     for reuse counters.

4. Move built-in material preparation behind an adapter table.
   - The existing queue adapter registry is the right conceptual home.
   - The app route should ask the family adapter to prepare material resources
     rather than branching directly by material texture fields.

5. Audit after the adapter table lands.
   - Check source asset ownership, texture/sampler ownership, group-3 lights,
     JSON-safe diagnostics, and package boundaries.

## Guardrails

- `@aperture-engine/render`, `@aperture-engine/simulation`, and
  the retired umbrella package must not import WebGPU resources.
- `RenderSnapshot` remains the frame boundary. Material preparation may consume
  source asset versions and prepared texture/sampler resources, but not mutate
  ECS or snapshot data.
- Group-3 Standard light resources remain frame-derived and outside material
  cache keys.
- Prepared material caches may own WebGPU buffers, bind groups, logical keys,
  source-version metadata, and dependency key segments only.
- App reports must stay JSON-safe and should continue to distinguish full
  frame-resource cache hits from prepared material reuse.

## Backlog Shape

- Refactor Standard textured prepared helpers into one texture-set
  implementation.
- Add Matcap prepared material cache and direct tests.
- Wire Matcap app frames through the prepared material cache.
- Normalize built-in prepared material use result types.
- Move built-in material preparation selection behind the queue adapter
  registry.
- Audit the generic built-in material preparation adapter boundary.
