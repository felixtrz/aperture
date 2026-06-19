# @aperture-engine/simulation

Headless ECS, assets, math, diagnostics, and transform foundation for the Aperture WebGPU game engine.

## Install

```sh
pnpm add @aperture-engine/simulation
```

This package is part of the [Aperture](https://github.com/felixtrz/aperture) engine. It is the authoritative simulation core and is normally used together with the other `@aperture-engine/*` packages (rendering, platform, etc.).

## What it does

`@aperture-engine/simulation` is the headless, DOM-free heart of Aperture. It wraps the [`elics`](https://www.npmjs.com/package/elics) ECS with change-version tracking and adds the engine's authoritative data model: transform components (local/world matrices, parent/child hierarchy), an asset registry with handles and collections, an in-house WebGPU-first 3D math kernel (zero third-party dependencies; see below), spatial acceleration (BVH), scene/prefab serialization, and diagnostics. Because it has no rendering or browser dependencies, it runs identically on the main thread, in a worker, or in tests.

### Math kernel

The math layer is a zero-dependency, `Float32Array`-native kernel (`src/math/kernel/`) plus a curated, ergonomic wrapper. It targets WebGPU conventions by default (column-major matrices, clip-space depth `0..1`, `[x, y, z, w]` quaternions) and is allocation-free on hot paths via output-parameter ops. It ships fused fast paths tuned for the engine's transform workload — `composeTRS`, `mulAffine`, `invertAffine` — and is benchmarked against `wgpu-matrix` and `gl-matrix` (run `pnpm run bench:math`). On the per-entity transform-propagation workload it is ~1.3× faster than the `wgpu-matrix` backend it replaced, and fastest-or-tied across the core primitives.

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
