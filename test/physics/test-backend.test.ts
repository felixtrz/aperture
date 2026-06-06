import { describe, expect, it } from "vitest";
import {
  Collider,
  ExternalForce,
  ExternalImpulse,
  KinematicTarget,
  PhysicsBodyState,
  PhysicsGravity,
  PhysicsMaterial,
  PhysicsMaterialCombineRule,
  PhysicsJoint,
  PhysicsJointKind,
  PhysicsVelocity,
  PhysicsRigidBodyType,
  RigidBody,
  collectPhysicsCommands,
  createCollider,
  createExternalForce,
  createExternalImpulse,
  createKinematicTarget,
  createPhysicsGravity,
  createPhysicsMaterial,
  createPhysicsJoint,
  createPhysicsResultBuffer,
  createPhysicsVelocity,
  createPhysicsWorldSyncState,
  createRigidBody,
  createUnsupportedJointImpulseReadbackFeature,
  registerPhysicsComponents,
  stepPhysicsWorld,
  summarizePhysicsDebugGeometry,
} from "@aperture-engine/physics";
import { createTestPhysicsBackend } from "@aperture-engine/physics/testing";
import {
  LocalTransform,
  Parent,
  WorldTransform,
  createLocalTransform,
  createParent,
  createRootTransform,
  createWorld,
  serializeEntityRef,
  type EcsWorld,
  type Entity,
} from "@aperture-engine/simulation";

describe("test physics backend", () => {
  it("reports deterministic same-worker capability metadata", () => {
    const backend = createTestPhysicsBackend();

    expect(backend.capabilities).toEqual({
      compoundColliders: true,
      continuousCollisionDetection: false,
      characterController: true,
      linkedBodyContacts: false,
      combinedPositionVelocityMotors: false,
      motorForceLimits: false,
      automaticBreakForce: false,
      jointImpulseReadback: false,
      pairedNonFixedFrameB: false,
    });
  });

  it("summarizes debug geometry into JSON-safe counts and bounds", () => {
    const summary = summarizePhysicsDebugGeometry({
      lines: [
        {
          from: [0, 0, 0],
          to: [1, 2, 3],
          color: [0.2, 0.8, 1, 1],
        },
        {
          from: [-1, 0, 0],
          to: [0, 1, 0],
          color: [0.2, 0.8, 1, 1],
        },
        {
          from: [0, 0, 0],
          to: [0, 0, 1],
          color: [1, 0.2, 0.12, 1],
        },
        {
          from: [Number.NaN, 0, 0],
          to: [0, 0, 0],
          color: [1, 1, 1, 1],
        },
      ],
    });

    expect(summary).toEqual({
      lineCount: 4,
      finiteLineCount: 3,
      invalidLineCount: 1,
      colorCount: 2,
      colors: [
        { color: [0.2, 0.8, 1, 1], lineCount: 2 },
        { color: [1, 0.2, 0.12, 1], lineCount: 1 },
      ],
      bounds: {
        min: [-1, 0, 0],
        max: [1, 2, 3],
      },
    });
  });

  it("reports authored CCD as unsupported on the deterministic backend", () => {
    const backend = createTestPhysicsBackend();

    backend.init();
    const report = backend.sync({
      commands: [
        {
          kind: "upsertBody",
          entity: "fast",
          bodyType: PhysicsRigidBodyType.Dynamic,
          ccdEnabled: true,
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0, 1],
          },
          velocity: {
            linear: [100, 0, 0],
            angular: [0, 0, 0],
          },
          collider: {
            shape: { kind: "sphere", radius: 0.1 },
          },
        },
      ],
    });

    expect(report).toMatchObject({
      unsupportedFeatureCount: 1,
      unsupportedFeatures: [
        {
          code: "physics.rigidBody.ccd.unsupported",
          feature: "rigidBody.ccdEnabled",
          backend: "test",
          entity: "fast",
        },
      ],
    });
  });

  it("reports asset-backed collider shapes as unsupported without syncing fake bounds", () => {
    const backend = createTestPhysicsBackend();

    backend.init();
    const report = backend.sync({
      commands: [
        {
          kind: "upsertBody",
          entity: "mesh-body",
          bodyType: PhysicsRigidBodyType.Static,
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0, 1],
          },
          collider: {
            entity: "mesh-collider",
            shape: { kind: "trimesh", meshId: "mesh:level" },
          },
        },
      ],
    });
    const results = createPhysicsResultBuffer();

    backend.readResults(results);

    expect(report).toMatchObject({
      bodyCount: 0,
      colliderCount: 0,
      unsupportedFeatureCount: 1,
      unsupportedFeatures: [
        {
          code: "physics.collider.assetShape.unsupported",
          feature: "collider.trimesh",
          backend: "test",
          entity: "mesh-collider",
        },
      ],
    });
    expect(results.bodies).toEqual([]);
  });

  it("reports parented bodies without resolved world transforms as unsupported", () => {
    const world = createWorld({ entityCapacity: 3 });
    registerPhysicsComponents(world);
    world.registerComponent(LocalTransform);
    world.registerComponent(Parent);
    const parent = world.createEntity();
    const body = world.createEntity();
    const backend = createTestPhysicsBackend();

    backend.init();
    parent.addComponent(
      LocalTransform,
      createLocalTransform({ translation: [10, 0, 0] }),
    );
    body.addComponent(
      LocalTransform,
      createLocalTransform({ translation: [1, 0, 0] }),
    );
    body.addComponent(Parent, createParent(parent));
    body.addComponent(
      RigidBody,
      createRigidBody({ type: PhysicsRigidBodyType.Dynamic }),
    );
    body.addComponent(Collider, createCollider());

    const bodyRef = serializeEntityRef(body);
    const buffer = collectPhysicsCommands(world);

    expect(buffer.commands).toEqual([
      expect.objectContaining({
        kind: "upsertBody",
        entity: bodyRef,
        parented: true,
      }),
    ]);

    const report = backend.sync(buffer);
    const results = createPhysicsResultBuffer();

    backend.step(1, 1);
    backend.readResults(results);

    expect(report).toMatchObject({
      bodyCount: 0,
      colliderCount: 0,
      unsupportedFeatureCount: 1,
      unsupportedFeatures: [
        {
          code: "physics.rigidBody.parentedBody.unsupported",
          feature: "rigidBody.parentedBody",
          backend: "test",
          entity: bodyRef,
        },
      ],
    });
    expect(results.bodies).toEqual([]);
  });

  it("syncs parented ECS bodies as backend world poses and writes parent-local results", () => {
    const world = createWorld({ entityCapacity: 3 });
    registerPhysicsComponents(world);
    world.registerComponent(LocalTransform);
    world.registerComponent(Parent);
    world.registerComponent(WorldTransform);
    const parent = world.createEntity();
    const body = world.createEntity();
    const backend = createTestPhysicsBackend();
    const state = createPhysicsWorldSyncState();
    const parentRoot = createRootTransform({ translation: [10, 0, 0] });
    const bodyRoot = createRootTransform({ translation: [1, 0, 0] });

    backend.init();
    parent.addComponent(LocalTransform, parentRoot.local);
    parent.addComponent(Parent, parentRoot.parent);
    parent.addComponent(WorldTransform, parentRoot.world);
    body.addComponent(LocalTransform, bodyRoot.local);
    body.addComponent(Parent, createParent(parent));
    body.addComponent(WorldTransform, bodyRoot.world);
    body.addComponent(
      RigidBody,
      createRigidBody({ type: PhysicsRigidBodyType.Dynamic }),
    );
    body.addComponent(Collider, createCollider());
    body.addComponent(
      PhysicsVelocity,
      createPhysicsVelocity({ linear: [1, 0, 0] }),
    );

    const bodyRef = serializeEntityRef(body);
    const report = stepPhysicsWorld({
      world,
      backend,
      state,
      fixedDelta: 1,
      fixedStep: 1,
    });

    expect(report.sync).toMatchObject({
      bodyCount: 1,
      colliderCount: 1,
      unsupportedFeatureCount: 0,
      unsupportedFeatures: [],
    });
    expect(report.writeback).toMatchObject({
      bodyCount: 1,
      transformWrites: 1,
      velocityWrites: 1,
      bodyStateWrites: 1,
      missingEntities: 0,
    });
    expect(
      Array.from(body.getVectorView(LocalTransform, "translation")),
    ).toEqual([2, 0, 0]);
    expect(body.hasComponent(PhysicsBodyState)).toBe(true);
    expect(
      Array.from(body.getVectorView(PhysicsBodyState, "currentTranslation")),
    ).toEqual([12, 0, 0]);
    expect(body.getValue(PhysicsBodyState, "backendBodyId")).toBe(bodyRef);
  });

  it("moves bodies by fixed-step velocity and writes deterministic results", () => {
    const backend = createTestPhysicsBackend();
    backend.init();
    backend.sync({
      commands: [
        {
          kind: "upsertBody",
          entity: "2:0",
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0, 1],
          },
          velocity: {
            linear: [1, 0, 0],
            angular: [0, 0, 0],
          },
        },
      ],
    });

    const report = backend.step(0.5, 7);
    const results = createPhysicsResultBuffer();
    const readback = backend.readResults(results);

    expect(report).toMatchObject({
      backend: "test",
      fixedDelta: 0.5,
      fixedStep: 7,
      bodyCount: 1,
    });
    expect(readback.bodyCount).toBe(1);
    expect(results.bodies[0]?.entity).toBe("2:0");
    expect(results.bodies[0]?.transform.translation).toEqual([0.5, 0, 0]);
  });

  it("applies force and one-shot impulse command data deterministically", () => {
    const backend = createTestPhysicsBackend();
    backend.init();
    backend.sync({
      commands: [
        {
          kind: "upsertBody",
          entity: "2:0",
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0, 1],
          },
          bodyType: PhysicsRigidBodyType.Dynamic,
          velocity: {
            linear: [0, 0, 0],
            angular: [0, 0, 0],
          },
          externalForce: {
            force: [1, 0, 0],
            torque: [0, 0, 0],
          },
          externalImpulse: {
            impulse: [2, 0, 0],
            angularImpulse: [0, 0, 0],
          },
        },
      ],
    });

    backend.step(0.5, 7);
    const results = createPhysicsResultBuffer();
    backend.readResults(results);

    expect(results.bodies[0]?.velocity.linear).toEqual([2.5, 0, 0]);
    expect(results.bodies[0]?.transform.translation).toEqual([1.25, 0, 0]);
  });

  it("honors authored rigid-body axis locks deterministically", () => {
    const backend = createTestPhysicsBackend({ gravity: [0, 1, 0] });
    backend.init();
    backend.sync({
      commands: [
        {
          kind: "upsertBody",
          entity: "locked",
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0, 1],
          },
          bodyType: PhysicsRigidBodyType.Dynamic,
          velocity: {
            linear: [1, 1, 0],
            angular: [0, 1, 1],
          },
          externalForce: {
            force: [1, 1, 0],
            torque: [0, 1, 1],
          },
          externalImpulse: {
            impulse: [1, 1, 0],
            angularImpulse: [0, 1, 1],
          },
          gravityScale: 1,
          lockTranslations: [false, true, false],
          lockRotations: [false, true, false],
        },
      ],
    });

    backend.step(0.5, 1);
    const results = createPhysicsResultBuffer();
    backend.readResults(results);

    expect(results.bodies[0]?.transform.translation).toEqual([1.25, 0, 0]);
    expect(results.bodies[0]?.velocity.linear).toEqual([2.5, 0, 0]);
    expect(results.bodies[0]?.velocity.angular).toEqual([0, 0, 2.5]);
  });

  it("applies authored rigid-body damping after deterministic integration", () => {
    const backend = createTestPhysicsBackend({ gravity: [0, 0, 0] });
    backend.init();
    backend.sync({
      commands: [
        {
          kind: "upsertBody",
          entity: "damped",
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0, 1],
          },
          bodyType: PhysicsRigidBodyType.Dynamic,
          velocity: {
            linear: [1, 0, 0],
            angular: [0, 2, 0],
          },
          linearDamping: 1,
          angularDamping: 3,
        },
      ],
    });

    backend.step(1, 1);
    const results = createPhysicsResultBuffer();
    backend.readResults(results);

    expect(results.bodies[0]?.transform.translation).toEqual([1, 0, 0]);
    expect(results.bodies[0]?.velocity.linear).toEqual([0.5, 0, 0]);
    expect(results.bodies[0]?.velocity.angular).toEqual([0, 0.5, 0]);
  });

  it("integrates angular velocity into deterministic body rotation", () => {
    const backend = createTestPhysicsBackend({ gravity: [0, 0, 0] });
    backend.init();
    backend.sync({
      commands: [
        {
          kind: "upsertBody",
          entity: "spinner",
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0, 1],
          },
          bodyType: PhysicsRigidBodyType.Dynamic,
          velocity: {
            linear: [0, 0, 0],
            angular: [0, 0, Math.PI],
          },
          canSleep: false,
        },
      ],
    });

    backend.step(0.5, 1);
    const results = createPhysicsResultBuffer();
    backend.readResults(results);

    expect(results.bodies[0]?.transform.rotation).toEqual([
      0,
      0,
      expect.closeTo(Math.SQRT1_2, 6),
      expect.closeTo(Math.SQRT1_2, 6),
    ]);
  });

  it("honors authored rotation locks during deterministic angular integration", () => {
    const backend = createTestPhysicsBackend({ gravity: [0, 0, 0] });
    backend.init();
    backend.sync({
      commands: [
        {
          kind: "upsertBody",
          entity: "locked-spinner",
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0, 1],
          },
          bodyType: PhysicsRigidBodyType.Dynamic,
          velocity: {
            linear: [0, 0, 0],
            angular: [0, 0, Math.PI],
          },
          canSleep: false,
          lockRotations: [false, false, true],
        },
      ],
    });

    backend.step(0.5, 1);
    const results = createPhysicsResultBuffer();
    backend.readResults(results);

    expect(results.bodies[0]?.transform.rotation).toEqual([0, 0, 0, 1]);
    expect(results.bodies[0]?.velocity.angular).toEqual([0, 0, 0]);
  });

  it("masks direct setVelocity commands on authored locked axes", () => {
    const backend = createTestPhysicsBackend({ gravity: [0, 0, 0] });
    backend.init();
    backend.sync({
      commands: [
        {
          kind: "upsertBody",
          entity: "locked",
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0, 1],
          },
          bodyType: PhysicsRigidBodyType.Dynamic,
          velocity: {
            linear: [0, 0, 0],
            angular: [0, 0, 0],
          },
          lockTranslations: [false, true, false],
          lockRotations: [false, false, true],
        },
        {
          kind: "setVelocity",
          entity: "locked",
          velocity: {
            linear: [1, 1, 0],
            angular: [0, 0, 1],
          },
        },
      ],
    });

    backend.step(1, 1);
    const results = createPhysicsResultBuffer();
    backend.readResults(results);

    expect(results.bodies[0]?.velocity.linear).toEqual([1, 0, 0]);
    expect(results.bodies[0]?.velocity.angular).toEqual([0, 0, 0]);
    expect(results.bodies[0]?.transform.translation).toEqual([1, 0, 0]);
    expect(results.bodies[0]?.transform.rotation).toEqual([0, 0, 0, 1]);
  });

  it("integrates velocity-based kinematic bodies deterministically", () => {
    const backend = createTestPhysicsBackend({ gravity: [0, 10, 0] });
    backend.init();
    backend.sync({
      commands: [
        {
          kind: "upsertBody",
          entity: "kinematic",
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0, 1],
          },
          bodyType: PhysicsRigidBodyType.KinematicVelocity,
          velocity: {
            linear: [2, 1, 0],
            angular: [0, 0, 0],
          },
          lockTranslations: [false, true, false],
        },
      ],
    });

    backend.step(0.5, 1);
    const results = createPhysicsResultBuffer();
    backend.readResults(results);

    expect(results.bodies[0]?.transform.translation).toEqual([1, 0, 0]);
    expect(results.bodies[0]?.velocity.linear).toEqual([2, 0, 0]);
  });

  it("honors authored canSleep false for still dynamic bodies", () => {
    const backend = createTestPhysicsBackend({ gravity: [0, 0, 0] });
    backend.init();
    backend.sync({
      commands: [
        {
          kind: "upsertBody",
          entity: "awake",
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0, 1],
          },
          bodyType: PhysicsRigidBodyType.Dynamic,
          velocity: {
            linear: [0, 0, 0],
            angular: [0, 0, 0],
          },
          canSleep: false,
        },
      ],
    });

    backend.step(1, 1);
    const results = createPhysicsResultBuffer();
    backend.readResults(results);

    expect(results.bodies[0]?.sleeping).toBe(false);
  });

  it("supports explicit body sleep and wake controls", () => {
    const backend = createTestPhysicsBackend({ gravity: [0, 0, 0] });
    backend.init();
    backend.sync({
      commands: [
        {
          kind: "upsertBody",
          entity: "sleepy",
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0, 1],
          },
          bodyType: PhysicsRigidBodyType.Dynamic,
          velocity: {
            linear: [0, 0, 0],
            angular: [0, 0, 0],
          },
        },
      ],
    });

    backend.step(1, 1);
    let results = createPhysicsResultBuffer();
    backend.readResults(results);

    expect(results.bodies[0]?.sleeping).toBe(true);
    expect(backend.wakeBody?.("sleepy")).toBe(true);

    backend.step(1, 2);
    results = createPhysicsResultBuffer();
    backend.readResults(results);

    expect(results.bodies[0]?.sleeping).toBe(false);
    expect(backend.sleepBody?.("sleepy")).toBe(true);

    backend.step(1, 3);
    results = createPhysicsResultBuffer();
    backend.readResults(results);

    expect(results.bodies[0]?.sleeping).toBe(true);
    expect(backend.sleepBody?.("missing")).toBe(false);
    expect(backend.wakeBody?.("missing")).toBe(false);
  });

  it("syncs ECS force and consumes ECS impulse at the fixed-step boundary", () => {
    const world = createWorld({ entityCapacity: 2 });
    registerPhysicsComponents(world);
    world.registerComponent(LocalTransform);
    const backend = createTestPhysicsBackend();
    const state = createPhysicsWorldSyncState();
    const body = world.createEntity();

    backend.init();
    body.addComponent(LocalTransform, createLocalTransform());
    body.addComponent(
      RigidBody,
      createRigidBody({ type: PhysicsRigidBodyType.Dynamic }),
    );
    body.addComponent(Collider, createCollider());
    body.addComponent(PhysicsVelocity, createPhysicsVelocity());
    body.addComponent(ExternalForce, createExternalForce({ force: [1, 0, 0] }));
    body.addComponent(
      ExternalImpulse,
      createExternalImpulse({ impulse: [2, 0, 0] }),
    );

    const report = stepPhysicsWorld({
      world,
      backend,
      state,
      fixedDelta: 0.5,
      fixedStep: 1,
    });

    expect(report.writeback.velocityWrites).toBe(1);
    expect(Array.from(body.getVectorView(PhysicsVelocity, "linear"))).toEqual([
      2.5, 0, 0,
    ]);
    expect(Array.from(body.getVectorView(ExternalImpulse, "impulse"))).toEqual([
      0, 0, 0,
    ]);
  });

  it("syncs ECS physics material authoring into collider descriptors", () => {
    const world = createWorld({ entityCapacity: 2 });
    registerPhysicsComponents(world);
    world.registerComponent(LocalTransform);
    const body = world.createEntity();

    body.addComponent(LocalTransform, createLocalTransform());
    body.addComponent(
      RigidBody,
      createRigidBody({ type: PhysicsRigidBodyType.Dynamic }),
    );
    body.addComponent(
      Collider,
      createCollider({
        friction: 0.1,
        restitution: 0.2,
        density: 0.3,
      }),
    );
    body.addComponent(
      PhysicsMaterial,
      createPhysicsMaterial({
        friction: 0.8,
        restitution: 0.6,
        density: 2,
        frictionCombine: PhysicsMaterialCombineRule.Max,
        restitutionCombine: PhysicsMaterialCombineRule.Multiply,
      }),
    );

    expect(collectPhysicsCommands(world).commands[0]).toMatchObject({
      kind: "upsertBody",
      collider: expect.objectContaining({
        friction: expect.closeTo(0.8, 6),
        restitution: expect.closeTo(0.6, 6),
        density: 2,
        frictionCombine: PhysicsMaterialCombineRule.Max,
        restitutionCombine: PhysicsMaterialCombineRule.Multiply,
      }),
    });
  });

  it("syncs child collider entities as body-local compound collider offsets", () => {
    const world = createWorld({ entityCapacity: 4 });
    registerPhysicsComponents(world);
    world.registerComponent(LocalTransform);
    world.registerComponent(Parent);
    const backend = createTestPhysicsBackend();
    const state = createPhysicsWorldSyncState();
    const body = world.createEntity();
    const firstChildCollider = world.createEntity();
    const secondChildCollider = world.createEntity();

    backend.init();
    body.addComponent(LocalTransform, createLocalTransform());
    body.addComponent(
      RigidBody,
      createRigidBody({ type: PhysicsRigidBodyType.Static }),
    );
    firstChildCollider.addComponent(
      LocalTransform,
      createLocalTransform({ translation: [1, 0, 0] }),
    );
    firstChildCollider.addComponent(Parent, createParent(body));
    firstChildCollider.addComponent(
      Collider,
      createCollider({
        shape: { kind: "sphere", radius: 0.25 },
        offsetTranslation: [0.25, 0, 0],
      }),
    );
    secondChildCollider.addComponent(
      LocalTransform,
      createLocalTransform({ translation: [2, 0, 0] }),
    );
    secondChildCollider.addComponent(Parent, createParent(body));
    secondChildCollider.addComponent(
      Collider,
      createCollider({
        shape: { kind: "sphere", radius: 0.25 },
        offsetTranslation: [0.25, 0, 0],
      }),
    );

    const bodyRef = serializeEntityRef(body);
    const firstColliderRef = serializeEntityRef(firstChildCollider);
    const secondColliderRef = serializeEntityRef(secondChildCollider);

    expect(collectPhysicsCommands(world).commands).toEqual([
      expect.objectContaining({
        kind: "upsertBody",
        entity: bodyRef,
        collider: expect.objectContaining({
          entity: firstColliderRef,
          shape: { kind: "sphere", radius: 0.25 },
          offsetTranslation: [1.25, 0, 0],
        }),
        colliders: [
          expect.objectContaining({
            entity: firstColliderRef,
            offsetTranslation: [1.25, 0, 0],
          }),
          expect.objectContaining({
            entity: secondColliderRef,
            offsetTranslation: [2.25, 0, 0],
          }),
        ],
      }),
    ]);

    const report = stepPhysicsWorld({
      world,
      backend,
      state,
      fixedDelta: 1 / 60,
      fixedStep: 1,
    });
    const hits = backend.raycastAll({
      origin: [0, 0, 0],
      direction: [1, 0, 0],
      maxDistance: 3,
    });

    expect(report.sync).toMatchObject({ bodyCount: 1, colliderCount: 2 });
    expect(report.writeback).toMatchObject({
      bodyCount: 1,
      transformWrites: 1,
      missingEntities: 0,
    });
    expect(hits).toHaveLength(2);
    expect(hits[0]).toMatchObject({
      entity: bodyRef,
      collider: firstColliderRef,
      distance: expect.closeTo(1, 6),
      point: [1, 0, 0],
      normal: [-1, 0, 0],
    });
    expect(hits[1]).toMatchObject({
      entity: bodyRef,
      collider: secondColliderRef,
      distance: expect.closeTo(2, 6),
      point: [2, 0, 0],
      normal: [-1, 0, 0],
    });
    expect(body.hasComponent(PhysicsBodyState)).toBe(true);
    expect(firstChildCollider.hasComponent(PhysicsBodyState)).toBe(false);
    expect(secondChildCollider.hasComponent(PhysicsBodyState)).toBe(false);
  });

  it("syncs ECS-authored gravity into fixed-step backend commands", () => {
    const world = createWorld({ entityCapacity: 3 });
    registerPhysicsComponents(world);
    world.registerComponent(LocalTransform);
    const gravity = world.createEntity();
    const body = world.createEntity();

    gravity.addComponent(
      PhysicsGravity,
      createPhysicsGravity({ gravity: [0, -2, 0] }),
    );
    body.addComponent(LocalTransform, createLocalTransform());
    body.addComponent(
      RigidBody,
      createRigidBody({ type: PhysicsRigidBodyType.Dynamic }),
    );
    body.addComponent(Collider, createCollider());
    body.addComponent(PhysicsVelocity, createPhysicsVelocity());

    expect(collectPhysicsCommands(world).commands[0]).toEqual({
      kind: "setGravity",
      gravity: [0, -2, 0],
    });

    const backend = createTestPhysicsBackend();
    const state = createPhysicsWorldSyncState();
    backend.init();

    stepPhysicsWorld({
      world,
      backend,
      state,
      fixedDelta: 0.5,
      fixedStep: 1,
    });

    expect(Array.from(body.getVectorView(PhysicsVelocity, "linear"))).toEqual([
      0, -1, 0,
    ]);
    expect(
      Array.from(body.getVectorView(LocalTransform, "translation")),
    ).toEqual([0, -0.5, 0]);
  });

  it("syncs ECS-authored kinematic targets into fixed-step writeback", () => {
    const world = createWorld({ entityCapacity: 2 });
    registerPhysicsComponents(world);
    world.registerComponent(LocalTransform);
    const backend = createTestPhysicsBackend();
    const state = createPhysicsWorldSyncState();
    const body = world.createEntity();

    backend.init();
    body.addComponent(LocalTransform, createLocalTransform());
    body.addComponent(
      RigidBody,
      createRigidBody({ type: PhysicsRigidBodyType.KinematicPosition }),
    );
    body.addComponent(Collider, createCollider());
    body.addComponent(
      KinematicTarget,
      createKinematicTarget({ translation: [2, 0, 0] }),
    );

    const report = stepPhysicsWorld({
      world,
      backend,
      state,
      fixedDelta: 1 / 60,
      fixedStep: 1,
    });

    expect(report.writeback.transformWrites).toBe(1);
    expect(report.writeback.bodyStateWrites).toBe(1);
    expect(
      Array.from(body.getVectorView(LocalTransform, "translation")),
    ).toEqual([2, 0, 0]);
  });

  it("emits trigger events and answers synchronous raycasts", () => {
    const backend = createTestPhysicsBackend();
    backend.init();
    backend.sync({
      commands: [
        {
          kind: "upsertBody",
          entity: "1:0",
          transform: {
            translation: [2, 0, 0],
            rotation: [0, 0, 0, 1],
          },
          radius: 0.5,
        },
        { kind: "emitTrigger", entityA: "1:0", entityB: "2:0" },
      ],
    });

    backend.step(1 / 60, 3);
    const results = createPhysicsResultBuffer();
    backend.readResults(results);

    expect(results.events).toEqual([
      expect.objectContaining({
        kind: "triggerEnter",
        fixedStep: 3,
        entityA: "1:0",
        entityB: "2:0",
      }),
    ]);

    const hit = backend.raycastFirst({
      origin: [0, 0, 0],
      direction: [1, 0, 0],
      maxDistance: 10,
    });

    expect(hit).toMatchObject({
      entity: "1:0",
      distance: 1.5,
      point: [1.5, 0, 0],
      normal: [-1, 0, 0],
    });
  });

  it("applies sensor and collision-group filters to deterministic queries", () => {
    const backend = createTestPhysicsBackend();
    const groupA = 0x00010001;
    const groupB = 0x00020002;
    const ray = {
      origin: [0, 0, 0] as const,
      direction: [1, 0, 0] as const,
      maxDistance: 10,
    };

    backend.init();
    backend.sync({
      commands: [
        {
          kind: "upsertBody",
          entity: "sensor-a",
          transform: {
            translation: [2, 0, 0],
            rotation: [0, 0, 0, 1],
          },
          collider: {
            shape: { kind: "sphere", radius: 0.5 },
            sensor: true,
            collisionGroups: groupA,
          },
        },
        {
          kind: "upsertBody",
          entity: "solid-a",
          transform: {
            translation: [4, 0, 0],
            rotation: [0, 0, 0, 1],
          },
          collider: {
            shape: { kind: "sphere", radius: 0.5 },
            collisionGroups: groupA,
          },
        },
        {
          kind: "upsertBody",
          entity: "solid-b",
          transform: {
            translation: [6, 0, 0],
            rotation: [0, 0, 0, 1],
          },
          collider: {
            shape: { kind: "sphere", radius: 0.5 },
            collisionGroups: groupB,
          },
        },
      ],
    });

    expect(backend.raycastAll(ray).map((hit) => hit.entity)).toEqual([
      "solid-a",
      "solid-b",
    ]);
    expect(
      backend
        .raycastAll(ray, { includeSensors: true })
        .map((hit) => hit.entity),
    ).toEqual(["sensor-a", "solid-a", "solid-b"]);
    expect(
      backend
        .raycastAll(ray, { collisionGroups: groupA })
        .map((hit) => hit.entity),
    ).toEqual(["solid-a"]);
    expect(
      backend
        .raycastAll(ray, { collisionGroups: groupA, includeSensors: true })
        .map((hit) => hit.entity),
    ).toEqual(["sensor-a", "solid-a"]);

    expect(
      backend.overlapShape?.(
        { kind: "sphere", radius: 0.6 },
        { translation: [2, 0, 0], rotation: [0, 0, 0, 1] },
      ),
    ).toEqual([]);
    expect(
      backend.overlapShape?.(
        { kind: "sphere", radius: 0.6 },
        { translation: [2, 0, 0], rotation: [0, 0, 0, 1] },
        { includeSensors: true },
      ),
    ).toEqual([{ entity: "sensor-a", collider: "sensor-a" }]);

    expect(
      backend.castShapeFirst?.(
        { kind: "sphere", radius: 0.25 },
        {
          from: { translation: [0, 0, 0], rotation: [0, 0, 0, 1] },
          to: { translation: [5, 0, 0], rotation: [0, 0, 0, 1] },
        },
      ),
    ).toMatchObject({ entity: "solid-a" });
    expect(
      backend.castShapeFirst?.(
        { kind: "sphere", radius: 0.25 },
        {
          from: { translation: [0, 0, 0], rotation: [0, 0, 0, 1] },
          to: { translation: [5, 0, 0], rotation: [0, 0, 0, 1] },
        },
        { includeSensors: true },
      ),
    ).toMatchObject({ entity: "sensor-a" });

    expect(backend.projectPoint?.([2.2, 0, 0])).toMatchObject({
      entity: "solid-a",
    });
    expect(
      backend.projectPoint?.([2.2, 0, 0], { includeSensors: true }),
    ).toMatchObject({ entity: "sensor-a" });
    expect(
      backend.projectPoint?.([4.2, 0, 0], { collisionGroups: groupB }),
    ).toMatchObject({ entity: "solid-b" });

    backend.sync({
      commands: [
        {
          kind: "upsertBody",
          entity: "character",
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0, 1],
          },
          collider: {
            shape: { kind: "sphere", radius: 0.5 },
          },
        },
      ],
    });

    expect(
      backend.moveCharacter?.({
        entity: "character",
        desiredTranslation: [3, 0, 0],
      }),
    ).toMatchObject({
      collisions: [expect.objectContaining({ entity: "solid-a" })],
    });
    backend.sync({
      commands: [
        {
          kind: "upsertBody",
          entity: "character",
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0, 1],
          },
          collider: {
            shape: { kind: "sphere", radius: 0.5 },
          },
        },
      ],
    });
    expect(
      backend.moveCharacter?.({
        entity: "character",
        desiredTranslation: [3, 0, 0],
        options: { includeSensors: true },
      }),
    ).toMatchObject({
      collisions: [expect.objectContaining({ entity: "sensor-a" })],
    });
    backend.sync({
      commands: [
        {
          kind: "upsertBody",
          entity: "character",
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0, 1],
          },
          collider: {
            shape: { kind: "sphere", radius: 0.5 },
          },
        },
      ],
    });
    expect(
      backend.moveCharacter?.({
        entity: "character",
        desiredTranslation: [7, 0, 0],
        options: { collisionGroups: groupB },
      }),
    ).toMatchObject({
      collisions: [expect.objectContaining({ entity: "solid-b" })],
    });
  });

  it("uses primitive collider dimensions for deterministic query bounds", () => {
    const backend = createTestPhysicsBackend();
    const cylinderBoundsRadius = Math.hypot(1.25, 2);

    backend.init();
    backend.sync({
      commands: [
        {
          kind: "upsertBody",
          entity: "cylinder",
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0, 1],
          },
          collider: {
            shape: {
              kind: "cylinder",
              radius: 1.25,
              halfHeight: 2,
            },
          },
        },
      ],
    });

    const hit = backend.raycastFirst({
      origin: [-4, 0, 0],
      direction: [1, 0, 0],
      maxDistance: 10,
    });

    expect(hit).toMatchObject({
      entity: "cylinder",
      distance: expect.closeTo(4 - cylinderBoundsRadius, 6),
      normal: [-1, 0, 0],
    });
    expect(
      backend.overlapShape?.(
        { kind: "sphere", radius: 0.25 },
        {
          translation: [cylinderBoundsRadius + 0.2, 0, 0],
          rotation: [0, 0, 0, 1],
        },
      ),
    ).toEqual([{ entity: "cylinder", collider: "cylinder" }]);
    expect(backend.projectPoint?.([4, 0, 0])).toMatchObject({
      entity: "cylinder",
      point: [cylinderBoundsRadius, 0, 0],
      normal: [1, 0, 0],
      distance: expect.closeTo(4 - cylinderBoundsRadius, 6),
    });
  });

  it("uses collider offsets for deterministic query bounds", () => {
    const backend = createTestPhysicsBackend();

    backend.init();
    backend.sync({
      commands: [
        {
          kind: "upsertBody",
          entity: "offset",
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0, 1],
          },
          collider: {
            shape: { kind: "sphere", radius: 0.5 },
            offsetTranslation: [2, 0, 0],
          },
        },
      ],
    });

    expect(
      backend.raycastFirst({
        origin: [0, 0, 0],
        direction: [1, 0, 0],
        maxDistance: 10,
      }),
    ).toMatchObject({
      entity: "offset",
      distance: expect.closeTo(1.5, 6),
      point: [1.5, 0, 0],
      normal: [-1, 0, 0],
    });
    expect(
      backend.overlapShape?.(
        { kind: "sphere", radius: 0.25 },
        {
          translation: [2.7, 0, 0],
          rotation: [0, 0, 0, 1],
        },
      ),
    ).toEqual([{ entity: "offset", collider: "offset" }]);
    expect(backend.projectPoint?.([3, 0, 0])).toMatchObject({
      entity: "offset",
      point: [2.5, 0, 0],
      normal: [1, 0, 0],
      distance: expect.closeTo(0.5, 6),
    });
    expect(
      backend.debugGeometry?.({ colliderWireframes: true }).lines[0],
    ).toEqual({
      from: [1.5, 0, 0],
      to: [2.5, 0, 0],
      color: [0.2, 0.8, 1, 1],
    });
    expect(backend.debugGeometry?.({ broadphaseAabbs: true }).lines[0]).toEqual(
      {
        from: [1.5, -0.5, -0.5],
        to: [2.5, -0.5, -0.5],
        color: [0.95, 0.65, 0.15, 1],
      },
    );
  });

  it("answers deterministic shape casts and point projections", () => {
    const backend = createTestPhysicsBackend();
    backend.init();
    backend.sync({
      commands: [
        {
          kind: "upsertBody",
          entity: "2:0",
          transform: {
            translation: [4, 0, 0],
            rotation: [0, 0, 0, 1],
          },
          radius: 0.5,
        },
        {
          kind: "upsertBody",
          entity: "1:0",
          transform: {
            translation: [2, 0, 0],
            rotation: [0, 0, 0, 1],
          },
          radius: 0.5,
        },
      ],
    });

    const hit = backend.castShapeFirst?.(
      { kind: "sphere", radius: 0.25 },
      {
        from: {
          translation: [0, 0, 0],
          rotation: [0, 0, 0, 1],
        },
        to: {
          translation: [5, 0, 0],
          rotation: [0, 0, 0, 1],
        },
      },
    );

    expect(hit).toMatchObject({
      entity: "1:0",
      point: [1.5, 0, 0],
      normal: [-1, 0, 0],
    });
    expect(hit?.timeOfImpact).toBeCloseTo(1.25 / 5, 6);
    expect(
      backend.castShapeFirst?.(
        { kind: "sphere", radius: 0.25 },
        {
          from: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0, 1],
          },
          to: {
            translation: [5, 0, 0],
            rotation: [0, 0, 0, 1],
          },
        },
        { excludeEntity: "1:0" },
      ),
    ).toMatchObject({
      entity: "2:0",
    });

    const projection = backend.projectPoint?.([2.8, 0, 0]);

    expect(projection).toMatchObject({
      entity: "1:0",
      point: [2.5, 0, 0],
      normal: [1, 0, 0],
      inside: false,
    });
    expect(projection?.distance).toBeCloseTo(0.3, 6);
    expect(
      backend.projectPoint?.([2.8, 0, 0], { excludeEntity: "1:0" }),
    ).toMatchObject({
      entity: "2:0",
    });
  });

  it("tracks joint lifecycle through backend commands", () => {
    const backend = createTestPhysicsBackend();
    backend.init();

    expect(
      backend.sync({
        commands: [
          {
            kind: "upsertJoint",
            entity: "joint:0",
            joint: {
              kind: "distance",
              bodyARef: "1:0",
              bodyBRef: "2:0",
              anchorA: [0, 0, 0],
              anchorB: [0, 0, 0],
              axis: [0, 1, 0],
              maxLimit: 2,
            },
          },
        ],
      }).jointCount,
    ).toBe(0);
    expect(
      backend.sync({
        commands: [
          {
            kind: "upsertBody",
            entity: "1:0",
            transform: {
              translation: [0, 0, 0],
              rotation: [0, 0, 0, 1],
            },
          },
          {
            kind: "upsertBody",
            entity: "2:0",
            transform: {
              translation: [2, 0, 0],
              rotation: [0, 0, 0, 1],
            },
          },
          {
            kind: "upsertJoint",
            entity: "joint:0",
            joint: {
              kind: "distance",
              bodyARef: "1:0",
              bodyBRef: "2:0",
              anchorA: [0, 0, 0],
              anchorB: [0, 0, 0],
              axis: [0, 1, 0],
              maxLimit: 2,
            },
          },
        ],
      }).jointCount,
    ).toBe(1);
    expect(backend.step(1 / 60, 1)).toMatchObject({
      jointCount: 1,
    });
    expect(backend.debugGeometry?.({ jointFrames: true }).lines).toEqual([
      {
        from: [0, 0, 0],
        to: [2, 0, 0],
        color: [0.9, 0.45, 1, 1],
      },
      {
        from: [0, 0, 0],
        to: [0, 0.4, 0],
        color: [0.2, 0.95, 1, 1],
      },
    ]);
    expect(
      backend.sync({
        commands: [{ kind: "destroyJoint", entity: "joint:0" }],
      }).jointCount,
    ).toBe(0);
  });

  it("reports authored joint breakForce as unsupported instead of silently enforcing it", () => {
    const backend = createTestPhysicsBackend();
    backend.init();

    const report = backend.sync({
      commands: [
        {
          kind: "upsertBody",
          entity: "1:0",
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0, 1],
          },
        },
        {
          kind: "upsertBody",
          entity: "2:0",
          transform: {
            translation: [2, 0, 0],
            rotation: [0, 0, 0, 1],
          },
        },
        {
          kind: "upsertJoint",
          entity: "joint:0",
          joint: {
            kind: "distance",
            bodyARef: "1:0",
            bodyBRef: "2:0",
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axis: [0, 1, 0],
            maxLimit: 2,
            breakForce: 12,
          },
        },
      ],
    });

    expect(report).toMatchObject({
      jointCount: 1,
      unsupportedFeatureCount: 1,
      unsupportedFeatures: [
        {
          code: "physics.joint.breakForce.unsupported",
          feature: "joint.breakForce",
          backend: "test",
          entity: "joint:0",
          value: 12,
        },
      ],
    });
  });

  it("reports generic joints as unsupported and removes stale deterministic joints", () => {
    const backend = createTestPhysicsBackend();
    backend.init();

    expect(
      backend.sync({
        commands: [
          {
            kind: "upsertBody",
            entity: "1:0",
            transform: {
              translation: [0, 0, 0],
              rotation: [0, 0, 0, 1],
            },
          },
          {
            kind: "upsertBody",
            entity: "2:0",
            transform: {
              translation: [2, 0, 0],
              rotation: [0, 0, 0, 1],
            },
          },
          {
            kind: "upsertJoint",
            entity: "joint:0",
            joint: {
              kind: "distance",
              bodyARef: "1:0",
              bodyBRef: "2:0",
              anchorA: [0, 0, 0],
              anchorB: [0, 0, 0],
              axis: [0, 1, 0],
              maxLimit: 2,
            },
          },
        ],
      }).jointCount,
    ).toBe(1);

    const report = backend.sync({
      commands: [
        {
          kind: "upsertJoint",
          entity: "joint:0",
          joint: {
            kind: "generic",
            bodyARef: "1:0",
            bodyBRef: "2:0",
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axis: [0, 1, 0],
          },
        },
      ],
    });

    expect(report).toMatchObject({
      jointCount: 0,
      unsupportedFeatureCount: 1,
      unsupportedFeatures: [
        {
          code: "physics.joint.unsupported",
          feature: "joint.generic",
          backend: "test",
          entity: "joint:0",
        },
      ],
    });
  });

  it("reports authored joint motorMaxForce as unsupported instead of silently enforcing it", () => {
    const backend = createTestPhysicsBackend();
    backend.init();

    const report = backend.sync({
      commands: [
        {
          kind: "upsertBody",
          entity: "1:0",
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0, 1],
          },
        },
        {
          kind: "upsertBody",
          entity: "2:0",
          transform: {
            translation: [2, 0, 0],
            rotation: [0, 0, 0, 1],
          },
        },
        {
          kind: "upsertJoint",
          entity: "joint:0",
          joint: {
            kind: "prismatic",
            bodyARef: "1:0",
            bodyBRef: "2:0",
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axis: [1, 0, 0],
            motorMode: "velocity",
            motorVelocity: 1,
            motorFactor: 2,
            motorMaxForce: 5,
          },
        },
      ],
    });

    expect(report).toMatchObject({
      jointCount: 1,
      unsupportedFeatureCount: 1,
      unsupportedFeatures: [
        {
          code: "physics.joint.motorMaxForce.unsupported",
          feature: "joint.motorMaxForce",
          backend: "test",
          entity: "joint:0",
          value: 5,
        },
      ],
    });
  });

  it("creates structured joint impulse-readback unsupported features", () => {
    expect(
      createUnsupportedJointImpulseReadbackFeature("test", "joint:0"),
    ).toEqual({
      code: "physics.joint.impulseReadback.unsupported",
      feature: "joint.impulseReadback",
      backend: "test",
      entity: "joint:0",
      message:
        "The active physics route does not expose native joint impulse readback, so automatic breakForce thresholds cannot be enforced truthfully.",
      suggestedFix:
        "Use explicit gameplay-owned joint breaks for now, or add backend-native joint impulse readback before enforcing automatic breakForce thresholds.",
    });
  });

  it("reports authored non-fixed joint frameB as unsupported", () => {
    const backend = createTestPhysicsBackend();
    backend.init();

    const report = backend.sync({
      commands: [
        {
          kind: "upsertBody",
          entity: "1:0",
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0, 1],
          },
        },
        {
          kind: "upsertBody",
          entity: "2:0",
          transform: {
            translation: [2, 0, 0],
            rotation: [0, 0, 0, 1],
          },
        },
        {
          kind: "upsertJoint",
          entity: "joint:0",
          joint: {
            kind: "prismatic",
            bodyARef: "1:0",
            bodyBRef: "2:0",
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axis: [0, 1, 0],
            frameB: [0, 0, 0.70710677, 0.70710677],
          },
        },
      ],
    });

    expect(report).toMatchObject({
      jointCount: 1,
      unsupportedFeatureCount: 1,
      unsupportedFeatures: [
        {
          code: "physics.joint.frameB.unsupported",
          feature: "joint.frameB",
          backend: "test",
          entity: "joint:0",
        },
      ],
    });
  });

  it("removes disabled ECS-authored bodies and joints from sync state", () => {
    const world = createWorld({ entityCapacity: 4 });
    registerPhysicsComponents(world);
    world.registerComponent(LocalTransform);
    const backend = createTestPhysicsBackend();
    const state = createPhysicsWorldSyncState();

    backend.init();

    const anchor = spawnPhysicsBody(
      world,
      [0, 0, 0],
      PhysicsRigidBodyType.Static,
    );
    const bob = spawnPhysicsBody(
      world,
      [2, 0, 0],
      PhysicsRigidBodyType.Dynamic,
    );
    const joint = world.createEntity();

    joint.addComponent(
      PhysicsJoint,
      createPhysicsJoint({
        kind: PhysicsJointKind.Distance,
        bodyARef: serializeEntityRef(anchor),
        bodyBRef: serializeEntityRef(bob),
        maxLimit: 2,
      }),
    );

    let report = stepPhysicsWorld({
      world,
      backend,
      state,
      fixedDelta: 1 / 60,
      fixedStep: 1,
    });

    expect(report.sync).toMatchObject({ bodyCount: 2, jointCount: 1 });

    joint.setValue(PhysicsJoint, "enabled", false);
    report = stepPhysicsWorld({
      world,
      backend,
      state,
      fixedDelta: 1 / 60,
      fixedStep: 2,
    });

    expect(report.sync.jointCount).toBe(0);
    expect(report.step.jointCount).toBe(0);

    bob.setValue(RigidBody, "enabled", false);
    report = stepPhysicsWorld({
      world,
      backend,
      state,
      fixedDelta: 1 / 60,
      fixedStep: 3,
    });

    expect(report.sync.bodyCount).toBe(1);
    expect(report.step.bodyCount).toBe(1);
    expect(report.readback.bodyCount).toBe(1);
    expect(report.events).toEqual([]);
  });

  it("synthesizes sleep and wake events from body readback transitions", () => {
    const world = createWorld({ entityCapacity: 2 });
    registerPhysicsComponents(world);
    world.registerComponent(LocalTransform);
    const backend = createTestPhysicsBackend();
    const state = createPhysicsWorldSyncState();

    backend.init();

    const body = spawnPhysicsBody(
      world,
      [0, 0, 0],
      PhysicsRigidBodyType.Dynamic,
    );
    body.addComponent(PhysicsVelocity, createPhysicsVelocity());
    const bodyRef = serializeEntityRef(body);

    let report = stepPhysicsWorld({
      world,
      backend,
      state,
      fixedDelta: 1 / 60,
      fixedStep: 1,
    });

    expect(report.events).toEqual([]);

    body.getVectorView(PhysicsVelocity, "linear").set([1, 0, 0]);
    report = stepPhysicsWorld({
      world,
      backend,
      state,
      fixedDelta: 1 / 60,
      fixedStep: 2,
    });

    expect(report.events).toEqual([
      {
        kind: "wake",
        frame: 0,
        fixedStep: 2,
        substep: 0,
        entityA: bodyRef,
        entityB: bodyRef,
        colliderA: bodyRef,
        colliderB: bodyRef,
      },
    ]);

    body.getVectorView(PhysicsVelocity, "linear").set([0, 0, 0]);
    report = stepPhysicsWorld({
      world,
      backend,
      state,
      fixedDelta: 1 / 60,
      fixedStep: 3,
    });

    expect(report.events).toEqual([
      {
        kind: "sleep",
        frame: 0,
        fixedStep: 3,
        substep: 0,
        entityA: bodyRef,
        entityB: bodyRef,
        colliderA: bodyRef,
        colliderB: bodyRef,
      },
    ]);
  });

  it("clears derived body state when an ECS body is disabled", () => {
    const world = createWorld({ entityCapacity: 2 });
    registerPhysicsComponents(world);
    world.registerComponent(LocalTransform);
    const backend = createTestPhysicsBackend();
    const state = createPhysicsWorldSyncState();

    backend.init();

    const body = spawnPhysicsBody(
      world,
      [0, 0, 0],
      PhysicsRigidBodyType.Dynamic,
    );

    let report = stepPhysicsWorld({
      world,
      backend,
      state,
      fixedDelta: 1 / 60,
      fixedStep: 1,
    });

    expect(report.sync.bodyCount).toBe(1);
    expect(report.readback.bodyCount).toBe(1);
    expect(report.writeback.bodyStateWrites).toBe(1);
    expect(body.hasComponent(PhysicsBodyState)).toBe(true);

    body.setValue(RigidBody, "enabled", false);
    report = stepPhysicsWorld({
      world,
      backend,
      state,
      fixedDelta: 1 / 60,
      fixedStep: 2,
    });

    expect(report.sync.bodyCount).toBe(0);
    expect(report.readback.bodyCount).toBe(0);
    expect(report.writeback.bodyStateWrites).toBe(0);
    expect(body.hasComponent(PhysicsBodyState)).toBe(false);
  });

  it("syncs authored fixed-joint local frames into backend debug geometry", () => {
    const world = createWorld({ entityCapacity: 4 });
    registerPhysicsComponents(world);
    world.registerComponent(LocalTransform);
    const backend = createTestPhysicsBackend();
    const state = createPhysicsWorldSyncState();

    backend.init();

    const anchor = spawnPhysicsBody(
      world,
      [0, 0, 0],
      PhysicsRigidBodyType.Static,
    );
    const follower = spawnPhysicsBody(
      world,
      [2, 0, 0],
      PhysicsRigidBodyType.Dynamic,
    );
    const joint = world.createEntity();

    joint.addComponent(
      PhysicsJoint,
      createPhysicsJoint({
        kind: PhysicsJointKind.Fixed,
        bodyARef: serializeEntityRef(anchor),
        bodyBRef: serializeEntityRef(follower),
        frameA: [0, 1, 0, 0],
        frameB: [1, 0, 0, 0],
      }),
    );

    const report = stepPhysicsWorld({
      world,
      backend,
      state,
      fixedDelta: 1 / 60,
      fixedStep: 1,
    });
    const lines =
      backend.debugGeometry?.({
        jointFrames: true,
        jointFrameLength: 0.5,
      }).lines ?? [];

    expect(report.sync.jointCount).toBe(1);
    expect(lines).toHaveLength(8);
    expect(lines[2]).toEqual({
      from: [0, 0, 0],
      to: [-0.5, 0, 0],
      color: [1, 0.25, 0.25, 1],
    });
    expect(lines[6]).toEqual({
      from: [2, 0, 0],
      to: [2, -0.5, 0],
      color: [0.35, 1, 0.35, 1],
    });
  });

  it("orients unit-joint debug axes from authored frameA", () => {
    const world = createWorld({ entityCapacity: 4 });
    registerPhysicsComponents(world);
    world.registerComponent(LocalTransform);
    const backend = createTestPhysicsBackend();
    const state = createPhysicsWorldSyncState();

    backend.init();

    const anchor = spawnPhysicsBody(
      world,
      [0, 0, 0],
      PhysicsRigidBodyType.Static,
    );
    const slider = spawnPhysicsBody(
      world,
      [0, 0, 0],
      PhysicsRigidBodyType.Dynamic,
    );
    const joint = world.createEntity();

    joint.addComponent(
      PhysicsJoint,
      createPhysicsJoint({
        kind: PhysicsJointKind.Prismatic,
        bodyARef: serializeEntityRef(anchor),
        bodyBRef: serializeEntityRef(slider),
        axis: [0, 1, 0],
        frameA: [0, 0, -0.70710677, 0.70710677],
      }),
    );

    const report = stepPhysicsWorld({
      world,
      backend,
      state,
      fixedDelta: 1 / 60,
      fixedStep: 1,
    });
    const lines =
      backend.debugGeometry?.({
        jointFrames: true,
        jointFrameLength: 0.5,
      }).lines ?? [];

    expect(report.sync.jointCount).toBe(1);
    expect(lines).toHaveLength(2);
    expect(lines[1]?.color).toEqual([0.2, 0.95, 1, 1]);
    expect(lines[1]?.from).toEqual([0, 0, 0]);
    expect(lines[1]?.to[0]).toBeCloseTo(0.5, 5);
    expect(lines[1]?.to[1]).toBeCloseTo(0, 5);
    expect(lines[1]?.to[2]).toBeCloseTo(0, 5);
  });

  it("renders ray-probe debug lines for hits and misses", () => {
    const backend = createTestPhysicsBackend();
    backend.init();
    backend.sync({
      commands: [
        {
          kind: "upsertBody",
          entity: "1:0",
          transform: {
            translation: [2, 0, 0],
            rotation: [0, 0, 0, 1],
          },
          radius: 0.5,
        },
      ],
    });

    const geometry = backend.debugGeometry?.({
      rayProbes: [
        {
          ray: {
            origin: [0, 0, 0],
            direction: [1, 0, 0],
            maxDistance: 10,
          },
        },
        {
          ray: {
            origin: [0, 0, 0],
            direction: [0, 1, 0],
            maxDistance: 2,
          },
        },
      ],
    });

    expect(geometry?.lines).toEqual([
      {
        from: [0, 0, 0],
        to: [1.5, 0, 0],
        color: [1, 0.86, 0.12, 1],
      },
      {
        from: [1.5, 0, 0],
        to: [1.15, 0, 0],
        color: [1, 0.2, 0.12, 1],
      },
      {
        from: [0, 0, 0],
        to: [0, 2, 0],
        color: [0.45, 0.55, 0.65, 1],
      },
    ]);
  });

  it("renders broadphase AABB debug lines", () => {
    const backend = createTestPhysicsBackend();
    backend.init();
    backend.sync({
      commands: [
        {
          kind: "upsertBody",
          entity: "1:0",
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0, 1],
          },
          radius: 0.5,
        },
      ],
    });

    const geometry = backend.debugGeometry?.({ broadphaseAabbs: true });

    expect(geometry?.lines).toEqual([
      {
        from: [-0.5, -0.5, -0.5],
        to: [0.5, -0.5, -0.5],
        color: [0.95, 0.65, 0.15, 1],
      },
      {
        from: [0.5, -0.5, -0.5],
        to: [0.5, 0.5, -0.5],
        color: [0.95, 0.65, 0.15, 1],
      },
      {
        from: [0.5, 0.5, -0.5],
        to: [-0.5, 0.5, -0.5],
        color: [0.95, 0.65, 0.15, 1],
      },
      {
        from: [-0.5, 0.5, -0.5],
        to: [-0.5, -0.5, -0.5],
        color: [0.95, 0.65, 0.15, 1],
      },
      {
        from: [-0.5, -0.5, 0.5],
        to: [0.5, -0.5, 0.5],
        color: [0.95, 0.65, 0.15, 1],
      },
      {
        from: [0.5, -0.5, 0.5],
        to: [0.5, 0.5, 0.5],
        color: [0.95, 0.65, 0.15, 1],
      },
      {
        from: [0.5, 0.5, 0.5],
        to: [-0.5, 0.5, 0.5],
        color: [0.95, 0.65, 0.15, 1],
      },
      {
        from: [-0.5, 0.5, 0.5],
        to: [-0.5, -0.5, 0.5],
        color: [0.95, 0.65, 0.15, 1],
      },
      {
        from: [-0.5, -0.5, -0.5],
        to: [-0.5, -0.5, 0.5],
        color: [0.95, 0.65, 0.15, 1],
      },
      {
        from: [0.5, -0.5, -0.5],
        to: [0.5, -0.5, 0.5],
        color: [0.95, 0.65, 0.15, 1],
      },
      {
        from: [-0.5, 0.5, -0.5],
        to: [-0.5, 0.5, 0.5],
        color: [0.95, 0.65, 0.15, 1],
      },
      {
        from: [0.5, 0.5, -0.5],
        to: [0.5, 0.5, 0.5],
        color: [0.95, 0.65, 0.15, 1],
      },
    ]);
  });

  it("renders contact normals and body-state debug markers", () => {
    const backend = createTestPhysicsBackend();
    backend.init();
    backend.sync({
      commands: [
        {
          kind: "upsertBody",
          entity: "1:0",
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0, 1],
          },
          radius: 0.5,
        },
        {
          kind: "upsertBody",
          entity: "2:0",
          transform: {
            translation: [1, 0, 0],
            rotation: [0, 0, 0, 1],
          },
          radius: 0.5,
        },
      ],
    });

    const geometry = backend.debugGeometry?.({
      contactNormals: true,
      bodyStateMarkers: true,
    });

    expect(geometry?.lines).toEqual([
      {
        from: [0.5, 0, 0],
        to: [0.85, 0, 0],
        color: [1, 0.2, 0.12, 1],
      },
      {
        from: [0, 0, 0],
        to: [0, 0.25, 0],
        color: [0.2, 1, 0.45, 1],
      },
      {
        from: [1, 0, 0],
        to: [1, 0.25, 0],
        color: [0.2, 1, 0.45, 1],
      },
    ]);
  });
});

function spawnPhysicsBody(
  world: EcsWorld,
  translation: readonly [number, number, number],
  bodyType: PhysicsRigidBodyType,
): Entity {
  const entity = world.createEntity();

  entity.addComponent(LocalTransform, createLocalTransform({ translation }));
  entity.addComponent(RigidBody, createRigidBody({ type: bodyType }));
  entity.addComponent(
    Collider,
    createCollider({ shape: { kind: "sphere", radius: 0.5 } }),
  );

  return entity;
}
