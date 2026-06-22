# @aperture-engine/runtime

The umbrella runtime for the Aperture WebGPU game engine: app factories, spawn helpers, and the simulation-worker seam that ties the ECS, render, and physics packages together.

## Install

```sh
pnpm add @aperture-engine/runtime
```

This package is part of the [Aperture](https://github.com/felixtrz/aperture) engine. It re-exports and composes the `@aperture-engine/simulation`, `@aperture-engine/render`, and `@aperture-engine/physics` packages, so it is normally used alongside the other `@aperture-engine/*` packages.

## What it does

`@aperture-engine/runtime` provides a small facade over the Aperture ECS. `createSimulationApp` builds an app with transform, metadata, and runtime components registered and a fixed-step schedule wired up; `createExtractionApp` adds render-authoring components and an `extract()`/`stepAndExtract()` path that produces a `RenderSnapshot` for the renderer. Entities are assembled from composable `with*` initializers (transform, mesh, material, camera, light, physics, UI, audio, animation, and more), and the package also exposes the simulation-worker transport, animation mixing/blending, skinning palettes, and a sample `Spin` component/system.

## Usage

```ts
import {
  createExtractionApp,
  withTransform,
  withMesh,
  withMaterial,
  withCamera,
  withSpin,
} from "@aperture-engine/runtime";

const app = createExtractionApp();

// Spawn an entity from composable initializers.
app.spawn(
  withTransform({ translation: [0, 0, 0] }),
  withMesh(meshHandle),
  withMaterial(materialHandle),
  withSpin({ radiansPerSecond: 1 }),
);

app.spawn(withCamera(), withTransform({ translation: [0, 0, 5] }));

// Advance the simulation and extract a render snapshot for the frame.
const snapshot = app.stepAndExtract(1 / 60, performance.now() / 1000, 0);
```

`createSimulationApp` returns a headless `SimulationApp` (no extraction) if you only need to drive the ECS and fixed-step tasks.

## Entry points

| Subpath                    | Description                                                                                                                                                                                        |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@aperture-engine/runtime` | The full runtime surface: app factories, `with*` spawn helpers, fixed-step schedule, animation mixer/blending, skinning palettes, simulation-worker transport, and re-exported physics components. |

## License

Part of the [Aperture monorepo](https://github.com/felixtrz/aperture). MIT licensed.
