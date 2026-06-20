# @aperture-engine/simulation

Headless ECS, assets, math, diagnostics, and transform foundation for the Aperture WebGPU game engine.

## Install

```sh
pnpm add @aperture-engine/simulation
```

This package is part of the [Aperture](https://github.com/felixtrz/aperture) engine. It is the authoritative simulation core and is normally used together with the other `@aperture-engine/*` packages (rendering, platform, etc.).

## What it does

`@aperture-engine/simulation` is the headless, DOM-free heart of Aperture. It wraps the [`elics`](https://www.npmjs.com/package/elics) ECS with change-version tracking and adds the engine's authoritative data model: transform components (local/world matrices, parent/child hierarchy), an asset registry with handles and collections, spatial acceleration (BVH), scene/prefab serialization, and diagnostics. Because it has no rendering or browser dependencies, it runs identically on the main thread, in a worker, or in tests.

### Math

3D math lives in its own zero-dependency package, [`@aperture-engine/math`](../math) — a `Float32Array`-native, WebGPU-first kernel with fused transform fast paths (`composeTRS`, `mulAffine`, `invertAffine`), benchmarked as the fastest option for the engine's transform workload. For convenience the entire math surface is **re-exported** from `@aperture-engine/simulation`, so existing imports keep working:

```ts
import {
  composeTrsMatrix,
  makePerspective,
  Vec3,
} from "@aperture-engine/simulation";
// …or import it directly:
import { composeTrsMatrix } from "@aperture-engine/math";
```

## Usage

```ts
import {
  createWorld,
  registerTransformComponents,
  LocalTransform,
  createRootTransform,
  resolveWorldTransforms,
} from "@aperture-engine/simulation";

const world = createWorld();
registerTransformComponents(world);

const root = createRootTransform({ translation: [0, 1, 0] });
const entity = world.createEntity();
entity.addComponent(LocalTransform, root.local);

// Derive world matrices from the local transform + parent hierarchy.
const report = resolveWorldTransforms(world);
console.log(report.resolved, report.diagnostics);
```

## Entry points

The package exposes a single entry point; everything is re-exported from the root:

- `@aperture-engine/simulation` — the full public API:
  - **ECS** — `createWorld`, `defineComponent`, `createSystem`, `EcsType`, and ECS types.
  - **Transform** — `LocalTransform` / `WorldTransform` / `Parent` / `Children` components, `registerTransformComponents`, `setParent`, `resolveWorldTransforms`.
  - **Assets** — `AssetRegistry`, asset handles, collections, and animation-clip data.
  - **Math** — vectors, quaternions, `Mat4` helpers, projections, bounds, and rays.
  - **Spatial** — entity-bounds and mesh BVH structures.
  - **Serialization** — scene documents, prefabs, and component codecs.
  - **Diagnostics** — `summarizeDiagnostics` and related types.
  - **Raycaster** — ray/scene intersection utilities.

## License

Part of the [Aperture](https://github.com/felixtrz/aperture) monorepo. MIT licensed.
