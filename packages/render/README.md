# @aperture-engine/render

Renderer-independent ECS authoring, assets, extraction, and the per-frame `RenderSnapshot` contract for the Aperture engine.

## Install

```sh
pnpm add @aperture-engine/render
```

This package is part of the [Aperture](https://github.com/felixtrz/aperture) WebGPU game engine and is normally used alongside the other `@aperture-engine/*` packages (it depends on `@aperture-engine/simulation` for the ECS world and asset registry).

## What it does

`@aperture-engine/render` defines the authoring side of Aperture's render pipeline without depending on any specific GPU backend. You attach plain ECS components (`Mesh`, `Material`, `Camera`, `Light`, `Sprite`, UI nodes, particle emitters, audio emitters, and more) to entities, then extract a backend-agnostic `RenderSnapshot` for the frame. A separate renderer package consumes that snapshot to issue WebGPU work. The package also bundles glTF/GLB asset loading, KTX2/Draco/Meshopt/HDR decoders, material and mesh contracts, MSDF text atlases, and snapshot encoding/diagnostics.

## Usage

```ts
import { createWorld, AssetRegistry } from "@aperture-engine/simulation";
import {
  registerRenderAuthoringComponents,
  extractRenderSnapshot,
  Camera,
  Mesh,
  Material,
  createCamera,
} from "@aperture-engine/render";

const world = createWorld();
const assets = new AssetRegistry();

// Register the render authoring components on the world.
registerRenderAuthoringComponents(world);

// Author a camera and a mesh entity.
world.createEntity().addComponent(Camera, createCamera());
world
  .createEntity()
  .addComponent(Mesh, { meshId: "my-mesh" })
  .addComponent(Material, { materialId: "my-material" });

// Produce the per-frame RenderSnapshot a renderer can consume.
const snapshot = extractRenderSnapshot(world, assets, { frame: 0 });
```

## Entry points

This package exposes the following subpaths in its `exports` map:

- `@aperture-engine/render` — the full public API (assets, materials, mesh, rendering, text).
- `@aperture-engine/render/test-support` — extra helpers for inspecting snapshots, prepared resources, and the material queue in tests.

## License

Part of the [Aperture monorepo](https://github.com/felixtrz/aperture). MIT licensed.
