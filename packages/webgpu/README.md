# @aperture-engine/webgpu

The WebGPU rendering backend for the Aperture game engine: it turns a render snapshot into pixels, covering materials, shadows, IBL, post effects, picking, sprites, text, UI, and particles.

## Install

```sh
pnpm add @aperture-engine/webgpu
```

This package is part of the [Aperture](https://github.com/felixtrz/aperture) engine. It consumes `RenderSnapshot` data produced by `@aperture-engine/render` and the simulation/runtime packages, so it is normally used alongside the other `@aperture-engine/*` packages.

## What it does

`@aperture-engine/webgpu` owns the GPU side of a frame. `createWebGpuApp` initializes a WebGPU device for a canvas, wires up a `RenderWorld`, and exposes a `WebGpuApp` that renders `RenderSnapshot`s through a single-encoder frame graph. It implements the standard/unlit/custom-WGSL material pipelines, directional/spot/point shadow atlases, image-based lighting (BRDF LUT, irradiance/specular convolution, equirect-to-cube), MSDF text, UI quads, and a particle pipeline, plus a stack of post effects (tonemap, bloom, depth of field, FXAA/TAA, SSAO, SSR) and GPU picking. The lower-level `initializeWebGpu` / `detectWebGpuSupport` helpers are available when you need to manage the device yourself.

## Usage

```ts
import {
  createWebGpuApp,
  createWebGpuBloomPostEffect,
  createWebGpuTonemapPostEffect,
} from "@aperture-engine/webgpu";

const result = await createWebGpuApp({
  canvas,
  simulationWorker, // drives the ECS and emits RenderSnapshots
  postEffects: [
    createWebGpuBloomPostEffect(),
    createWebGpuTonemapPostEffect({ operator: "aces" }),
  ],
});

if (!result.ok) {
  throw new Error(`WebGPU unavailable: ${result.reason} (${result.message})`);
}

const { app } = result;

// Render a frame from a snapshot.
await app.renderSnapshot(snapshot);

// GPU picking: resolve the entity under a pixel.
const entity = await app.pick(x, y);
```

If you only need a configured device, `initializeWebGpu({ canvas })` returns a discriminated result with the `adapter`, `device`, `context`, and swapchain `format`.

## Entry points

| Subpath                                | Description                                                                                                                                                                                               |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@aperture-engine/webgpu`              | The public backend surface: `createWebGpuApp`/`WebGpuApp`, `initializeWebGpu`/`detectWebGpuSupport`, material, shadow, IBL, text, UI, and particle pipelines, the frame graph, and post-effect factories. |
| `@aperture-engine/webgpu/test-support` | Extra internals (resource caches, diagnostics summaries, parity helpers) used by the engine's tests; not part of the stable API.                                                                          |

## License

Part of the [Aperture monorepo](https://github.com/felixtrz/aperture). MIT licensed.
