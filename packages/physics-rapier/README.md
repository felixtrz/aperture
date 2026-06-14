# @aperture-engine/physics-rapier

Rapier-backed physics backend for the [aperture](https://github.com/felixtrz/aperture) WebGPU game engine.

## Install

```sh
pnpm add @aperture-engine/physics-rapier
```

This package is part of the aperture engine and is normally used together with the other `@aperture-engine/*` packages — in particular `@aperture-engine/physics`, which defines the backend-neutral physics contracts, components, and fixed-step scheduling that this backend plugs into. It bundles `@dimforge/rapier3d-compat` as the underlying simulation library.

## What it does

`@aperture-engine/physics-rapier` provides a same-worker `PhysicsBackend` implementation built on [Rapier](https://rapier.rs/). It consumes the command buffers produced by `@aperture-engine/physics`, drives a Rapier `World` through fixed-step simulation, and writes body transforms and collision events back out. Beyond stepping, it implements the full backend query surface: raycasts, shape overlaps, shape casts, point projection, kinematic character movement, sleep/wake control, and debug-geometry generation.

## Usage

```ts
import { createRapierPhysicsBackend } from "@aperture-engine/physics-rapier";

// Returns a PhysicsBackend (the contract defined in @aperture-engine/physics).
const backend = createRapierPhysicsBackend({
  gravity: [0, -9.81, 0],
});

// Load Rapier's wasm and create the simulation world.
await backend.init();

// Each fixed tick: apply commands, advance the world, read results back.
backend.sync(commandBuffer); // PhysicsCommandBuffer from @aperture-engine/physics
backend.step(1 / 60, fixedStepIndex);
backend.readResults(resultBuffer);

// Queries are available once the world exists, e.g.:
const hit = backend.raycastFirst({ origin: [0, 5, 0], direction: [0, -1, 0] });

backend.dispose();
```

`createRapierPhysicsBackend` accepts `RapierPhysicsBackendOptions` (`gravity`, `execution`, `colliderGeometryProvider`); the same options can also be supplied to `init`.

## Exports

| Subpath                           | Contents                                                                |
| --------------------------------- | ----------------------------------------------------------------------- |
| `@aperture-engine/physics-rapier` | `createRapierPhysicsBackend` and the `RapierPhysicsBackendOptions` type |

## License

Part of the [aperture](https://github.com/felixtrz/aperture) monorepo. MIT licensed.
