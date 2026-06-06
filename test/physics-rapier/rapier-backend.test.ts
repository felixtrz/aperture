import { describe, expect, it } from "vitest";
import {
  Collider,
  ExternalForce,
  ExternalImpulse,
  KinematicTarget,
  PhysicsBodyState,
  PhysicsJoint,
  PhysicsJointKind,
  PhysicsRigidBodyType,
  PhysicsVelocity,
  RigidBody,
  createCollider,
  createExternalForce,
  createExternalImpulse,
  createKinematicTarget,
  createPhysicsJoint,
  createPhysicsResultBuffer,
  createPhysicsVelocity,
  createPhysicsWorldSyncState,
  createRigidBody,
  PhysicsColliderAxis,
  registerPhysicsComponents,
  stepPhysicsWorld,
  type PhysicsColliderGeometryProvider,
  type PhysicsHeightfieldGeometry,
  type PhysicsTriangleMeshGeometry,
} from "@aperture-engine/physics";
import { createRapierPhysicsBackend } from "@aperture-engine/physics-rapier";
import {
  LocalTransform,
  serializeEntityRef,
  type Entity,
} from "@aperture-engine/simulation";
import {
  createSimulationApp,
  withComponent,
  withTransform,
} from "@aperture-engine/runtime";

describe("rapier physics backend", () => {
  it("reports same-worker Rapier capability metadata", () => {
    const backend = createRapierPhysicsBackend();

    expect(backend.capabilities).toEqual({
      compoundColliders: true,
      continuousCollisionDetection: true,
      characterController: true,
      linkedBodyContacts: true,
      combinedPositionVelocityMotors: true,
      motorForceLimits: false,
      automaticBreakForce: false,
      jointImpulseReadback: false,
      pairedNonFixedFrameB: false,
    });
  });

  it("accepts authored CCD on Rapier bodies without unsupported sync features", async () => {
    const backend = createRapierPhysicsBackend({ gravity: [0, 0, 0] });

    await backend.init();
    try {
      const report = backend.sync({
        commands: [
          {
            kind: "upsertBody",
            entity: "fast",
            bodyType: PhysicsRigidBodyType.Dynamic,
            ccdEnabled: true,
            canSleep: false,
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
              density: 1,
            },
          },
        ],
      });

      expect(report.unsupportedFeatureCount).toBe(0);
      expect(report.unsupportedFeatures).toEqual([]);
    } finally {
      backend.dispose();
    }
  });

  it("reports asset-backed collider shapes as unsupported instead of throwing", async () => {
    const backend = createRapierPhysicsBackend({ gravity: [0, 0, 0] });

    await backend.init();
    try {
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
              shape: { kind: "convexHull", meshId: "mesh:rock" },
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
            feature: "collider.convexHull",
            backend: "rapier",
            entity: "mesh-collider",
          },
        ],
      });
      expect(results.bodies).toEqual([]);
    } finally {
      backend.dispose();
    }
  });

  it("cooks convex-hull collider geometry from a provider", async () => {
    const backend = createRapierPhysicsBackend({
      gravity: [0, 0, 0],
      colliderGeometryProvider: createGeometryProvider({
        triangleMeshes: new Map([
          ["mesh:tetra", tetrahedronGeometry("mesh:tetra")],
        ]),
      }),
    });

    await backend.init();
    try {
      const report = backend.sync({
        commands: [
          {
            kind: "upsertBody",
            entity: "convex-body",
            bodyType: PhysicsRigidBodyType.Static,
            transform: {
              translation: [0, 0, 0],
              rotation: [0, 0, 0, 1],
            },
            collider: {
              entity: "convex-collider",
              shape: { kind: "convexHull", meshId: "mesh:tetra" },
            },
          },
        ],
      });
      backend.step(1 / 60, 1);
      const hit = backend.raycastFirst({
        origin: [0, 0, 3],
        direction: [0, 0, -1],
        maxDistance: 6,
      });

      expect(report).toMatchObject({
        bodyCount: 1,
        colliderCount: 1,
        unsupportedFeatureCount: 0,
        unsupportedFeatures: [],
      });
      expect(hit).toMatchObject({
        entity: "convex-body",
        collider: "convex-collider",
      });
    } finally {
      backend.dispose();
    }
  });

  it("cooks static trimesh terrain and collides dynamic bodies with it", async () => {
    const backend = createRapierPhysicsBackend({
      gravity: [0, -9.81, 0],
      colliderGeometryProvider: createGeometryProvider({
        triangleMeshes: new Map([
          ["mesh:level", flatQuadGeometry("mesh:level")],
        ]),
      }),
    });

    await backend.init();
    try {
      const report = backend.sync({
        commands: [
          {
            kind: "upsertBody",
            entity: "level",
            bodyType: PhysicsRigidBodyType.Static,
            transform: {
              translation: [0, 0, 0],
              rotation: [0, 0, 0, 1],
            },
            collider: {
              entity: "level-collider",
              shape: { kind: "trimesh", meshId: "mesh:level" },
            },
          },
          {
            kind: "upsertBody",
            entity: "falling-ball",
            bodyType: PhysicsRigidBodyType.Dynamic,
            canSleep: false,
            transform: {
              translation: [0, 2, 0],
              rotation: [0, 0, 0, 1],
            },
            velocity: {
              linear: [0, 0, 0],
              angular: [0, 0, 0],
            },
            collider: {
              entity: "falling-ball-collider",
              shape: { kind: "sphere", radius: 0.25 },
              density: 1,
            },
          },
        ],
      });
      backend.step(1 / 60, 1);
      const rayHit = backend.raycastFirst({
        origin: [1.5, 2, 1.5],
        direction: [0, -1, 0],
        maxDistance: 5,
      });
      const results = createPhysicsResultBuffer();

      for (let step = 1; step <= 180; step += 1) {
        backend.step(1 / 60, step);
      }
      backend.readResults(results);

      const ball = results.bodies.find(
        (body) => body.entity === "falling-ball",
      );

      expect(report).toMatchObject({
        bodyCount: 2,
        colliderCount: 2,
        unsupportedFeatureCount: 0,
        unsupportedFeatures: [],
      });
      expect(rayHit).toMatchObject({
        entity: "level",
        collider: "level-collider",
      });
      expect(ball?.transform.translation[1]).toBeGreaterThan(0.2);
      expect(ball?.transform.translation[1]).toBeLessThan(0.5);
    } finally {
      backend.dispose();
    }
  });

  it("cooks static heightfield collider geometry from a provider", async () => {
    const backend = createRapierPhysicsBackend({
      gravity: [0, 0, 0],
      colliderGeometryProvider: createGeometryProvider({
        heightfields: new Map([
          ["terrain:height", flatHeightfield("terrain:height")],
        ]),
      }),
    });

    await backend.init();
    try {
      const report = backend.sync({
        commands: [
          {
            kind: "upsertBody",
            entity: "heightfield",
            bodyType: PhysicsRigidBodyType.Static,
            transform: {
              translation: [0, 0, 0],
              rotation: [0, 0, 0, 1],
            },
            collider: {
              entity: "heightfield-collider",
              shape: { kind: "heightfield", assetId: "terrain:height" },
            },
          },
        ],
      });
      backend.step(1 / 60, 1);
      const hit = backend.raycastFirst({
        origin: [0, 2, 0],
        direction: [0, -1, 0],
        maxDistance: 5,
      });

      expect(report).toMatchObject({
        bodyCount: 1,
        colliderCount: 1,
        unsupportedFeatureCount: 0,
        unsupportedFeatures: [],
      });
      expect(hit).toMatchObject({
        entity: "heightfield",
        collider: "heightfield-collider",
      });
    } finally {
      backend.dispose();
    }
  });

  it("reports missing provider geometry as a structured sync diagnostic", async () => {
    const backend = createRapierPhysicsBackend({
      gravity: [0, 0, 0],
      colliderGeometryProvider: createGeometryProvider(),
    });

    await backend.init();
    try {
      const report = backend.sync({
        commands: [
          {
            kind: "upsertBody",
            entity: "missing-mesh-body",
            bodyType: PhysicsRigidBodyType.Static,
            transform: {
              translation: [0, 0, 0],
              rotation: [0, 0, 0, 1],
            },
            collider: {
              entity: "missing-mesh-collider",
              shape: { kind: "trimesh", meshId: "mesh:missing" },
            },
          },
        ],
      });

      expect(report).toMatchObject({
        bodyCount: 0,
        colliderCount: 0,
        unsupportedFeatureCount: 1,
        unsupportedFeatures: [
          {
            code: "physics.collider.asset.missing",
            feature: "collider.triangleMesh",
            backend: "rapier",
            entity: "missing-mesh-collider",
          },
        ],
      });
    } finally {
      backend.dispose();
    }
  });

  it("rejects dynamic trimesh and non-unit asset collider scale without cooking", async () => {
    const backend = createRapierPhysicsBackend({
      gravity: [0, 0, 0],
      colliderGeometryProvider: createGeometryProvider({
        triangleMeshes: new Map([
          ["mesh:level", flatQuadGeometry("mesh:level")],
        ]),
      }),
    });

    await backend.init();
    try {
      const dynamicReport = backend.sync({
        commands: [
          {
            kind: "upsertBody",
            entity: "dynamic-trimesh",
            bodyType: PhysicsRigidBodyType.Dynamic,
            transform: {
              translation: [0, 0, 0],
              rotation: [0, 0, 0, 1],
            },
            collider: {
              entity: "dynamic-trimesh-collider",
              shape: { kind: "trimesh", meshId: "mesh:level" },
            },
          },
        ],
      });
      const scaleReport = backend.sync({
        commands: [
          {
            kind: "upsertBody",
            entity: "scaled-trimesh",
            bodyType: PhysicsRigidBodyType.Static,
            transform: {
              translation: [0, 0, 0],
              rotation: [0, 0, 0, 1],
            },
            collider: {
              entity: "scaled-trimesh-collider",
              shape: { kind: "trimesh", meshId: "mesh:level" },
              scale: [2, 1, 1],
            },
          },
        ],
      });

      expect(dynamicReport).toMatchObject({
        bodyCount: 0,
        colliderCount: 0,
        unsupportedFeatures: [
          {
            code: "physics.collider.dynamicAssetShape.unsupported",
            feature: "collider.trimesh.dynamicBody",
            entity: "dynamic-trimesh-collider",
          },
        ],
      });
      expect(scaleReport).toMatchObject({
        bodyCount: 0,
        colliderCount: 0,
        unsupportedFeatures: [
          {
            code: "physics.collider.scale.unsupported",
            feature: "collider.trimesh.scale",
            entity: "scaled-trimesh-collider",
          },
        ],
      });
    } finally {
      backend.dispose();
    }
  });

  it("reports parented rigid bodies as unsupported instead of syncing local poses as world poses", async () => {
    const backend = createRapierPhysicsBackend({ gravity: [0, 0, 0] });

    await backend.init();
    try {
      const report = backend.sync({
        commands: [
          {
            kind: "upsertBody",
            entity: "parented-body",
            bodyType: PhysicsRigidBodyType.Dynamic,
            parented: true,
            transform: {
              translation: [1, 0, 0],
              rotation: [0, 0, 0, 1],
            },
            velocity: {
              linear: [1, 0, 0],
              angular: [0, 0, 0],
            },
            collider: {
              shape: { kind: "sphere", radius: 0.5 },
              density: 1,
            },
          },
        ],
      });
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
            backend: "rapier",
            entity: "parented-body",
          },
        ],
      });
      expect(results.bodies).toEqual([]);
    } finally {
      backend.dispose();
    }
  });

  it("steps an ECS-authored falling body through the runtime fixed-step task", async () => {
    const first = await runBouncingBall();
    const second = await runBouncingBall();

    expect(first.startHeight).toBeGreaterThan(3.9);
    expect(first.minHeight).toBeLessThan(0.72);
    expect(first.postImpactMaxHeight).toBeGreaterThan(1.2);
    expect(first.finalHeight).toBeCloseTo(second.finalHeight, 5);
    expect(first.finalVelocityY).toBeCloseTo(second.finalVelocityY, 5);
    expect(first.bodyStateWrites).toBeGreaterThan(0);
    expect(first.transformWrites).toBeGreaterThan(0);
  });

  it("applies ECS-authored external force and consumes one-shot impulse", async () => {
    const app = createSimulationApp({
      fixedStep: { fixedDelta: 1 / 60, maxSubsteps: 4 },
      worldOptions: { entityCapacity: 4 },
    });
    const backend = createRapierPhysicsBackend({ gravity: [0, 0, 0] });
    const syncState = createPhysicsWorldSyncState();

    await backend.init();
    registerPhysicsComponents(app.world);
    const body = app.spawn(
      withTransform({ translation: [0, 0, 0] }),
      withComponent(
        RigidBody,
        createRigidBody({
          type: PhysicsRigidBodyType.Dynamic,
          canSleep: false,
        }),
      ),
      withComponent(
        Collider,
        createCollider({
          shape: { kind: "sphere", radius: 0.5 },
          density: 1,
        }),
      ),
      withComponent(PhysicsVelocity, createPhysicsVelocity()),
      withComponent(ExternalForce, createExternalForce({ force: [1, 0, 0] })),
      withComponent(
        ExternalImpulse,
        createExternalImpulse({ impulse: [1, 0, 0] }),
      ),
    );

    app.registerFixedStepTask((context) => {
      stepPhysicsWorld({
        world: context.world,
        backend,
        state: syncState,
        fixedDelta: context.fixedDelta,
        fixedStep: context.fixedStep,
      });
    });

    try {
      app.step(1 / 60, 0);
      const firstVelocityX = readVelocityX(body);
      const firstX = readLocalX(body);

      expect(firstVelocityX).toBeGreaterThan(0);
      expect(firstX).toBeGreaterThan(0);
      expect(
        Array.from(body.getVectorView(ExternalImpulse, "impulse")),
      ).toEqual([0, 0, 0]);

      app.step(1 / 60, 1 / 60);

      expect(readVelocityX(body)).toBeGreaterThan(firstVelocityX);
      expect(readLocalX(body)).toBeGreaterThan(firstX);
    } finally {
      backend.dispose();
    }
  });

  it("applies ECS-authored kinematic targets through Rapier fixed-step writeback", async () => {
    const app = createSimulationApp({
      fixedStep: { fixedDelta: 1 / 60, maxSubsteps: 4 },
      worldOptions: { entityCapacity: 4 },
    });
    const backend = createRapierPhysicsBackend({ gravity: [0, 0, 0] });
    const syncState = createPhysicsWorldSyncState();

    await backend.init();
    registerPhysicsComponents(app.world);
    const body = app.spawn(
      withTransform({ translation: [0, 0, 0] }),
      withComponent(
        RigidBody,
        createRigidBody({ type: PhysicsRigidBodyType.KinematicPosition }),
      ),
      withComponent(
        Collider,
        createCollider({ shape: { kind: "sphere", radius: 0.5 } }),
      ),
      withComponent(
        KinematicTarget,
        createKinematicTarget({ translation: [1, 0, 0] }),
      ),
    );

    app.registerFixedStepTask((context) => {
      stepPhysicsWorld({
        world: context.world,
        backend,
        state: syncState,
        fixedDelta: context.fixedDelta,
        fixedStep: context.fixedStep,
      });
    });

    try {
      app.step(1 / 60, 0);

      expect(readLocalX(body)).toBeCloseTo(1, 5);
      expect(body.hasComponent(PhysicsBodyState)).toBe(true);
      expect(
        Array.from(body.getVectorView(PhysicsBodyState, "currentTranslation")),
      ).toEqual([expect.closeTo(1, 5), 0, 0]);
    } finally {
      backend.dispose();
    }
  });

  it("honors authored rigid-body axis locks on Rapier bodies", async () => {
    const backend = createRapierPhysicsBackend({ gravity: [0, 0, 0] });

    await backend.init();
    try {
      backend.sync({
        commands: [
          {
            kind: "upsertBody",
            entity: "locked",
            bodyType: PhysicsRigidBodyType.Dynamic,
            canSleep: false,
            transform: {
              translation: [0, 0, 0],
              rotation: [0, 0, 0, 1],
            },
            velocity: {
              linear: [1, 1, 0],
              angular: [0, 1, 1],
            },
            collider: {
              shape: { kind: "sphere", radius: 0.25 },
              density: 1,
            },
            lockTranslations: [false, true, false],
            lockRotations: [false, true, false],
          },
        ],
      });
      backend.step(1, 1);
      const results = createPhysicsResultBuffer();
      backend.readResults(results);

      expect(results.bodies[0]?.transform.translation[0]).toBeGreaterThan(0.5);
      expect(results.bodies[0]?.transform.translation[1]).toBeCloseTo(0, 5);
      expect(results.bodies[0]?.velocity.linear[1]).toBeCloseTo(0, 5);
      expect(results.bodies[0]?.velocity.angular[1]).toBeCloseTo(0, 5);
    } finally {
      backend.dispose();
    }
  });

  it("applies authored rigid-body damping on Rapier bodies", async () => {
    const backend = createRapierPhysicsBackend({ gravity: [0, 0, 0] });

    await backend.init();
    try {
      backend.sync({
        commands: [
          {
            kind: "upsertBody",
            entity: "damped",
            bodyType: PhysicsRigidBodyType.Dynamic,
            canSleep: false,
            transform: {
              translation: [0, 0, 0],
              rotation: [0, 0, 0, 1],
            },
            velocity: {
              linear: [1, 0, 0],
              angular: [0, 2, 0],
            },
            collider: {
              shape: { kind: "sphere", radius: 0.25 },
              density: 1,
            },
            linearDamping: 1,
            angularDamping: 3,
          },
        ],
      });
      backend.step(1, 1);
      const results = createPhysicsResultBuffer();
      backend.readResults(results);

      expect(results.bodies[0]?.transform.translation[0]).toBeCloseTo(1, 5);
      expect(results.bodies[0]?.velocity.linear[0]).toBeCloseTo(0.5, 5);
      expect(results.bodies[0]?.velocity.angular[1]).toBeCloseTo(0.5, 5);
    } finally {
      backend.dispose();
    }
  });

  it("integrates angular velocity into Rapier body rotation", async () => {
    const backend = createRapierPhysicsBackend({ gravity: [0, 0, 0] });

    await backend.init();
    try {
      backend.sync({
        commands: [
          {
            kind: "upsertBody",
            entity: "spinner",
            bodyType: PhysicsRigidBodyType.Dynamic,
            canSleep: false,
            transform: {
              translation: [0, 0, 0],
              rotation: [0, 0, 0, 1],
            },
            velocity: {
              linear: [0, 0, 0],
              angular: [0, 0, Math.PI],
            },
            collider: {
              shape: { kind: "sphere", radius: 0.25 },
              density: 1,
            },
          },
        ],
      });
      backend.step(0.5, 1);
      const results = createPhysicsResultBuffer();
      backend.readResults(results);

      expect(results.bodies[0]?.transform.rotation[2]).toBeCloseTo(
        Math.SQRT1_2,
        1,
      );
      expect(results.bodies[0]?.transform.rotation[3]).toBeCloseTo(
        Math.SQRT1_2,
        1,
      );
    } finally {
      backend.dispose();
    }
  });

  it("masks direct setVelocity commands on authored locked axes in Rapier", async () => {
    const backend = createRapierPhysicsBackend({ gravity: [0, 0, 0] });

    await backend.init();
    try {
      backend.sync({
        commands: [
          {
            kind: "upsertBody",
            entity: "locked",
            bodyType: PhysicsRigidBodyType.Dynamic,
            canSleep: false,
            transform: {
              translation: [0, 0, 0],
              rotation: [0, 0, 0, 1],
            },
            velocity: {
              linear: [0, 0, 0],
              angular: [0, 0, 0],
            },
            collider: {
              shape: { kind: "sphere", radius: 0.25 },
              density: 1,
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
      expect(results.bodies[0]?.transform.translation[0]).toBeGreaterThan(0.5);
      expect(results.bodies[0]?.transform.translation[1]).toBeCloseTo(0, 5);
      expect(results.bodies[0]?.transform.rotation).toEqual([0, 0, 0, 1]);
    } finally {
      backend.dispose();
    }
  });

  it("integrates velocity-based kinematic bodies on Rapier", async () => {
    const backend = createRapierPhysicsBackend({ gravity: [0, 10, 0] });

    await backend.init();
    try {
      backend.sync({
        commands: [
          {
            kind: "upsertBody",
            entity: "kinematic",
            bodyType: PhysicsRigidBodyType.KinematicVelocity,
            transform: {
              translation: [0, 0, 0],
              rotation: [0, 0, 0, 1],
            },
            velocity: {
              linear: [2, 1, 0],
              angular: [0, 0, 0],
            },
            collider: {
              shape: { kind: "sphere", radius: 0.25 },
            },
            lockTranslations: [false, true, false],
          },
        ],
      });
      backend.step(0.5, 1);
      const results = createPhysicsResultBuffer();
      backend.readResults(results);

      expect(results.bodies[0]?.transform.translation[0]).toBeCloseTo(1, 5);
      expect(results.bodies[0]?.transform.translation[1]).toBeCloseTo(0, 5);
      expect(results.bodies[0]?.velocity.linear).toEqual([2, 0, 0]);
    } finally {
      backend.dispose();
    }
  });

  it("honors authored canSleep false on Rapier bodies", async () => {
    const backend = createRapierPhysicsBackend({ gravity: [0, 0, 0] });

    await backend.init();
    try {
      backend.sync({
        commands: [
          {
            kind: "upsertBody",
            entity: "awake",
            bodyType: PhysicsRigidBodyType.Dynamic,
            canSleep: false,
            transform: {
              translation: [0, 0, 0],
              rotation: [0, 0, 0, 1],
            },
            velocity: {
              linear: [0, 0, 0],
              angular: [0, 0, 0],
            },
            collider: {
              shape: { kind: "sphere", radius: 0.25 },
            },
          },
        ],
      });
      for (let step = 0; step < 180; step += 1) {
        backend.step(1 / 60, step);
      }
      const results = createPhysicsResultBuffer();
      backend.readResults(results);

      expect(results.bodies[0]?.sleeping).toBe(false);
    } finally {
      backend.dispose();
    }
  });

  it("preserves explicit body sleep and wake controls across same-worker sync", async () => {
    const backend = createRapierPhysicsBackend({ gravity: [0, 0, 0] });
    const commands = [
      {
        kind: "upsertBody" as const,
        entity: "sleepy",
        bodyType: PhysicsRigidBodyType.Dynamic,
        canSleep: true,
        transform: {
          translation: [0, 0, 0] as const,
          rotation: [0, 0, 0, 1] as const,
        },
        collider: {
          shape: { kind: "sphere" as const, radius: 0.25 },
        },
      },
    ];

    await backend.init();
    try {
      backend.sync({ commands });
      backend.step(1 / 60, 1);
      let results = createPhysicsResultBuffer();
      backend.readResults(results);

      expect(results.bodies[0]?.sleeping).toBe(false);
      expect(backend.sleepBody?.("sleepy")).toBe(true);

      backend.sync({ commands });
      backend.step(1 / 60, 2);
      results = createPhysicsResultBuffer();
      backend.readResults(results);

      expect(results.bodies[0]?.sleeping).toBe(true);
      expect(backend.wakeBody?.("sleepy")).toBe(true);

      backend.sync({ commands });
      backend.step(1 / 60, 3);
      results = createPhysicsResultBuffer();
      backend.readResults(results);

      expect(results.bodies[0]?.sleeping).toBe(false);
      expect(backend.sleepBody?.("missing")).toBe(false);
      expect(backend.wakeBody?.("missing")).toBe(false);
    } finally {
      backend.dispose();
    }
  });

  it("resyncs body type and collider shape descriptor changes", async () => {
    const backend = createRapierPhysicsBackend({ gravity: [0, 0, 0] });

    await backend.init();
    try {
      backend.sync({
        commands: [
          {
            kind: "upsertBody",
            entity: "editable",
            transform: {
              translation: [0, 0, 0],
              rotation: [0, 0, 0, 1],
            },
            bodyType: PhysicsRigidBodyType.Dynamic,
            collider: {
              shape: { kind: "sphere", radius: 0.5 },
            },
          },
        ],
      });
      backend.step(1 / 60, 0);

      expect(
        backend.raycastFirst({
          origin: [0, 2, 0],
          direction: [0, -1, 0],
          maxDistance: 1,
        }),
      ).toBeNull();

      backend.sync({
        commands: [
          {
            kind: "upsertBody",
            entity: "editable",
            transform: {
              translation: [0, 0, 0],
              rotation: [0, 0, 0, 1],
            },
            bodyType: PhysicsRigidBodyType.Static,
            velocity: {
              linear: [1, 0, 0],
              angular: [0, 0, 0],
            },
            collider: {
              shape: { kind: "sphere", radius: 1.25 },
            },
          },
        ],
      });
      backend.step(1, 1);

      expect(
        backend.raycastFirst({
          origin: [0, 2, 0],
          direction: [0, -1, 0],
          maxDistance: 1,
        }),
      ).toMatchObject({
        entity: "editable",
        distance: expect.closeTo(0.75, 5),
      });

      const results = createPhysicsResultBuffer();

      backend.readResults(results);

      expect(results.bodies).toHaveLength(1);
      expect(results.bodies[0]?.transform.translation).toEqual([0, 0, 0]);
    } finally {
      backend.dispose();
    }
  });

  it("queries multiple Rapier colliders attached to one body", async () => {
    const backend = createRapierPhysicsBackend({ gravity: [0, 0, 0] });

    await backend.init();
    try {
      const sync = backend.sync({
        commands: [
          {
            kind: "upsertBody",
            entity: "compound",
            transform: {
              translation: [0, 0, 0],
              rotation: [0, 0, 0, 1],
            },
            bodyType: PhysicsRigidBodyType.Static,
            colliders: [
              {
                entity: "compound:left",
                shape: { kind: "sphere", radius: 0.25 },
                offsetTranslation: [1, 0, 0],
              },
              {
                entity: "compound:right",
                shape: { kind: "sphere", radius: 0.25 },
                offsetTranslation: [3, 0, 0],
              },
            ],
          },
        ],
      });
      const step = backend.step(1 / 60, 0);
      const hits = backend.raycastAll({
        origin: [0, 0, 0],
        direction: [1, 0, 0],
        maxDistance: 4,
      });
      const overlap = backend.overlapShape?.(
        { kind: "sphere", radius: 0.1 },
        { translation: [3, 0, 0], rotation: [0, 0, 0, 1] },
      );

      expect(sync).toMatchObject({ bodyCount: 1, colliderCount: 2 });
      expect(step).toMatchObject({ bodyCount: 1, colliderCount: 2 });
      expect(hits).toHaveLength(2);
      expect(hits[0]).toMatchObject({
        entity: "compound",
        collider: "compound:left",
        distance: expect.closeTo(0.75, 5),
      });
      expect(hits[1]).toMatchObject({
        entity: "compound",
        collider: "compound:right",
        distance: expect.closeTo(2.75, 5),
      });
      expect(overlap).toEqual([
        { entity: "compound", collider: "compound:right" },
      ]);
    } finally {
      backend.dispose();
    }
  });

  it("emits trigger events deterministically and raycasts physics colliders", async () => {
    const first = await runTriggerSensorPass();
    const second = await runTriggerSensorPass();

    expect(first.raycastHit).toMatchObject({
      entity: "sensor",
      distance: 2.5,
      point: [0, 0.5, 0],
      normal: [0, 1, 0],
    });
    expect(first.sensorOverlapHits).toEqual([
      { entity: "sensor", collider: "sensor" },
    ]);
    expect(first.defaultOverlapHits).toEqual([]);
    expect(first.sensorShapeCastHit).toMatchObject({
      entity: "sensor",
      normal: [0, 1, 0],
    });
    expect(first.sensorShapeCastHit?.point[0]).toBeCloseTo(0, 3);
    expect(first.sensorShapeCastHit?.point[1]).toBeCloseTo(0.5, 6);
    expect(first.sensorShapeCastHit?.point[2]).toBeCloseTo(0, 3);
    expect(first.sensorShapeCastHit?.timeOfImpact).toBeGreaterThan(0);
    expect(first.sensorShapeCastHit?.timeOfImpact).toBeLessThan(1);
    expect(first.defaultShapeCastHit).toBeNull();
    expect(first.sensorProjection).toMatchObject({
      entity: "sensor",
      point: [0, 0.5, 0],
      normal: [0, 1, 0],
      inside: false,
    });
    expect(first.sensorProjection?.distance).toBeCloseTo(0.25, 6);
    expect(first.defaultProjection).toBeNull();
    expect(first.events.map((event) => event.kind)).toContain("triggerEnter");
    expect(first.events.map((event) => event.kind)).toContain("triggerStay");
    expect(first.events.map((event) => event.kind)).toContain("triggerExit");
    expect(
      first.events.findIndex((event) => event.kind === "triggerEnter"),
    ).toBeLessThan(
      first.events.findIndex((event) => event.kind === "triggerExit"),
    );
    expect(first.events).toEqual(second.events);
  });

  it("honors authored primitive axes for Rapier collider and query geometry", async () => {
    const result = await runPrimitiveAxisPass();

    expect(result.xRaycast).toMatchObject({
      entity: "axis-cylinder",
      distance: expect.closeTo(2, 5),
    });
    expect(result.yRaycast).toMatchObject({
      entity: "axis-cylinder",
      distance: expect.closeTo(3.75, 5),
    });
    expect(result.overlapEntities).toContain("query-target");
    expect(result.shapeCastHit).toMatchObject({
      entity: "query-target",
    });
    expect(result.shapeCastHit?.timeOfImpact).toBeGreaterThan(0);
    expect(result.shapeCastHit?.timeOfImpact).toBeLessThan(1);
    expect(result.aabbBounds.min[0]).toBeCloseTo(-2, 5);
    expect(result.aabbBounds.max[0]).toBeCloseTo(2, 5);
    expect(result.aabbBounds.min[1]).toBeCloseTo(-0.25, 5);
    expect(result.aabbBounds.max[1]).toBeCloseTo(0.25, 5);
  });

  it("includes contact point and normal on collision events", async () => {
    const first = await runCollisionContactEventPass();
    const second = await runCollisionContactEventPass();

    expect(first).toEqual(second);
    expect(first.kind).toBe("collisionStart");
    expect(first.entityA).toBe("box");
    expect(first.entityB).toBe("mover");
    expect(first.point.every(Number.isFinite)).toBe(true);
    expect(first.normal.every(Number.isFinite)).toBe(true);
    expect(Math.hypot(...first.normal)).toBeCloseTo(1, 5);
  });

  it("emits collision start, stay, and end in deterministic order", async () => {
    const first = await runCollisionLifecyclePass();
    const second = await runCollisionLifecyclePass();

    expect(first).toEqual(second);
    expect(first.events.map((event) => event.kind)).toEqual([
      "collisionStart",
      "collisionStay",
      "collisionEnd",
    ]);
    expect(first.events.map((event) => event.fixedStep)).toEqual([1, 2, 3]);
    expect(first.events).toEqual(
      first.events
        .slice()
        .sort(
          (left, right) =>
            left.fixedStep - right.fixedStep ||
            left.kind.localeCompare(right.kind) ||
            left.entityA.localeCompare(right.entityA) ||
            left.entityB.localeCompare(right.entityB),
        ),
    );
  });

  it("emits contact force events with finite force data", async () => {
    const first = await runContactForceEventPass();
    const second = await runContactForceEventPass();

    expect(first.fixedStep).toBe(second.fixedStep);
    expect(first.entityA).toBe("falling");
    expect(first.entityB).toBe("floor");
    expect(first.force.every(Number.isFinite)).toBe(true);
    expect(first.normal.every(Number.isFinite)).toBe(true);
    expect(Math.hypot(...first.normal)).toBeCloseTo(1, 5);
    expect(first.forceMagnitude).toBeGreaterThan(0);
    expect(first.maxForceMagnitude).toBeGreaterThan(0);
    expect(first.impulse).toBeGreaterThan(0);
    expect(first.impulse).toBeCloseTo(first.forceMagnitude / 60, 5);
    expect(first.forceMagnitude).toBeCloseTo(second.forceMagnitude, 5);
    expect(first.maxForceMagnitude).toBeCloseTo(second.maxForceMagnitude, 5);
    expect(first.impulse).toBeCloseTo(second.impulse, 5);
  });

  it("returns deterministic collider wireframe debug geometry", async () => {
    const first = await runDebugGeometryPass();
    const second = await runDebugGeometryPass();

    expect(first.lineCount).toBeGreaterThan(0);
    expect(first.lineCount).toBe(second.lineCount);
    expect(first.firstLine).toEqual(second.firstLine);
    expect(first.firstLine?.from.every(Number.isFinite)).toBe(true);
    expect(first.firstLine?.to.every(Number.isFinite)).toBe(true);
    expect(first.firstLine?.color).toHaveLength(4);
    expect(first.firstLine?.color.every(Number.isFinite)).toBe(true);
    expect(first.rayProbeLines).toEqual(second.rayProbeLines);
    expect(first.rayProbeLines).toHaveLength(2);
    expect(first.rayProbeLines[0]).toMatchObject({
      from: [-2, 2, 3],
      to: [0.5, 2, 3],
      color: [1, 0.86, 0.12, 1],
    });
    expect(first.contactNormalLines).toEqual(second.contactNormalLines);
    expect(first.contactNormalLines.length).toBeGreaterThan(0);
    expect(first.contactNormalLines[0]?.color).toEqual([1, 0.2, 0.12, 1]);
    expect(first.bodyStateLines).toEqual(second.bodyStateLines);
    expect(first.bodyStateLines).toHaveLength(2);
    expect(first.broadphaseAabbLines).toEqual(second.broadphaseAabbLines);
    expect(first.broadphaseAabbLines).toHaveLength(24);
    expectDebugLineClose(first.broadphaseAabbLines[0], {
      from: [0.5, 1, 1.5],
      to: [1.5, 1, 1.5],
      color: [0.95, 0.65, 0.15, 1],
    });
    expect(first.jointFrameLines).toEqual(second.jointFrameLines);
    expect(first.jointFrameLines).toHaveLength(2);
    expectDebugLineClose(first.jointFrameLines[0], {
      from: [1, 2, 3],
      to: [1.95, 2, 3],
      color: [0.9, 0.45, 1, 1],
    });
    expectDebugLineClose(first.jointFrameLines[1], {
      from: [1, 2, 3],
      to: [1, 2.4, 3],
      color: [0.2, 0.95, 1, 1],
    });
    const bodyStateDebugColors = [
      [0.2, 1, 0.45, 1],
      [0.65, 0.7, 0.78, 1],
    ] as const;

    expect(
      first.bodyStateLines.every((line) =>
        bodyStateDebugColors.some((color) => sameColor(line.color, color)),
      ),
    ).toBe(true);
  });

  it("syncs ECS-authored distance joints into Rapier constraints", async () => {
    const result = await runDistanceJointPass();

    expect(result.jointCount).toBe(1);
    expect(result.maxAnchorDistance).toBeLessThan(2.08);
    expect(result.finalBobY).toBeLessThan(-0.2);
  });

  it("reports authored joint breakForce as unsupported for Rapier 0.19.3", async () => {
    const backend = createRapierPhysicsBackend();

    await backend.init();

    try {
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
              breakForce: 24,
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
            backend: "rapier",
            entity: "joint:0",
            value: 24,
          },
        ],
      });
    } finally {
      backend.dispose();
    }
  });

  it("reports authored joint motorMaxForce as unsupported for Rapier 0.19.3", async () => {
    const backend = createRapierPhysicsBackend();

    await backend.init();

    try {
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
              motorMaxForce: 8,
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
            backend: "rapier",
            entity: "joint:0",
            value: 8,
          },
        ],
      });
    } finally {
      backend.dispose();
    }
  });

  it("reports generic joints as unsupported and removes stale Rapier joints", async () => {
    const backend = createRapierPhysicsBackend();

    await backend.init();

    try {
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
            backend: "rapier",
            entity: "joint:0",
          },
        ],
      });
    } finally {
      backend.dispose();
    }
  });

  it("honors authored linked-body contact filtering on Rapier joints", async () => {
    const enabled = await runLinkedBodyContactsPass(true);
    const disabled = await runLinkedBodyContactsPass(false);

    expect(enabled.events).toContain("collisionStart");
    expect(enabled.events).toContain("contactForce");
    expect(enabled.contactForces).toBeGreaterThan(0);
    expect(disabled.events).toEqual([]);
    expect(disabled.contactForces).toBe(0);
  });

  it("reports authored non-fixed joint frameB as unsupported for Rapier 0.19.3", async () => {
    const backend = createRapierPhysicsBackend();

    await backend.init();

    try {
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
            backend: "rapier",
            entity: "joint:0",
          },
        ],
      });
    } finally {
      backend.dispose();
    }
  });

  it("removes disabled ECS-authored joints from Rapier constraints", async () => {
    const result = await runDisabledDistanceJointPass();

    expect(result.jointCountBeforeDisable).toBe(1);
    expect(result.jointCountAfterDisable).toBe(0);
    expect(result.maxBeforeDisableDistance).toBeLessThan(2.08);
    expect(result.maxAfterDisableDistance).toBeGreaterThan(2.25);
  });

  it("applies authored fixed-joint local frames to Rapier debug geometry", async () => {
    const first = await runFixedJointFramePass();
    const second = await runFixedJointFramePass();

    expect(first.jointCount).toBe(1);
    expect(first.jointFrameLines).toEqual(second.jointFrameLines);
    expect(first.jointFrameLines).toHaveLength(8);
    expectDebugLineClose(first.jointFrameLines[2], {
      from: [0, 0, 0],
      to: [-0.5, 0, 0],
      color: [1, 0.25, 0.25, 1],
    });
    expectDebugLineClose(first.jointFrameLines[6], {
      from: [2, 0, 0],
      to: [2, -0.5, 0],
      color: [0.35, 1, 0.35, 1],
    });
  });

  it("orients Rapier prismatic joint axes from authored frameA", async () => {
    const result = await runPrismaticFrameAxisPass();

    expect(result.jointCount).toBe(1);
    expect(result.finalSliderX).toBeGreaterThan(0.2);
    expect(result.finalSliderX).toBeLessThan(0.65);
    expect(Math.abs(result.finalSliderY)).toBeLessThan(0.03);
    expectDebugLineClose(result.jointAxisLine, {
      from: [0, 0, 0],
      to: [0.5, 0, 0],
      color: [0.2, 0.95, 1, 1],
    });
  });

  it("applies authored prismatic joint limits to Rapier unit joints", async () => {
    const result = await runPrismaticLimitPass();

    expect(result.jointCount).toBe(1);
    expect(result.maxSliderX).toBeLessThan(0.62);
    expect(result.finalSliderX).toBeGreaterThan(0.25);
  });

  it("drives authored prismatic joint motors through Rapier unit joints", async () => {
    const result = await runPrismaticMotorPass();

    expect(result.jointCount).toBe(1);
    expect(result.finalSliderX).toBeGreaterThan(0.2);
    expect(result.finalSliderX).toBeLessThan(0.5);
    expect(result.finalSliderX).toBeGreaterThan(result.startSliderX);
  });

  it("combines authored position and velocity motor targets on Rapier unit joints", async () => {
    const result = await runPrismaticCombinedMotorPass();

    expect(result.jointCount).toBe(1);
    expect(result.finalSliderX).toBeGreaterThan(0.2);
    expect(result.finalSliderX).toBeLessThan(1.21);
    expect(result.finalSliderX).toBeGreaterThan(result.startSliderX);
  });

  it("drives authored prismatic velocity motors through Rapier unit joints", async () => {
    const result = await runPrismaticVelocityMotorPass();

    expect(result.jointCount).toBe(1);
    expect(result.finalSliderX).toBeGreaterThan(0.45);
    expect(result.finalSliderX).toBeLessThan(1.85);
    expect(result.finalSliderX).toBeGreaterThan(result.startSliderX);
  });
});

interface BouncingBallResult {
  readonly startHeight: number;
  readonly minHeight: number;
  readonly postImpactMaxHeight: number;
  readonly finalHeight: number;
  readonly finalVelocityY: number;
  readonly bodyStateWrites: number;
  readonly transformWrites: number;
}

interface TriggerSensorPassResult {
  readonly raycastHit: ReturnType<
    ReturnType<typeof createRapierPhysicsBackend>["raycastFirst"]
  >;
  readonly sensorOverlapHits: readonly { readonly entity: string }[];
  readonly defaultOverlapHits: readonly { readonly entity: string }[];
  readonly sensorShapeCastHit: ReturnType<
    NonNullable<ReturnType<typeof createRapierPhysicsBackend>["castShapeFirst"]>
  >;
  readonly defaultShapeCastHit: ReturnType<
    NonNullable<ReturnType<typeof createRapierPhysicsBackend>["castShapeFirst"]>
  >;
  readonly sensorProjection: ReturnType<
    NonNullable<ReturnType<typeof createRapierPhysicsBackend>["projectPoint"]>
  >;
  readonly defaultProjection: ReturnType<
    NonNullable<ReturnType<typeof createRapierPhysicsBackend>["projectPoint"]>
  >;
  readonly events: readonly {
    readonly kind: string;
    readonly fixedStep: number;
    readonly entityA: string;
    readonly entityB: string;
  }[];
}

interface CollisionContactEventPassResult {
  readonly kind: string;
  readonly entityA: string;
  readonly entityB: string;
  readonly point: readonly [number, number, number];
  readonly normal: readonly [number, number, number];
}

interface CollisionLifecyclePassResult {
  readonly events: readonly {
    readonly kind: string;
    readonly fixedStep: number;
    readonly entityA: string;
    readonly entityB: string;
  }[];
}

interface ContactForceEventPassResult {
  readonly fixedStep: number;
  readonly entityA: string;
  readonly entityB: string;
  readonly force: readonly [number, number, number];
  readonly normal: readonly [number, number, number];
  readonly forceMagnitude: number;
  readonly maxForceMagnitude: number;
  readonly impulse: number;
}

interface LinkedBodyContactsPassResult {
  readonly events: readonly string[];
  readonly contactForces: number;
}

interface PrimitiveAxisPassResult {
  readonly xRaycast: ReturnType<
    ReturnType<typeof createRapierPhysicsBackend>["raycastFirst"]
  >;
  readonly yRaycast: ReturnType<
    ReturnType<typeof createRapierPhysicsBackend>["raycastFirst"]
  >;
  readonly overlapEntities: readonly string[];
  readonly shapeCastHit: ReturnType<
    NonNullable<ReturnType<typeof createRapierPhysicsBackend>["castShapeFirst"]>
  >;
  readonly aabbBounds: {
    readonly min: readonly [number, number, number];
    readonly max: readonly [number, number, number];
  };
}

interface DebugGeometryPassResult {
  readonly lineCount: number;
  readonly rayProbeLines: readonly DebugLine[];
  readonly contactNormalLines: readonly DebugLine[];
  readonly bodyStateLines: readonly DebugLine[];
  readonly broadphaseAabbLines: readonly DebugLine[];
  readonly jointFrameLines: readonly DebugLine[];
  readonly firstLine: DebugLine | undefined;
}

interface DistanceJointPassResult {
  readonly jointCount: number;
  readonly maxAnchorDistance: number;
  readonly finalBobY: number;
}

interface DisabledDistanceJointPassResult {
  readonly jointCountBeforeDisable: number;
  readonly jointCountAfterDisable: number;
  readonly maxBeforeDisableDistance: number;
  readonly maxAfterDisableDistance: number;
}

interface FixedJointFramePassResult {
  readonly jointCount: number;
  readonly jointFrameLines: readonly DebugLine[];
}

interface PrismaticFrameAxisPassResult {
  readonly jointCount: number;
  readonly finalSliderX: number;
  readonly finalSliderY: number;
  readonly jointAxisLine: DebugLine;
}

interface PrismaticLimitPassResult {
  readonly jointCount: number;
  readonly maxSliderX: number;
  readonly finalSliderX: number;
}

interface PrismaticMotorPassResult {
  readonly jointCount: number;
  readonly startSliderX: number;
  readonly finalSliderX: number;
}

interface PrismaticCombinedMotorPassResult {
  readonly jointCount: number;
  readonly startSliderX: number;
  readonly finalSliderX: number;
}

interface PrismaticVelocityMotorPassResult {
  readonly jointCount: number;
  readonly startSliderX: number;
  readonly finalSliderX: number;
}

interface DebugLine {
  readonly from: readonly [number, number, number];
  readonly to: readonly [number, number, number];
  readonly color: readonly [number, number, number, number];
}

async function runDebugGeometryPass(): Promise<DebugGeometryPassResult> {
  const backend = createRapierPhysicsBackend({ gravity: [0, 0, 0] });

  await backend.init();
  backend.sync({
    commands: [
      {
        kind: "upsertBody",
        entity: "box",
        bodyType: PhysicsRigidBodyType.Static,
        transform: {
          translation: [1, 2, 3],
          rotation: [0, 0, 0, 1],
        },
        collider: {
          shape: { kind: "box", halfExtents: [0.5, 1, 1.5] },
        },
      },
      {
        kind: "upsertBody",
        entity: "contact-box",
        bodyType: PhysicsRigidBodyType.Dynamic,
        gravityScale: 0,
        transform: {
          translation: [1.95, 2, 3],
          rotation: [0, 0, 0, 1],
        },
        collider: {
          shape: { kind: "box", halfExtents: [0.5, 1, 1.5] },
          density: 1,
        },
      },
      {
        kind: "upsertJoint",
        entity: "debug-joint",
        joint: {
          kind: "prismatic",
          bodyARef: "box",
          bodyBRef: "contact-box",
          anchorA: [0, 0, 0],
          anchorB: [0, 0, 0],
          axis: [0, 1, 0],
        },
      },
    ],
  });

  try {
    const jointFrameGeometry = backend.debugGeometry?.({
      jointFrames: true,
    }) ?? { lines: [] };

    backend.step(1 / 60, 1);
    const geometry = backend.debugGeometry?.({
      colliderWireframes: true,
      contactNormals: true,
      bodyStateMarkers: true,
      rayProbes: [
        {
          ray: {
            origin: [-2, 2, 3],
            direction: [1, 0, 0],
            maxDistance: 10,
          },
        },
      ],
    }) ?? { lines: [] };
    const contactGeometry = backend.debugGeometry?.({
      contactNormals: true,
    }) ?? { lines: [] };
    const bodyStateGeometry = backend.debugGeometry?.({
      bodyStateMarkers: true,
    }) ?? { lines: [] };
    const broadphaseAabbGeometry = backend.debugGeometry?.({
      broadphaseAabbs: true,
    }) ?? { lines: [] };
    const rayProbeLines = geometry.lines.filter(
      (line) =>
        sameVec3(line.from, [-2, 2, 3]) ||
        (sameColor(line.color, [1, 0.2, 0.12, 1]) &&
          sameVec3(line.from, [0.5, 2, 3])),
    );

    return {
      lineCount: geometry.lines.length,
      rayProbeLines,
      contactNormalLines: contactGeometry.lines,
      bodyStateLines: bodyStateGeometry.lines,
      broadphaseAabbLines: broadphaseAabbGeometry.lines,
      jointFrameLines: jointFrameGeometry.lines,
      firstLine: geometry.lines[0],
    };
  } finally {
    backend.dispose();
  }
}

async function runCollisionContactEventPass(): Promise<CollisionContactEventPassResult> {
  const backend = createRapierPhysicsBackend({ gravity: [0, 0, 0] });

  await backend.init();
  backend.sync({
    commands: [
      {
        kind: "upsertBody",
        entity: "box",
        bodyType: PhysicsRigidBodyType.Static,
        transform: {
          translation: [0, 0, 0],
          rotation: [0, 0, 0, 1],
        },
        collider: {
          shape: { kind: "box", halfExtents: [0.5, 0.5, 0.5] },
        },
      },
      {
        kind: "upsertBody",
        entity: "mover",
        bodyType: PhysicsRigidBodyType.Dynamic,
        gravityScale: 0,
        transform: {
          translation: [0.75, 0, 0],
          rotation: [0, 0, 0, 1],
        },
        velocity: {
          linear: [0, 0, 0],
          angular: [0, 0, 0],
        },
        collider: {
          shape: { kind: "box", halfExtents: [0.5, 0.5, 0.5] },
          density: 1,
        },
      },
    ],
  });

  try {
    backend.step(1 / 60, 1);
    const results = createPhysicsResultBuffer();
    backend.readResults(results);

    const event = results.events.find(
      (candidate) => candidate.kind === "collisionStart",
    );

    expect(event).toBeDefined();
    expect(event?.point).toBeDefined();
    expect(event?.normal).toBeDefined();

    return {
      kind: event?.kind ?? "",
      entityA: event?.entityA ?? "",
      entityB: event?.entityB ?? "",
      point: event?.point ?? [Number.NaN, Number.NaN, Number.NaN],
      normal: event?.normal ?? [Number.NaN, Number.NaN, Number.NaN],
    };
  } finally {
    backend.dispose();
  }
}

async function runCollisionLifecyclePass(): Promise<CollisionLifecyclePassResult> {
  const backend = createRapierPhysicsBackend({ gravity: [0, 0, 0] });

  await backend.init();
  backend.sync({
    commands: [
      collisionLifecycleBoxCommand(),
      collisionLifecycleMoverCommand([0.75, 0, 0]),
    ],
  });

  try {
    const events = [
      ...collisionLifecycleEventsForStep(backend, 1),
      ...collisionLifecycleEventsForStep(backend, 2),
    ];

    backend.sync({
      commands: [
        collisionLifecycleBoxCommand(),
        collisionLifecycleMoverCommand([3, 0, 0]),
      ],
    });
    events.push(...collisionLifecycleEventsForStep(backend, 3));

    return { events };
  } finally {
    backend.dispose();
  }
}

function collisionLifecycleEventsForStep(
  backend: ReturnType<typeof createRapierPhysicsBackend>,
  fixedStep: number,
): CollisionLifecyclePassResult["events"] {
  backend.step(1 / 60, fixedStep);
  const results = createPhysicsResultBuffer();
  backend.readResults(results);

  return results.events
    .filter(
      (event) =>
        event.kind === "collisionStart" ||
        event.kind === "collisionStay" ||
        event.kind === "collisionEnd",
    )
    .map((event) => ({
      kind: event.kind,
      fixedStep: event.fixedStep,
      entityA: event.entityA,
      entityB: event.entityB,
    }));
}

function collisionLifecycleBoxCommand() {
  return {
    kind: "upsertBody" as const,
    entity: "box",
    bodyType: PhysicsRigidBodyType.Static,
    transform: {
      translation: [0, 0, 0] as const,
      rotation: [0, 0, 0, 1] as const,
    },
    collider: {
      shape: { kind: "box" as const, halfExtents: [0.5, 0.5, 0.5] as const },
    },
  };
}

function collisionLifecycleMoverCommand(
  translation: readonly [number, number, number],
) {
  return {
    kind: "upsertBody" as const,
    entity: "mover",
    bodyType: PhysicsRigidBodyType.Dynamic,
    gravityScale: 0,
    transform: {
      translation,
      rotation: [0, 0, 0, 1] as const,
    },
    velocity: {
      linear: [0, 0, 0] as const,
      angular: [0, 0, 0] as const,
    },
    collider: {
      shape: { kind: "box" as const, halfExtents: [0.5, 0.5, 0.5] as const },
      density: 1,
    },
  };
}

async function runContactForceEventPass(): Promise<ContactForceEventPassResult> {
  const backend = createRapierPhysicsBackend({ gravity: [0, -9.81, 0] });

  await backend.init();
  backend.sync({
    commands: [
      {
        kind: "upsertBody",
        entity: "floor",
        bodyType: PhysicsRigidBodyType.Static,
        transform: {
          translation: [0, -0.5, 0],
          rotation: [0, 0, 0, 1],
        },
        collider: {
          shape: { kind: "box", halfExtents: [2, 0.5, 2] },
        },
      },
      {
        kind: "upsertBody",
        entity: "falling",
        bodyType: PhysicsRigidBodyType.Dynamic,
        transform: {
          translation: [0, 1.25, 0],
          rotation: [0, 0, 0, 1],
        },
        velocity: {
          linear: [0, -2, 0],
          angular: [0, 0, 0],
        },
        collider: {
          shape: { kind: "box", halfExtents: [0.5, 0.5, 0.5] },
          density: 1,
          restitution: 0,
        },
      },
    ],
  });

  try {
    const results = createPhysicsResultBuffer();

    for (let fixedStep = 1; fixedStep <= 120; fixedStep += 1) {
      backend.step(1 / 60, fixedStep);
      backend.readResults(results);

      const event = results.events.find(
        (candidate) => candidate.kind === "contactForce",
      );

      if (event !== undefined) {
        expect(event.force).toBeDefined();
        expect(event.normal).toBeDefined();
        expect(event.forceMagnitude).toBeDefined();
        expect(event.maxForceMagnitude).toBeDefined();
        expect(event.impulse).toBeDefined();

        return {
          fixedStep: event.fixedStep,
          entityA: event.entityA,
          entityB: event.entityB,
          force: event.force ?? [Number.NaN, Number.NaN, Number.NaN],
          normal: event.normal ?? [Number.NaN, Number.NaN, Number.NaN],
          forceMagnitude: event.forceMagnitude ?? Number.NaN,
          maxForceMagnitude: event.maxForceMagnitude ?? Number.NaN,
          impulse: event.impulse ?? Number.NaN,
        };
      }
    }

    throw new Error("Expected Rapier to emit a contactForce event.");
  } finally {
    backend.dispose();
  }
}

async function runLinkedBodyContactsPass(
  contactsEnabled: boolean,
): Promise<LinkedBodyContactsPassResult> {
  const backend = createRapierPhysicsBackend({ gravity: [0, 0, 0] });

  await backend.init();
  backend.sync({
    commands: [
      {
        kind: "upsertBody",
        entity: "body-a",
        bodyType: PhysicsRigidBodyType.Dynamic,
        canSleep: false,
        transform: {
          translation: [0, 0, 0],
          rotation: [0, 0, 0, 1],
        },
        collider: {
          shape: { kind: "box", halfExtents: [0.5, 0.5, 0.5] },
          density: 1,
        },
      },
      {
        kind: "upsertBody",
        entity: "body-b",
        bodyType: PhysicsRigidBodyType.Dynamic,
        canSleep: false,
        transform: {
          translation: [0.75, 0, 0],
          rotation: [0, 0, 0, 1],
        },
        collider: {
          shape: { kind: "box", halfExtents: [0.5, 0.5, 0.5] },
          density: 1,
        },
      },
      {
        kind: "upsertJoint",
        entity: "linked-contact-joint",
        joint: {
          kind: "fixed",
          bodyARef: "body-a",
          bodyBRef: "body-b",
          anchorA: [0, 0, 0],
          anchorB: [0, 0, 0],
          axis: [0, 1, 0],
          contactsEnabled,
        },
      },
    ],
  });

  try {
    backend.step(1 / 60, 1);
    const results = createPhysicsResultBuffer();
    backend.readResults(results);

    return {
      events: results.events.map((event) => event.kind),
      contactForces: results.events.filter(
        (event) => event.kind === "contactForce",
      ).length,
    };
  } finally {
    backend.dispose();
  }
}

async function runFixedJointFramePass(): Promise<FixedJointFramePassResult> {
  const backend = createRapierPhysicsBackend({ gravity: [0, 0, 0] });

  await backend.init();
  const sync = backend.sync({
    commands: [
      {
        kind: "upsertBody",
        entity: "anchor",
        bodyType: PhysicsRigidBodyType.Static,
        transform: {
          translation: [0, 0, 0],
          rotation: [0, 0, 0, 1],
        },
        collider: {
          shape: { kind: "sphere", radius: 0.1 },
        },
      },
      {
        kind: "upsertBody",
        entity: "follower",
        bodyType: PhysicsRigidBodyType.Dynamic,
        gravityScale: 0,
        transform: {
          translation: [2, 0, 0],
          rotation: [0, 0, 0, 1],
        },
        collider: {
          shape: { kind: "sphere", radius: 0.1 },
          density: 1,
        },
      },
      {
        kind: "upsertJoint",
        entity: "fixed-frame-joint",
        joint: {
          kind: PhysicsJointKind.Fixed,
          bodyARef: "anchor",
          bodyBRef: "follower",
          anchorA: [0, 0, 0],
          anchorB: [0, 0, 0],
          frameA: [0, 1, 0, 0],
          frameB: [1, 0, 0, 0],
          axis: [0, 1, 0],
        },
      },
    ],
  });

  try {
    return {
      jointCount: sync.jointCount,
      jointFrameLines:
        backend.debugGeometry?.({
          jointFrames: true,
          jointFrameLength: 0.5,
        }).lines ?? [],
    };
  } finally {
    backend.dispose();
  }
}

async function runPrismaticFrameAxisPass(): Promise<PrismaticFrameAxisPassResult> {
  const app = createSimulationApp({
    fixedStep: { fixedDelta: 1 / 60, maxSubsteps: 4 },
    worldOptions: { entityCapacity: 8 },
  });
  const backend = createRapierPhysicsBackend({ gravity: [0, 0, 0] });
  const syncState = createPhysicsWorldSyncState();

  await backend.init();
  registerPhysicsComponents(app.world);

  const anchor = app.spawn(
    withTransform({ translation: [0, -5, 0] }),
    withComponent(
      RigidBody,
      createRigidBody({ type: PhysicsRigidBodyType.Static }),
    ),
    withComponent(
      Collider,
      createCollider({ shape: { kind: "sphere", radius: 0.05 } }),
    ),
  );
  const slider = app.spawn(
    withTransform({ translation: [0, 0, 0] }),
    withComponent(
      RigidBody,
      createRigidBody({
        type: PhysicsRigidBodyType.Dynamic,
        canSleep: false,
      }),
    ),
    withComponent(
      Collider,
      createCollider({
        shape: { kind: "sphere", radius: 0.05 },
        density: 1,
      }),
    ),
    withComponent(
      PhysicsVelocity,
      createPhysicsVelocity({ linear: [1, 0, 0] }),
    ),
  );

  app.spawn(
    withComponent(
      PhysicsJoint,
      createPhysicsJoint({
        kind: PhysicsJointKind.Prismatic,
        bodyARef: serializeEntityRef(anchor),
        bodyBRef: serializeEntityRef(slider),
        anchorA: [0, 5, 0],
        anchorB: [0, 0, 0],
        axis: [0, 1, 0],
        frameA: [0, 0, -0.70710677, 0.70710677],
        minLimit: -0.6,
        maxLimit: 0.6,
      }),
    ),
  );

  let jointCount = 0;
  let jointAxisLine: DebugLine | undefined;

  app.registerFixedStepTask((context) => {
    const report = stepPhysicsWorld({
      world: context.world,
      backend,
      state: syncState,
      fixedDelta: context.fixedDelta,
      fixedStep: context.fixedStep,
    });

    jointCount = report.step.jointCount;
    jointAxisLine = backend.debugGeometry?.({
      jointFrames: true,
      jointFrameLength: 0.5,
    }).lines[1] as DebugLine | undefined;
  });

  try {
    for (let frame = 0; frame < 90; frame += 1) {
      app.step(1 / 60, frame / 60);
    }

    if (jointAxisLine === undefined) {
      throw new Error("Expected a Rapier prismatic joint axis debug line.");
    }

    return {
      jointCount,
      finalSliderX: readLocalX(slider),
      finalSliderY: Array.from(
        slider.getVectorView(LocalTransform, "translation"),
      )[1] as number,
      jointAxisLine,
    };
  } finally {
    backend.dispose();
  }
}

function sameVec3(
  left: readonly [number, number, number],
  right: readonly [number, number, number],
): boolean {
  return (
    Math.abs(left[0] - right[0]) < 0.0001 &&
    Math.abs(left[1] - right[1]) < 0.0001 &&
    Math.abs(left[2] - right[2]) < 0.0001
  );
}

function sameColor(
  left: readonly [number, number, number, number],
  right: readonly [number, number, number, number],
): boolean {
  return (
    Math.abs(left[0] - right[0]) < 0.0001 &&
    Math.abs(left[1] - right[1]) < 0.0001 &&
    Math.abs(left[2] - right[2]) < 0.0001 &&
    Math.abs(left[3] - right[3]) < 0.0001
  );
}

function expectDebugLineClose(
  line: DebugLine | undefined,
  expected: DebugLine,
): void {
  expect(line).toBeDefined();
  expect(line?.color).toEqual(expected.color);
  expect(line?.from[0]).toBeCloseTo(expected.from[0], 5);
  expect(line?.from[1]).toBeCloseTo(expected.from[1], 5);
  expect(line?.from[2]).toBeCloseTo(expected.from[2], 5);
  expect(line?.to[0]).toBeCloseTo(expected.to[0], 5);
  expect(line?.to[1]).toBeCloseTo(expected.to[1], 5);
  expect(line?.to[2]).toBeCloseTo(expected.to[2], 5);
}

function debugLineBounds(lines: readonly DebugLine[]): {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
} {
  if (lines.length === 0) {
    return { min: [0, 0, 0], max: [0, 0, 0] };
  }

  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];

  for (const line of lines) {
    for (const point of [line.from, line.to]) {
      min[0] = Math.min(min[0], point[0]);
      min[1] = Math.min(min[1], point[1]);
      min[2] = Math.min(min[2], point[2]);
      max[0] = Math.max(max[0], point[0]);
      max[1] = Math.max(max[1], point[1]);
      max[2] = Math.max(max[2], point[2]);
    }
  }

  return { min, max };
}

async function runTriggerSensorPass(): Promise<TriggerSensorPassResult> {
  const backend = createRapierPhysicsBackend({ gravity: [0, 0, 0] });

  await backend.init();
  backend.sync({
    commands: [
      {
        kind: "upsertBody",
        entity: "sensor",
        bodyType: PhysicsRigidBodyType.Static,
        transform: {
          translation: [0, 0, 0],
          rotation: [0, 0, 0, 1],
        },
        collider: {
          shape: { kind: "box", halfExtents: [0.5, 0.5, 0.5] },
          sensor: true,
        },
      },
      {
        kind: "upsertBody",
        entity: "mover",
        bodyType: PhysicsRigidBodyType.Dynamic,
        gravityScale: 0,
        transform: {
          translation: [-2, 0, 0],
          rotation: [0, 0, 0, 1],
        },
        velocity: {
          linear: [2, 0, 0],
          angular: [0, 0, 0],
        },
        collider: {
          shape: { kind: "sphere", radius: 0.25 },
          density: 1,
        },
      },
    ],
  });

  try {
    backend.step(1 / 60, 0);
    backend.readResults(createPhysicsResultBuffer());

    const raycastHit = backend.raycastFirst(
      {
        origin: [0, 3, 0],
        direction: [0, -1, 0],
        maxDistance: 10,
      },
      { includeSensors: true },
    );
    const sensorOverlapHits =
      backend.overlapShape?.(
        { kind: "sphere", radius: 0.2 },
        {
          translation: [0, 0, 0],
          rotation: [0, 0, 0, 1],
        },
        { includeSensors: true },
      ) ?? [];
    const defaultOverlapHits =
      backend.overlapShape?.(
        { kind: "sphere", radius: 0.2 },
        {
          translation: [0, 0, 0],
          rotation: [0, 0, 0, 1],
        },
      ) ?? [];
    const sensorShapeCastHit =
      backend.castShapeFirst?.(
        { kind: "sphere", radius: 0.2 },
        {
          from: {
            translation: [0, 3, 0],
            rotation: [0, 0, 0, 1],
          },
          to: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0, 1],
          },
        },
        { includeSensors: true },
      ) ?? null;
    const defaultShapeCastHit =
      backend.castShapeFirst?.(
        { kind: "sphere", radius: 0.2 },
        {
          from: {
            translation: [0, 3, 0],
            rotation: [0, 0, 0, 1],
          },
          to: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0, 1],
          },
        },
      ) ?? null;
    const sensorProjection =
      backend.projectPoint?.([0, 0.75, 0], { includeSensors: true }) ?? null;
    const defaultProjection =
      backend.projectPoint?.([0, 0.75, 0], { excludeEntity: "mover" }) ?? null;
    const events: TriggerSensorPassResult["events"][number][] = [];

    for (let step = 1; step < 121; step += 1) {
      backend.step(1 / 60, step);
      const results = createPhysicsResultBuffer();
      backend.readResults(results);
      events.push(
        ...results.events.map((event) => ({
          kind: event.kind,
          fixedStep: event.fixedStep,
          entityA: event.entityA,
          entityB: event.entityB,
        })),
      );
    }

    return {
      raycastHit,
      sensorOverlapHits,
      defaultOverlapHits,
      sensorShapeCastHit,
      defaultShapeCastHit,
      sensorProjection,
      defaultProjection,
      events,
    };
  } finally {
    backend.dispose();
  }
}

async function runPrimitiveAxisPass(): Promise<PrimitiveAxisPassResult> {
  const backend = createRapierPhysicsBackend({ gravity: [0, 0, 0] });

  await backend.init();
  backend.sync({
    commands: [
      {
        kind: "upsertBody",
        entity: "axis-cylinder",
        bodyType: PhysicsRigidBodyType.Static,
        transform: {
          translation: [0, 0, 0],
          rotation: [0, 0, 0, 1],
        },
        collider: {
          shape: {
            kind: "cylinder",
            radius: 0.25,
            halfHeight: 2,
            axis: PhysicsColliderAxis.X,
          },
        },
      },
      {
        kind: "upsertBody",
        entity: "query-target",
        bodyType: PhysicsRigidBodyType.Static,
        transform: {
          translation: [1.5, 0, 0],
          rotation: [0, 0, 0, 1],
        },
        collider: {
          shape: { kind: "box", halfExtents: [0.05, 0.05, 0.05] },
        },
      },
    ],
  });

  try {
    backend.step(1 / 60, 0);

    const xRaycast = backend.raycastFirst({
      origin: [-4, 0, 0],
      direction: [1, 0, 0],
      maxDistance: 10,
    });
    const yRaycast = backend.raycastFirst({
      origin: [0, -4, 0],
      direction: [0, 1, 0],
      maxDistance: 10,
    });
    const overlapEntities = (
      backend.overlapShape?.(
        {
          kind: "cylinder",
          radius: 0.25,
          halfHeight: 2,
          axis: PhysicsColliderAxis.X,
        },
        {
          translation: [0, 0, 0],
          rotation: [0, 0, 0, 1],
        },
      ) ?? []
    ).map((hit) => hit.entity);
    const shapeCastHit =
      backend.castShapeFirst?.(
        {
          kind: "cylinder",
          radius: 0.25,
          halfHeight: 2,
          axis: PhysicsColliderAxis.X,
        },
        {
          from: {
            translation: [-4, 0, 0],
            rotation: [0, 0, 0, 1],
          },
          to: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0, 1],
          },
        },
        { excludeEntity: "axis-cylinder" },
      ) ?? null;
    const aabbBounds = debugLineBounds(
      backend.debugGeometry?.({ broadphaseAabbs: true }).lines ?? [],
    );

    return { xRaycast, yRaycast, overlapEntities, shapeCastHit, aabbBounds };
  } finally {
    backend.dispose();
  }
}

async function runBouncingBall(): Promise<BouncingBallResult> {
  const app = createSimulationApp({
    fixedStep: { fixedDelta: 1 / 60, maxSubsteps: 4 },
    worldOptions: { entityCapacity: 8 },
  });
  const backend = createRapierPhysicsBackend({ gravity: [0, -9.81, 0] });
  const syncState = createPhysicsWorldSyncState();

  await backend.init();
  registerPhysicsComponents(app.world);

  spawnGround(app);
  const ball = spawnBall(app);
  let bodyStateWrites = 0;
  let transformWrites = 0;

  app.registerFixedStepTask((context) => {
    const report = stepPhysicsWorld({
      world: context.world,
      backend,
      state: syncState,
      fixedDelta: context.fixedDelta,
      fixedStep: context.fixedStep,
    });

    bodyStateWrites += report.writeback.bodyStateWrites;
    transformWrites += report.writeback.transformWrites;
  });

  const heights: number[] = [];

  try {
    for (let frame = 0; frame < 180; frame += 1) {
      app.step(1 / 60, frame / 60);
      heights.push(readLocalY(ball));
    }

    const minHeight = Math.min(...heights);
    const minIndex = heights.indexOf(minHeight);
    const postImpactMaxHeight = Math.max(...heights.slice(minIndex + 1));

    expect(ball.hasComponent(PhysicsBodyState)).toBe(true);

    return {
      startHeight: heights[0] ?? 0,
      minHeight,
      postImpactMaxHeight,
      finalHeight: heights.at(-1) ?? 0,
      finalVelocityY: readVelocityY(ball),
      bodyStateWrites,
      transformWrites,
    };
  } finally {
    backend.dispose();
  }
}

async function runDistanceJointPass(): Promise<DistanceJointPassResult> {
  const app = createSimulationApp({
    fixedStep: { fixedDelta: 1 / 60, maxSubsteps: 4 },
    worldOptions: { entityCapacity: 8 },
  });
  const backend = createRapierPhysicsBackend({ gravity: [0, -9.81, 0] });
  const syncState = createPhysicsWorldSyncState();

  await backend.init();
  registerPhysicsComponents(app.world);

  const anchor = app.spawn(
    withTransform({ translation: [0, 0, 0] }),
    withComponent(
      RigidBody,
      createRigidBody({ type: PhysicsRigidBodyType.Static }),
    ),
    withComponent(
      Collider,
      createCollider({ shape: { kind: "sphere", radius: 0.1 } }),
    ),
  );
  const bob = app.spawn(
    withTransform({ translation: [2, 0, 0] }),
    withComponent(
      RigidBody,
      createRigidBody({
        type: PhysicsRigidBodyType.Dynamic,
        canSleep: false,
      }),
    ),
    withComponent(
      Collider,
      createCollider({
        shape: { kind: "sphere", radius: 0.2 },
        density: 1,
      }),
    ),
    withComponent(PhysicsVelocity, createPhysicsVelocity()),
  );

  app.spawn(
    withComponent(
      PhysicsJoint,
      createPhysicsJoint({
        kind: PhysicsJointKind.Distance,
        bodyARef: serializeEntityRef(anchor),
        bodyBRef: serializeEntityRef(bob),
        maxLimit: 2,
      }),
    ),
  );

  let jointCount = 0;

  app.registerFixedStepTask((context) => {
    const report = stepPhysicsWorld({
      world: context.world,
      backend,
      state: syncState,
      fixedDelta: context.fixedDelta,
      fixedStep: context.fixedStep,
    });

    jointCount = report.step.jointCount;
  });

  let maxAnchorDistance = 0;

  try {
    for (let frame = 0; frame < 180; frame += 1) {
      app.step(1 / 60, frame / 60);
      maxAnchorDistance = Math.max(
        maxAnchorDistance,
        distanceBetween(anchor, bob),
      );
    }

    return {
      jointCount,
      maxAnchorDistance,
      finalBobY: readLocalY(bob),
    };
  } finally {
    backend.dispose();
  }
}

async function runDisabledDistanceJointPass(): Promise<DisabledDistanceJointPassResult> {
  const app = createSimulationApp({
    fixedStep: { fixedDelta: 1 / 60, maxSubsteps: 4 },
    worldOptions: { entityCapacity: 8 },
  });
  const backend = createRapierPhysicsBackend({ gravity: [0, -9.81, 0] });
  const syncState = createPhysicsWorldSyncState();

  await backend.init();
  registerPhysicsComponents(app.world);

  const anchor = app.spawn(
    withTransform({ translation: [0, 0, 0] }),
    withComponent(
      RigidBody,
      createRigidBody({ type: PhysicsRigidBodyType.Static }),
    ),
    withComponent(
      Collider,
      createCollider({ shape: { kind: "sphere", radius: 0.1 } }),
    ),
  );
  const bob = app.spawn(
    withTransform({ translation: [2, 0, 0] }),
    withComponent(
      RigidBody,
      createRigidBody({
        type: PhysicsRigidBodyType.Dynamic,
        canSleep: false,
      }),
    ),
    withComponent(
      Collider,
      createCollider({
        shape: { kind: "sphere", radius: 0.2 },
        density: 1,
      }),
    ),
    withComponent(PhysicsVelocity, createPhysicsVelocity()),
  );
  const joint = app.spawn(
    withComponent(
      PhysicsJoint,
      createPhysicsJoint({
        kind: PhysicsJointKind.Distance,
        bodyARef: serializeEntityRef(anchor),
        bodyBRef: serializeEntityRef(bob),
        maxLimit: 2,
      }),
    ),
  );

  let latestJointCount = 0;

  app.registerFixedStepTask((context) => {
    const report = stepPhysicsWorld({
      world: context.world,
      backend,
      state: syncState,
      fixedDelta: context.fixedDelta,
      fixedStep: context.fixedStep,
    });

    latestJointCount = report.step.jointCount;
  });

  let maxBeforeDisableDistance = 0;
  let maxAfterDisableDistance = 0;

  try {
    for (let frame = 0; frame < 90; frame += 1) {
      app.step(1 / 60, frame / 60);
      maxBeforeDisableDistance = Math.max(
        maxBeforeDisableDistance,
        distanceBetween(anchor, bob),
      );
    }

    const jointCountBeforeDisable = latestJointCount;

    joint.setValue(PhysicsJoint, "enabled", false);

    for (let frame = 90; frame < 210; frame += 1) {
      app.step(1 / 60, frame / 60);
      maxAfterDisableDistance = Math.max(
        maxAfterDisableDistance,
        distanceBetween(anchor, bob),
      );
    }

    return {
      jointCountBeforeDisable,
      jointCountAfterDisable: latestJointCount,
      maxBeforeDisableDistance,
      maxAfterDisableDistance,
    };
  } finally {
    backend.dispose();
  }
}

async function runPrismaticLimitPass(): Promise<PrismaticLimitPassResult> {
  const app = createSimulationApp({
    fixedStep: { fixedDelta: 1 / 60, maxSubsteps: 4 },
    worldOptions: { entityCapacity: 8 },
  });
  const backend = createRapierPhysicsBackend({ gravity: [0, 0, 0] });
  const syncState = createPhysicsWorldSyncState();

  await backend.init();
  registerPhysicsComponents(app.world);

  const anchor = app.spawn(
    withTransform({ translation: [0, -5, 0] }),
    withComponent(
      RigidBody,
      createRigidBody({ type: PhysicsRigidBodyType.Static }),
    ),
    withComponent(
      Collider,
      createCollider({ shape: { kind: "sphere", radius: 0.05 } }),
    ),
  );
  const slider = app.spawn(
    withTransform({ translation: [0, 0, 0] }),
    withComponent(
      RigidBody,
      createRigidBody({
        type: PhysicsRigidBodyType.Dynamic,
        canSleep: false,
      }),
    ),
    withComponent(
      Collider,
      createCollider({
        shape: { kind: "sphere", radius: 0.05 },
        density: 1,
      }),
    ),
    withComponent(
      PhysicsVelocity,
      createPhysicsVelocity({ linear: [4, 0, 0] }),
    ),
  );

  app.spawn(
    withComponent(
      PhysicsJoint,
      createPhysicsJoint({
        kind: PhysicsJointKind.Prismatic,
        bodyARef: serializeEntityRef(anchor),
        bodyBRef: serializeEntityRef(slider),
        anchorA: [0, 5, 0],
        anchorB: [0, 0, 0],
        axis: [1, 0, 0],
        minLimit: -0.4,
        maxLimit: 0.4,
      }),
    ),
  );

  let jointCount = 0;
  let maxSliderX = 0;

  app.registerFixedStepTask((context) => {
    const report = stepPhysicsWorld({
      world: context.world,
      backend,
      state: syncState,
      fixedDelta: context.fixedDelta,
      fixedStep: context.fixedStep,
    });

    jointCount = report.step.jointCount;
  });

  try {
    for (let frame = 0; frame < 180; frame += 1) {
      app.step(1 / 60, frame / 60);
      maxSliderX = Math.max(maxSliderX, Math.abs(readLocalX(slider)));
    }

    return {
      jointCount,
      maxSliderX,
      finalSliderX: readLocalX(slider),
    };
  } finally {
    backend.dispose();
  }
}

async function runPrismaticMotorPass(): Promise<PrismaticMotorPassResult> {
  const app = createSimulationApp({
    fixedStep: { fixedDelta: 1 / 60, maxSubsteps: 4 },
    worldOptions: { entityCapacity: 8 },
  });
  const backend = createRapierPhysicsBackend({ gravity: [0, 0, 0] });
  const syncState = createPhysicsWorldSyncState();

  await backend.init();
  registerPhysicsComponents(app.world);

  const anchor = app.spawn(
    withTransform({ translation: [0, -5, 0] }),
    withComponent(
      RigidBody,
      createRigidBody({ type: PhysicsRigidBodyType.Static }),
    ),
    withComponent(
      Collider,
      createCollider({ shape: { kind: "sphere", radius: 0.05 } }),
    ),
  );
  const slider = app.spawn(
    withTransform({ translation: [0, 0, 0] }),
    withComponent(
      RigidBody,
      createRigidBody({
        type: PhysicsRigidBodyType.Dynamic,
        canSleep: false,
      }),
    ),
    withComponent(
      Collider,
      createCollider({
        shape: { kind: "sphere", radius: 0.05 },
        density: 1,
      }),
    ),
    withComponent(PhysicsVelocity, createPhysicsVelocity()),
  );

  app.spawn(
    withComponent(
      PhysicsJoint,
      createPhysicsJoint({
        kind: PhysicsJointKind.Prismatic,
        bodyARef: serializeEntityRef(anchor),
        bodyBRef: serializeEntityRef(slider),
        anchorA: [0, 5, 0],
        anchorB: [0, 0, 0],
        axis: [1, 0, 0],
        minLimit: -0.5,
        maxLimit: 0.5,
        motorTarget: 0.35,
        motorStiffness: 30,
        motorDamping: 8,
      }),
    ),
  );

  let jointCount = 0;
  const startSliderX = readLocalX(slider);

  app.registerFixedStepTask((context) => {
    const report = stepPhysicsWorld({
      world: context.world,
      backend,
      state: syncState,
      fixedDelta: context.fixedDelta,
      fixedStep: context.fixedStep,
    });

    jointCount = report.step.jointCount;
  });

  try {
    for (let frame = 0; frame < 240; frame += 1) {
      app.step(1 / 60, frame / 60);
    }

    return {
      jointCount,
      startSliderX,
      finalSliderX: readLocalX(slider),
    };
  } finally {
    backend.dispose();
  }
}

async function runPrismaticCombinedMotorPass(): Promise<PrismaticCombinedMotorPassResult> {
  const app = createSimulationApp({
    fixedStep: { fixedDelta: 1 / 60, maxSubsteps: 4 },
    worldOptions: { entityCapacity: 8 },
  });
  const backend = createRapierPhysicsBackend({ gravity: [0, 0, 0] });
  const syncState = createPhysicsWorldSyncState();

  await backend.init();
  registerPhysicsComponents(app.world);

  const anchor = app.spawn(
    withTransform({ translation: [0, -5, 0] }),
    withComponent(
      RigidBody,
      createRigidBody({ type: PhysicsRigidBodyType.Static }),
    ),
    withComponent(
      Collider,
      createCollider({ shape: { kind: "sphere", radius: 0.05 } }),
    ),
  );
  const slider = app.spawn(
    withTransform({ translation: [0, 0, 0] }),
    withComponent(
      RigidBody,
      createRigidBody({
        type: PhysicsRigidBodyType.Dynamic,
        canSleep: false,
      }),
    ),
    withComponent(
      Collider,
      createCollider({
        shape: { kind: "sphere", radius: 0.05 },
        density: 1,
      }),
    ),
  );

  app.spawn(
    withComponent(
      PhysicsJoint,
      createPhysicsJoint({
        kind: PhysicsJointKind.Prismatic,
        bodyARef: serializeEntityRef(anchor),
        bodyBRef: serializeEntityRef(slider),
        anchorA: [0, 5, 0],
        anchorB: [0, 0, 0],
        axis: [1, 0, 0],
        minLimit: -1.2,
        maxLimit: 1.2,
        motorMode: "position",
        motorTarget: 0,
        motorVelocity: 0.7,
        motorStiffness: 0,
        motorDamping: 7,
      }),
    ),
  );

  let jointCount = 0;
  const startSliderX = readLocalX(slider);

  app.registerFixedStepTask((context) => {
    const report = stepPhysicsWorld({
      world: context.world,
      backend,
      state: syncState,
      fixedDelta: context.fixedDelta,
      fixedStep: context.fixedStep,
    });

    jointCount = report.step.jointCount;
  });

  try {
    for (let frame = 0; frame < 180; frame += 1) {
      app.step(1 / 60, frame / 60);
    }

    return {
      jointCount,
      startSliderX,
      finalSliderX: readLocalX(slider),
    };
  } finally {
    backend.dispose();
  }
}

async function runPrismaticVelocityMotorPass(): Promise<PrismaticVelocityMotorPassResult> {
  const app = createSimulationApp({
    fixedStep: { fixedDelta: 1 / 60, maxSubsteps: 4 },
    worldOptions: { entityCapacity: 8 },
  });
  const backend = createRapierPhysicsBackend({ gravity: [0, 0, 0] });
  const syncState = createPhysicsWorldSyncState();

  await backend.init();
  registerPhysicsComponents(app.world);

  const anchor = app.spawn(
    withTransform({ translation: [0, -5, 0] }),
    withComponent(
      RigidBody,
      createRigidBody({ type: PhysicsRigidBodyType.Static }),
    ),
    withComponent(
      Collider,
      createCollider({ shape: { kind: "sphere", radius: 0.05 } }),
    ),
  );
  const slider = app.spawn(
    withTransform({ translation: [0, 0, 0] }),
    withComponent(
      RigidBody,
      createRigidBody({
        type: PhysicsRigidBodyType.Dynamic,
        canSleep: false,
      }),
    ),
    withComponent(
      Collider,
      createCollider({
        shape: { kind: "sphere", radius: 0.05 },
        density: 1,
      }),
    ),
  );

  app.spawn(
    withComponent(
      PhysicsJoint,
      createPhysicsJoint({
        kind: PhysicsJointKind.Prismatic,
        bodyARef: serializeEntityRef(anchor),
        bodyBRef: serializeEntityRef(slider),
        anchorA: [0, 5, 0],
        anchorB: [0, 0, 0],
        axis: [1, 0, 0],
        minLimit: -1.8,
        maxLimit: 1.8,
        motorMode: "velocity",
        motorModel: "force",
        motorVelocity: 0.65,
        motorFactor: 6,
      }),
    ),
  );

  let jointCount = 0;
  const startSliderX = readLocalX(slider);

  app.registerFixedStepTask((context) => {
    const report = stepPhysicsWorld({
      world: context.world,
      backend,
      state: syncState,
      fixedDelta: context.fixedDelta,
      fixedStep: context.fixedStep,
    });

    jointCount = report.step.jointCount;
  });

  try {
    for (let frame = 0; frame < 180; frame += 1) {
      app.step(1 / 60, frame / 60);
    }

    return {
      jointCount,
      startSliderX,
      finalSliderX: readLocalX(slider),
    };
  } finally {
    backend.dispose();
  }
}

interface TestGeometryProviderOptions {
  readonly triangleMeshes?: ReadonlyMap<string, PhysicsTriangleMeshGeometry>;
  readonly heightfields?: ReadonlyMap<string, PhysicsHeightfieldGeometry>;
}

function createGeometryProvider(
  options: TestGeometryProviderOptions = {},
): PhysicsColliderGeometryProvider {
  return {
    triangleMesh(meshId) {
      const geometry = options.triangleMeshes?.get(meshId);

      if (geometry === undefined) {
        return {
          ok: false,
          error: {
            code: "physics.collider.asset.missing",
            feature: "collider.triangleMesh",
            message: `Test triangle mesh geometry '${meshId}' is not registered.`,
            suggestedFix:
              "Register triangle mesh geometry in the test provider before syncing asset-backed colliders.",
            details: { assetId: meshId },
          },
        };
      }

      return { ok: true, geometry };
    },
    heightfield(assetId) {
      const geometry = options.heightfields?.get(assetId);

      if (geometry === undefined) {
        return {
          ok: false,
          error: {
            code: "physics.collider.asset.missing",
            feature: "collider.heightfield",
            message: `Test heightfield geometry '${assetId}' is not registered.`,
            suggestedFix:
              "Register heightfield geometry in the test provider before syncing asset-backed colliders.",
            details: { assetId },
          },
        };
      }

      return { ok: true, geometry };
    },
  };
}

function tetrahedronGeometry(key: string): PhysicsTriangleMeshGeometry {
  return {
    key,
    positions: new Float32Array([
      0, 0, 1, 0.942809, 0, -0.333333, -0.471405, 0.816497, -0.333333,
      -0.471405, -0.816497, -0.333333,
    ]),
    indices: new Uint32Array([0, 1, 2, 0, 3, 1, 0, 2, 3, 1, 3, 2]),
    vertexCount: 4,
    triangleCount: 4,
  };
}

function flatQuadGeometry(key: string): PhysicsTriangleMeshGeometry {
  return {
    key,
    positions: new Float32Array([-2, 0, -2, 2, 0, -2, -2, 0, 2, 2, 0, 2]),
    indices: new Uint32Array([0, 2, 1, 2, 3, 1]),
    vertexCount: 4,
    triangleCount: 2,
  };
}

function flatHeightfield(key: string): PhysicsHeightfieldGeometry {
  return {
    key,
    rows: 2,
    columns: 2,
    heights: new Float32Array([0, 0, 0, 0]),
    scale: [4, 1, 4],
  };
}

function spawnGround(app: ReturnType<typeof createSimulationApp>): Entity {
  return app.spawn(
    withTransform({ translation: [0, -0.5, 0] }),
    withComponent(
      RigidBody,
      createRigidBody({ type: PhysicsRigidBodyType.Static }),
    ),
    withComponent(
      Collider,
      createCollider({
        shape: { kind: "box", halfExtents: [6, 0.5, 6] },
        friction: 0.8,
        restitution: 0.8,
      }),
    ),
  );
}

function spawnBall(app: ReturnType<typeof createSimulationApp>): Entity {
  return app.spawn(
    withTransform({ translation: [0, 4, 0] }),
    withComponent(
      RigidBody,
      createRigidBody({
        type: PhysicsRigidBodyType.Dynamic,
        canSleep: false,
      }),
    ),
    withComponent(
      Collider,
      createCollider({
        shape: { kind: "sphere", radius: 0.5 },
        density: 1,
        friction: 0.2,
        restitution: 0.8,
      }),
    ),
    withComponent(PhysicsVelocity, createPhysicsVelocity()),
  );
}

function readLocalY(entity: Entity): number {
  return entity.getVectorView(LocalTransform, "translation")[1] ?? 0;
}

function readLocalX(entity: Entity): number {
  return entity.getVectorView(LocalTransform, "translation")[0] ?? 0;
}

function distanceBetween(left: Entity, right: Entity): number {
  const leftTranslation = left.getVectorView(LocalTransform, "translation");
  const rightTranslation = right.getVectorView(LocalTransform, "translation");

  return Math.hypot(
    (leftTranslation[0] ?? 0) - (rightTranslation[0] ?? 0),
    (leftTranslation[1] ?? 0) - (rightTranslation[1] ?? 0),
    (leftTranslation[2] ?? 0) - (rightTranslation[2] ?? 0),
  );
}

function readVelocityY(entity: Entity): number {
  return entity.getVectorView(PhysicsVelocity, "linear")[1] ?? 0;
}

function readVelocityX(entity: Entity): number {
  return entity.getVectorView(PhysicsVelocity, "linear")[0] ?? 0;
}
