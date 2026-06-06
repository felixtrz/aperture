import { describe, expect, it } from "vitest";
import {
  ExternalForce,
  ExternalImpulse,
  KinematicTarget,
  PhysicsJoint,
  PhysicsJointKind,
  PhysicsVelocity,
  PhysicsRigidBodyType,
  createPhysicsJoint,
  createPhysicsResultBuffer,
  registerPhysicsComponents,
  type PhysicsEvent,
  type PhysicsSyncReport,
  type PhysicsUnsupportedFeature,
  type PhysicsWorldStepReport,
} from "@aperture-engine/physics";
import { createTestPhysicsBackend } from "@aperture-engine/physics/testing";
import {
  AssetRegistry,
  LocalTransform,
  createLocalTransform,
  createWorld,
  serializeEntityRef,
} from "@aperture-engine/simulation";
import { createApertureSystemContext } from "@aperture-engine/app/systems";

describe("physics system access", () => {
  it("returns empty query results until a backend is installed", () => {
    const context = createApertureSystemContext({
      world: createWorld(),
      assetsRegistry: new AssetRegistry(),
    });

    expect(
      context.physics.raycastFirst({
        origin: [0, 0, 0],
        direction: [1, 0, 0],
      }),
    ).toBeNull();
    expect(
      context.physics.raycastAll({
        origin: [0, 0, 0],
        direction: [1, 0, 0],
      }),
    ).toEqual([]);
    expect(
      context.physics.overlapShape(
        { kind: "sphere", radius: 0.5 },
        {
          translation: [0, 0, 0],
          rotation: [0, 0, 0, 1],
        },
      ),
    ).toEqual([]);
    expect(
      context.physics.castShapeFirst(
        { kind: "sphere", radius: 0.25 },
        {
          from: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0, 1],
          },
          to: {
            translation: [1, 0, 0],
            rotation: [0, 0, 0, 1],
          },
        },
      ),
    ).toBeNull();
    expect(context.physics.projectPoint([0, 0, 0])).toBeNull();
    expect(
      context.physics.moveCharacter({
        entity: "character",
        desiredTranslation: [1, 0, 0],
      }),
    ).toBeNull();
    expect(context.physics.events()).toEqual([]);
    expect(context.physics.debugGeometry({ colliderWireframes: true })).toEqual(
      {
        lines: [],
      },
    );
  });

  it("reports backend capabilities through physics summaries", () => {
    const context = createApertureSystemContext({
      world: createWorld(),
      assetsRegistry: new AssetRegistry(),
    });
    const backend = createTestPhysicsBackend();

    context.physics.setBackend(backend);

    const summary = context.physics.summary();

    expect(summary.backend).toMatchObject({
      kind: "test",
      build: "test",
      execution: "simulation-worker",
      capabilities: {
        compoundColliders: true,
        continuousCollisionDetection: false,
        characterController: true,
        linkedBodyContacts: false,
        combinedPositionVelocityMotors: false,
        motorForceLimits: false,
        automaticBreakForce: false,
        jointImpulseReadback: false,
        pairedNonFixedFrameB: false,
      },
    });
    expect(summary.backend?.capabilities).not.toBe(backend.capabilities);
  });

  it("authors fixed-step physics command components through gameplay helpers", () => {
    const world = createWorld({ entityCapacity: 2 });
    const context = createApertureSystemContext({
      world,
      assetsRegistry: new AssetRegistry(),
    });
    const body = world.createEntity();

    body.addComponent(LocalTransform, createLocalTransform());

    context.physics.applyForce(body, [1, 0, 0], {
      point: [0, 1, 0],
      torque: [0, 0, 2],
    });
    context.physics.applyImpulse(body, [0, 2, 0], {
      angularImpulse: [0, 0, 3],
    });
    context.physics.setLinearVelocity(body, [4, 0, 0]);
    context.physics.setAngularVelocity(body, [0, 5, 0]);
    context.physics.setKinematicTarget(body, {
      translation: [6, 0, 0],
      rotation: [0, 0, 0, 1],
    });

    expect(Array.from(body.getVectorView(ExternalForce, "force"))).toEqual([
      1,
      0,
      0,
    ]);
    expect(Array.from(body.getVectorView(ExternalForce, "torque"))).toEqual([
      0,
      0,
      1,
    ]);
    expect(Array.from(body.getVectorView(ExternalImpulse, "impulse"))).toEqual([
      0,
      2,
      0,
    ]);
    expect(
      Array.from(body.getVectorView(ExternalImpulse, "angularImpulse")),
    ).toEqual([0, 0, 3]);
    expect(Array.from(body.getVectorView(PhysicsVelocity, "linear"))).toEqual([
      4,
      0,
      0,
    ]);
    expect(Array.from(body.getVectorView(PhysicsVelocity, "angular"))).toEqual([
      0,
      5,
      0,
    ]);
    expect(Array.from(body.getVectorView(KinematicTarget, "translation"))).toEqual([
      6,
      0,
      0,
    ]);
    expect(body.getValue(KinematicTarget, "enabled")).toBe(true);
  });

  it("breaks ECS-authored joints explicitly and emits a jointBreak event", () => {
    const world = createWorld({ entityCapacity: 3 });
    const context = createApertureSystemContext({
      world,
      assetsRegistry: new AssetRegistry(),
    });
    registerPhysicsComponents(world);
    const bodyA = world.createEntity();
    const bodyB = world.createEntity();
    const joint = world.createEntity();
    const bodyARef = serializeEntityRef(bodyA);
    const bodyBRef = serializeEntityRef(bodyB);
    const jointRef = serializeEntityRef(joint);

    joint.addComponent(
      PhysicsJoint,
      createPhysicsJoint({
        kind: PhysicsJointKind.Fixed,
        bodyARef,
        bodyBRef,
      }),
    );

    expect(context.physics.breakJoint(joint, { fixedStep: 7 })).toBe(true);
    expect(joint.getValue(PhysicsJoint, "enabled")).toBe(false);
    expect(context.physics.breakJoint(joint, { fixedStep: 8 })).toBe(false);
    expect(context.physics.summary()).toMatchObject({
      eventCount: 1,
      eventKinds: {
        jointBreak: 1,
      },
      eventFamilies: {
        jointBreaks: 1,
      },
      events: [
        expect.objectContaining({
          kind: "jointBreak",
          fixedStep: 7,
          joint: jointRef,
          entityA: bodyARef,
          entityB: bodyBRef,
        }),
      ],
    });
  });

  it("provides filtered gameplay event views while preserving events()", () => {
    const context = createApertureSystemContext({
      world: createWorld(),
      assetsRegistry: new AssetRegistry(),
    });
    const events: readonly PhysicsEvent[] = [
      physicsEvent("collisionStart"),
      physicsEvent("collisionStay"),
      physicsEvent("collisionEnd"),
      physicsEvent("triggerEnter"),
      physicsEvent("triggerStay"),
      physicsEvent("triggerExit"),
      physicsEvent("sleep"),
      physicsEvent("wake"),
      physicsEvent("contactForce"),
      physicsEvent("controllerGroundedChanged"),
      physicsEvent("jointBreak"),
    ];

    context.physics.setEvents(events);

    expect(context.physics.events()).toHaveLength(events.length);
    expect(context.physics.events.all()).toEqual(context.physics.events());
    expect(context.physics.events.byKind("triggerEnter")).toEqual([
      expect.objectContaining({ kind: "triggerEnter" }),
    ]);
    expect(context.physics.events.contacts().map((event) => event.kind)).toEqual(
      ["collisionEnd", "collisionStart", "collisionStay", "contactForce"],
    );
    expect(context.physics.events.collisionStarted()).toEqual([
      expect.objectContaining({ kind: "collisionStart" }),
    ]);
    expect(context.physics.events.collisionStayed()).toEqual([
      expect.objectContaining({ kind: "collisionStay" }),
    ]);
    expect(context.physics.events.collisionEnded()).toEqual([
      expect.objectContaining({ kind: "collisionEnd" }),
    ]);
    expect(context.physics.events.triggerEntered()).toEqual([
      expect.objectContaining({ kind: "triggerEnter" }),
    ]);
    expect(context.physics.events.triggerStayed()).toEqual([
      expect.objectContaining({ kind: "triggerStay" }),
    ]);
    expect(context.physics.events.triggerExited()).toEqual([
      expect.objectContaining({ kind: "triggerExit" }),
    ]);
    expect(context.physics.events.sleeping()).toEqual([
      expect.objectContaining({ kind: "sleep" }),
    ]);
    expect(context.physics.events.waking()).toEqual([
      expect.objectContaining({ kind: "wake" }),
    ]);
    expect(context.physics.events.contactForces()).toEqual([
      expect.objectContaining({ kind: "contactForce" }),
    ]);
    expect(context.physics.events.controllerGroundedChanged()).toEqual([
      expect.objectContaining({ kind: "controllerGroundedChanged" }),
    ]);
    expect(context.physics.events.jointBroken()).toEqual([
      expect.objectContaining({ kind: "jointBreak" }),
    ]);
    expect(context.physics.summary().eventFamilies).toEqual({
      contacts: 4,
      collisions: 3,
      triggers: 3,
      sleepWake: 2,
      contactForces: 1,
      controllerGroundedChanged: 1,
      jointBreaks: 1,
    });

    context.physics.clearEvents();

    expect(context.physics.events()).toEqual([]);
    expect(context.physics.events.triggerEntered()).toEqual([]);
  });

  it("publishes frame sync reports and unsupported features in the physics summary", () => {
    const context = createApertureSystemContext({
      world: createWorld(),
      assetsRegistry: new AssetRegistry(),
    });
    const syncReport: PhysicsSyncReport = {
      commandCount: 3,
      bodyCount: 2,
      colliderCount: 2,
      jointCount: 1,
      unsupportedFeatureCount: 1,
      unsupportedFeatures: [
        {
          code: "physics.joint.frameB.unsupported",
          feature: "joint.frameB",
          backend: "rapier",
          entity: "3:0",
          message:
            "The active physics backend cannot encode a paired body-B joint frame for this non-fixed joint kind.",
          suggestedFix:
            "Keep frameB identity for non-fixed joints or use the current frameA-oriented unit-axis semantics.",
        },
      ],
    };

    context.physics.setSyncReport(syncReport);
    const summary = context.physics.summary();

    expect(summary).toMatchObject({
      sync: {
        commandCount: 3,
        bodyCount: 2,
        colliderCount: 2,
        jointCount: 1,
        unsupportedFeatureCount: 1,
        unsupportedFeatures: [
          expect.objectContaining({
            code: "physics.joint.frameB.unsupported",
            feature: "joint.frameB",
            backend: "rapier",
            entity: "3:0",
          }),
        ],
      },
      unsupportedFeatureCount: 1,
      unsupportedFeatures: [
        expect.objectContaining({
          code: "physics.joint.frameB.unsupported",
          feature: "joint.frameB",
        }),
      ],
    });

    (syncReport.unsupportedFeatures as PhysicsUnsupportedFeature[])[0] = {
      code: "physics.joint.breakForce.unsupported",
      feature: "joint.breakForce",
      backend: "rapier",
      entity: "3:0",
      message: "Mutated source report.",
      suggestedFix: "The previously captured summary should not change.",
    };

    expect(summary.unsupportedFeatures[0]).toMatchObject({
      code: "physics.joint.frameB.unsupported",
      feature: "joint.frameB",
    });

    context.physics.clearEvents();

    expect(context.physics.summary()).toMatchObject({
      sync: null,
      step: null,
      readback: null,
      writeback: null,
      unsupportedFeatureCount: 0,
      unsupportedFeatures: [],
    });
  });

  it("publishes fixed-step readback and ECS writeback reports in the physics summary", () => {
    const context = createApertureSystemContext({
      world: createWorld(),
      assetsRegistry: new AssetRegistry(),
    });
    const report: PhysicsWorldStepReport = {
      sync: {
        commandCount: 4,
        bodyCount: 2,
        colliderCount: 2,
        jointCount: 0,
        unsupportedFeatureCount: 0,
        unsupportedFeatures: [],
      },
      step: {
        enabled: true,
        backend: "test",
        backendVersion: "test",
        backendBuild: "test",
        execution: "simulation-worker",
        fixedDelta: 1 / 60,
        fixedStep: 12,
        bodyCount: 2,
        colliderCount: 2,
        jointCount: 0,
        eventCount: 1,
        queryCount: 3,
        syncToBackendMs: 0.1,
        backendStepMs: 0.2,
        writebackMs: 0.3,
      },
      readback: {
        bodyCount: 2,
        eventCount: 1,
      },
      writeback: {
        bodyCount: 2,
        transformWrites: 2,
        velocityWrites: 1,
        bodyStateWrites: 2,
        missingEntities: 0,
      },
      events: [physicsEvent("triggerEnter")],
    };

    context.physics.setStepReport(report);

    expect(context.physics.summary()).toMatchObject({
      sync: {
        commandCount: 4,
        bodyCount: 2,
      },
      step: {
        backend: "test",
        backendBuild: "test",
        execution: "simulation-worker",
        fixedStep: 12,
        bodyCount: 2,
        queryCount: 3,
      },
      readback: {
        bodyCount: 2,
        eventCount: 1,
      },
      writeback: {
        bodyCount: 2,
        transformWrites: 2,
        velocityWrites: 1,
        bodyStateWrites: 2,
        missingEntities: 0,
      },
      eventCount: 1,
      eventKinds: {
        triggerEnter: 1,
      },
    });
    expect(context.physics.events.triggerEntered()).toEqual([
      expect.objectContaining({ kind: "triggerEnter" }),
    ]);

    context.physics.clearEvents();

    expect(context.physics.summary()).toMatchObject({
      sync: null,
      step: null,
      readback: null,
      writeback: null,
      eventCount: 0,
    });
  });

  it("forwards synchronous raycasts and frame events from the installed backend", () => {
    const context = createApertureSystemContext({
      world: createWorld(),
      assetsRegistry: new AssetRegistry(),
    });
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
    backend.step(1 / 60, 4);

    const results = createPhysicsResultBuffer();
    backend.readResults(results);

    context.physics.setBackend(backend);
    context.physics.setEvents(results.events);

    expect(
      context.physics.raycastFirst({
        origin: [0, 0, 0],
        direction: [1, 0, 0],
        maxDistance: 10,
      }),
    ).toMatchObject({
      entity: "1:0",
      distance: 1.5,
    });
    expect(
      context.physics.raycastAll({
        origin: [0, 0, 0],
        direction: [1, 0, 0],
        maxDistance: 10,
      }),
    ).toHaveLength(1);
    expect(
      context.physics.overlapShape(
        { kind: "sphere", radius: 0.6 },
        {
          translation: [2, 0, 0],
          rotation: [0, 0, 0, 1],
        },
      ),
    ).toEqual([{ entity: "1:0", collider: "1:0" }]);
    expect(
      context.physics.overlapShape(
        { kind: "sphere", radius: 0.6 },
        {
          translation: [2, 0, 0],
          rotation: [0, 0, 0, 1],
        },
        { excludeEntity: "1:0" },
      ),
    ).toEqual([]);
    const shapeCastHit = context.physics.castShapeFirst(
      { kind: "sphere", radius: 0.25 },
      {
        from: {
          translation: [0, 0, 0],
          rotation: [0, 0, 0, 1],
        },
        to: {
          translation: [3, 0, 0],
          rotation: [0, 0, 0, 1],
        },
      },
    );

    expect(shapeCastHit).toMatchObject({
      entity: "1:0",
      point: [1.5, 0, 0],
      normal: [-1, 0, 0],
    });
    expect(shapeCastHit?.timeOfImpact).toBeCloseTo(1.25 / 3, 6);
    expect(
      context.physics.castShapeFirst(
        { kind: "sphere", radius: 0.25 },
        {
          from: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0, 1],
          },
          to: {
            translation: [3, 0, 0],
            rotation: [0, 0, 0, 1],
          },
        },
        { excludeEntity: "1:0" },
      ),
    ).toBeNull();
    const projection = context.physics.projectPoint([2.8, 0, 0]);

    expect(projection).toMatchObject({
      entity: "1:0",
      point: [2.5, 0, 0],
      normal: [1, 0, 0],
      inside: false,
    });
    expect(projection?.distance).toBeCloseTo(0.3, 6);
    expect(
      context.physics.projectPoint([2.8, 0, 0], { excludeEntity: "1:0" }),
    ).toBeNull();
    expect(context.physics.events()).toEqual([
      expect.objectContaining({
        kind: "triggerEnter",
        fixedStep: 4,
        entityA: "1:0",
        entityB: "2:0",
      }),
    ]);
    expect(context.physics.events.triggerEntered()).toEqual([
      expect.objectContaining({
        kind: "triggerEnter",
        fixedStep: 4,
        entityA: "1:0",
        entityB: "2:0",
      }),
    ]);
    expect(
      context.physics.debugGeometry({
        colliderWireframes: true,
        rayProbes: [
          {
            ray: {
              origin: [0, 0, 0],
              direction: [1, 0, 0],
              maxDistance: 10,
            },
          },
        ],
      }).lines,
    ).toEqual([
      {
        from: [1.5, 0, 0],
        to: [2.5, 0, 0],
        color: [0.2, 0.8, 1, 1],
      },
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
    ]);
    expect(
      context.physics.debugSummary({
        colliderWireframes: true,
        rayProbes: [
          {
            ray: {
              origin: [0, 0, 0],
              direction: [1, 0, 0],
              maxDistance: 10,
            },
          },
        ],
      }),
    ).toEqual({
      lineCount: 3,
      finiteLineCount: 3,
      invalidLineCount: 0,
      colorCount: 3,
      colors: [
        { color: [0.2, 0.8, 1, 1], lineCount: 1 },
        { color: [1, 0.2, 0.12, 1], lineCount: 1 },
        { color: [1, 0.86, 0.12, 1], lineCount: 1 },
      ],
      bounds: {
        min: [0, 0, 0],
        max: [2.5, 0, 0],
      },
    });

    backend.sync({
      commands: [
        {
          kind: "upsertBody",
          entity: "character",
          bodyType: PhysicsRigidBodyType.KinematicPosition,
          transform: {
            translation: [0, 1, 0],
            rotation: [0, 0, 0, 1],
          },
          radius: 0.5,
        },
        {
          kind: "upsertBody",
          entity: "wall",
          bodyType: PhysicsRigidBodyType.Static,
          transform: {
            translation: [1, 1, 0],
            rotation: [0, 0, 0, 1],
          },
          radius: 0.5,
        },
      ],
    });
    expect(
      context.physics.moveCharacter({
        entity: "character",
        desiredTranslation: [2, 0, 1],
      }),
    ).toMatchObject({
      entity: "character",
      movement: [0, 0, 1],
      targetTranslation: [0, 1, 1],
    });

    context.physics.clearEvents();
    expect(context.physics.events()).toEqual([]);
  });

  it("emits grounded-change events from app-level character movement edges", () => {
    const context = createApertureSystemContext({
      world: createWorld(),
      assetsRegistry: new AssetRegistry(),
    });
    const backend = createTestPhysicsBackend();

    backend.init();
    context.physics.setBackend(backend);
    backend.sync({
      commands: [
        {
          kind: "upsertBody",
          entity: "floor",
          bodyType: PhysicsRigidBodyType.Static,
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0, 1],
          },
          radius: 0.5,
        },
        {
          kind: "upsertBody",
          entity: "character",
          bodyType: PhysicsRigidBodyType.KinematicPosition,
          transform: {
            translation: [0, 1, 0],
            rotation: [0, 0, 0, 1],
          },
          radius: 0.5,
        },
      ],
    });

    expect(
      context.physics.moveCharacter({
        entity: "character",
        desiredTranslation: [0, 0, 0],
        settings: { snapToGroundDistance: 0.05 },
      })?.grounded,
    ).toBe(true);
    expect(context.physics.events()).toEqual([]);

    backend.sync({ commands: [{ kind: "destroyBody", entity: "floor" }] });
    expect(
      context.physics.moveCharacter({
        entity: "character",
        desiredTranslation: [0, 0, 0],
        settings: { snapToGroundDistance: 0.05 },
      })?.grounded,
    ).toBe(false);
    expect(context.physics.events()).toEqual([
      expect.objectContaining({
        kind: "controllerGroundedChanged",
        entityA: "character",
        entityB: "character",
        grounded: false,
      }),
    ]);
    expect(context.physics.events.controllerGroundedChanged()).toEqual([
      expect.objectContaining({
        kind: "controllerGroundedChanged",
        entityA: "character",
        grounded: false,
      }),
    ]);

    context.physics.clearEvents();
    backend.sync({
      commands: [
        {
          kind: "upsertBody",
          entity: "floor",
          bodyType: PhysicsRigidBodyType.Static,
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0, 1],
          },
          radius: 0.5,
        },
      ],
    });
    expect(
      context.physics.moveCharacter({
        entity: "character",
        desiredTranslation: [0, 0, 0],
        settings: { snapToGroundDistance: 0.05 },
      })?.grounded,
    ).toBe(true);
    expect(context.physics.summary()).toMatchObject({
      eventCount: 1,
      eventKinds: {
        controllerGroundedChanged: 1,
      },
      eventFamilies: {
        controllerGroundedChanged: 1,
      },
      events: [
        expect.objectContaining({
          kind: "controllerGroundedChanged",
          entityA: "character",
          grounded: true,
        }),
      ],
    });
  });
});

function physicsEvent(kind: PhysicsEvent["kind"]): PhysicsEvent {
  return {
    kind,
    frame: 0,
    fixedStep: 1,
    substep: 0,
    entityA: `${kind}:a`,
    entityB: `${kind}:b`,
    colliderA: `${kind}:a`,
    colliderB: `${kind}:b`,
  };
}
