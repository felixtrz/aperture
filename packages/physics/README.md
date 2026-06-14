# @aperture-engine/physics

Backend-neutral physics components, fixed-step scheduling, and backend contracts for the Aperture engine.

## Install

```sh
pnpm add @aperture-engine/physics
```

This package is part of the [Aperture](https://github.com/felixtrz/aperture) WebGPU game engine and is normally used together with the other `@aperture-engine/*` packages (it depends on `@aperture-engine/simulation` for the ECS world).

## What it does

`@aperture-engine/physics` provides the engine-agnostic authoring layer for physics: ECS components (rigid bodies, colliders, joints, character controllers, materials), helpers to build their initial data, a deterministic fixed-step clock, and the `PhysicsBackend` contract that a concrete simulation backend (e.g. Rapier) implements. It also drives the ECS-to-backend sync each tick and writes results back onto the world. No physics solver is bundled here — bring a backend, or use the built-in test backend from the `./testing` subpath.

## Usage

```ts
import {
  registerPhysicsComponents,
  RigidBody,
  Collider,
  createRigidBody,
  createCollider,
  createFixedStepClock,
  advanceFixedStepClock,
  createPhysicsWorldSyncState,
  stepPhysicsWorld,
} from "@aperture-engine/physics";
import { createTestPhysicsBackend } from "@aperture-engine/physics/testing";

// Register the physics components on your ECS world.
registerPhysicsComponents(world);

// Author an entity with a dynamic rigid body and a box collider.
const entity = world.createEntity();
world.addComponent(entity, RigidBody, createRigidBody({ type: "dynamic" }));
world.addComponent(
  entity,
  Collider,
  createCollider({ shape: { kind: "box", halfExtents: [0.5, 0.5, 0.5] } }),
);

// Drive the simulation with a deterministic fixed-step clock and a backend.
const clock = createFixedStepClock({ fixedDelta: 1 / 60 });
const state = createPhysicsWorldSyncState();
const backend = createTestPhysicsBackend();

const advance = advanceFixedStepClock(clock, deltaSeconds);
for (let i = 0; i < advance.substeps; i++) {
  stepPhysicsWorld({
    world,
    backend,
    state,
    fixedDelta: clock.fixedDelta,
    fixedStep: clock.fixedStepIndex,
  });
}
```

## Entry points

- `@aperture-engine/physics` — components, authoring helpers, fixed-step clock, ECS sync (`stepPhysicsWorld`), quaternion/vector math, validation, the `PhysicsBackend` contract, and worker transport helpers.
- `@aperture-engine/physics/testing` — `createTestPhysicsBackend`, a pure-TypeScript reference backend useful for tests and headless simulation.

## License

Part of the [Aperture monorepo](https://github.com/felixtrz/aperture). MIT licensed.
