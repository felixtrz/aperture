import { describe, expect, it } from "vitest";
import {
  Collider,
  PHYSICS_WORKER_PROTOCOL,
  PhysicsJoint,
  PhysicsRigidBodyType,
  PhysicsVelocity,
  PhysicsWorkerTransferError,
  RigidBody,
  createCollider,
  createPhysicsGravity,
  createPhysicsJoint,
  createPhysicsVelocity,
  createPhysicsWorkerActionMessage,
  createPhysicsWorkerActionResultMessage,
  createPhysicsWorkerBackendEndpoint,
  createPhysicsWorkerResultMessage,
  createPhysicsWorkerStepMessage,
  createPhysicsWorkerTransferProxy,
  createPhysicsWorldSyncState,
  createRigidBody,
  registerPhysicsComponents,
  PhysicsGravity,
  type PhysicsBackend,
  type PhysicsCharacterMoveResult,
  type PhysicsEvent,
  type PhysicsPointProjection,
  type PhysicsRaycastHit,
  type PhysicsReadbackReport,
  type PhysicsResultBuffer,
  type PhysicsShapeCastHit,
  type PhysicsStepReport,
  type PhysicsWorkerActionMessage,
  type PhysicsWorkerMessageWithTransfer,
  type PhysicsWorkerOutboundMessage,
  type PhysicsWorkerStepMessage,
  type PhysicsWorkerTransferEndpoint,
} from "@aperture-engine/physics";
import {
  LocalTransform,
  createLocalTransform,
  createWorld,
  serializeEntityRef,
  type EcsWorld,
  type Entity,
} from "@aperture-engine/simulation";

describe("physics worker transfer proxy protocol paths", () => {
  it("steps through a fake endpoint, decodes results, and reports transport latency", async () => {
    const { world, body } = createPhysicsWorldFixture();
    const bodyRef = serializeEntityRef(body);
    const ghostRef = "ghost-é𐍈→:0";
    const event: PhysicsEvent = {
      kind: "collisionStart",
      frame: 5,
      fixedStep: 5,
      substep: 0,
      entityA: bodyRef,
      entityB: ghostRef,
      colliderA: bodyRef,
      colliderB: ghostRef,
      point: [1, 2, 3],
    };
    const results: PhysicsResultBuffer = {
      bodies: [
        {
          entity: bodyRef,
          transform: {
            translation: [4, 5, 6],
            rotation: [0, 0, 0, 1],
          },
          velocity: {
            linear: [1, 0, 0],
            angular: [0, 0, 0],
          },
          sleeping: false,
        },
        {
          entity: ghostRef,
          transform: {
            translation: [9, 9, 9],
            rotation: [0, 0, 0, 1],
          },
          velocity: {
            linear: [0, 0, 0],
            angular: [0, 0, 0],
          },
          sleeping: true,
        },
      ],
      events: [event],
    };
    const stepRequests: PhysicsWorkerStepMessage[] = [];
    const endpoint: PhysicsWorkerTransferEndpoint = {
      step(request) {
        stepRequests.push(request.message);
        return createPhysicsWorkerResultMessage({
          fixedStep: 5,
          step: createStepReportFixture(5),
          readback: { bodyCount: 2, eventCount: 1 },
          results,
        });
      },
    };
    const proxy = createPhysicsWorkerTransferProxy(endpoint);
    const report = await proxy.stepWorld({
      world,
      state: createPhysicsWorldSyncState(),
      fixedDelta: 1 / 60,
      fixedStep: 7,
    });

    expect(stepRequests).toHaveLength(1);
    expect(stepRequests[0]).toMatchObject({
      type: PHYSICS_WORKER_PROTOCOL.step,
      fixedDelta: 1 / 60,
      fixedStep: 7,
    });
    expect(report.commands).toEqual({
      commandCount: 3,
      upsertBodyCount: 1,
      destroyBodyCount: 0,
      upsertJointCount: 1,
      destroyJointCount: 0,
      otherCommandCount: 1,
    });
    expect(report.step.fixedStep).toBe(5);
    expect(report.readback).toEqual({ bodyCount: 2, eventCount: 1 });
    expect(report.writeback).toMatchObject({
      bodyCount: 2,
      transformWrites: 1,
      missingEntities: 1,
    });
    expect(
      Array.from(body.getVectorView(LocalTransform, "translation")),
    ).toEqual([4, 5, 6]);
    expect(report.events).toEqual([event]);
    expect(report.transport).toMatchObject({
      mode: "physics-worker-transferable",
      submittedFixedStep: 7,
      completedFixedStep: 5,
      latencyFrames: 2,
      resultEventCount: 1,
      resultSleepingBytes: 2,
    });
    expect(report.transport.structuredCloneBytes).toBe(
      Buffer.byteLength(bodyRef, "utf8") +
        Buffer.byteLength(ghostRef, "utf8") +
        Buffer.byteLength(JSON.stringify(event), "utf8"),
    );
    expect(report.transport.totalResultBytes).toBe(
      report.transport.transferBytes + report.transport.structuredCloneBytes,
    );
  });

  it("emits destroy commands when bodies and joints disappear between steps", async () => {
    const { world, body, joint } = createPhysicsWorldFixture();
    const state = createPhysicsWorldSyncState();
    const endpoint = createEmptyResultEndpoint();
    const proxy = createPhysicsWorkerTransferProxy(endpoint);

    const first = await proxy.stepWorld({
      world,
      state,
      fixedDelta: 1 / 60,
      fixedStep: 1,
    });
    body.setValue(RigidBody, "enabled", false);
    joint.setValue(PhysicsJoint, "enabled", false);
    const second = await proxy.stepWorld({
      world,
      state,
      fixedDelta: 1 / 60,
      fixedStep: 2,
    });

    expect(first.commands).toMatchObject({
      upsertBodyCount: 1,
      upsertJointCount: 1,
      otherCommandCount: 1,
    });
    expect(second.commands).toEqual({
      commandCount: 3,
      upsertBodyCount: 0,
      destroyBodyCount: 1,
      upsertJointCount: 0,
      destroyJointCount: 1,
      otherCommandCount: 1,
    });
    expect(second.writeback).toMatchObject({ bodyCount: 0 });
  });

  it("rethrows worker error messages from step responses with diagnostics", async () => {
    const { world } = createPhysicsWorldFixture();
    const endpoint: PhysicsWorkerTransferEndpoint = {
      step() {
        return {
          message: {
            type: PHYSICS_WORKER_PROTOCOL.error,
            reason: "custom.step-error",
            message: "step exploded",
            diagnostics: [{ code: "boom" }],
          },
          transfer: [],
        };
      },
    };
    const proxy = createPhysicsWorkerTransferProxy(endpoint);
    const stepPromise = proxy.stepWorld({
      world,
      fixedDelta: 1 / 60,
      fixedStep: 1,
    });

    await expect(stepPromise).rejects.toThrow("step exploded");
    const error = await stepPromise.catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(PhysicsWorkerTransferError);
    expect(error).toMatchObject({
      name: "PhysicsWorkerTransferError",
      reason: "custom.step-error",
      diagnostics: [{ code: "boom" }],
    });
  });

  it("rejects step responses that are not step results", async () => {
    const { world } = createPhysicsWorldFixture();
    const endpoint: PhysicsWorkerTransferEndpoint = {
      step() {
        return createPhysicsWorkerActionResultMessage({
          requestId: 1,
          result: { kind: "sleepBody", changed: true },
        });
      },
    };
    const proxy = createPhysicsWorkerTransferProxy(endpoint);
    const stepPromise = proxy.stepWorld({
      world,
      fixedDelta: 1 / 60,
      fixedStep: 1,
    });

    await expect(stepPromise).rejects.toMatchObject({
      name: "PhysicsWorkerTransferError",
      reason: "physics-worker-transfer.invalid-step-response",
      message: expect.stringContaining(PHYSICS_WORKER_PROTOCOL.actionResult),
    });
  });

  it("rejects query actions when the endpoint has no action handler", async () => {
    const endpoint: PhysicsWorkerTransferEndpoint = {
      step: createEmptyResultEndpoint().step,
    };
    const proxy = createPhysicsWorkerTransferProxy(endpoint);

    await expect(
      proxy.raycastFirst({ origin: [0, 0, 0], direction: [0, -1, 0] }),
    ).rejects.toMatchObject({
      name: "PhysicsWorkerTransferError",
      reason: "physics-worker-transfer.unsupported-action-endpoint",
    });
  });

  it("rethrows action error responses and rejects mismatched action replies", async () => {
    const errorEndpoint = createActionEndpoint(() => ({
      message: {
        type: PHYSICS_WORKER_PROTOCOL.error,
        reason: "custom.action-error",
        message: "action exploded",
        requestId: 1,
      },
      transfer: [],
    }));
    const invalidEndpoint = createActionEndpoint(() =>
      createPhysicsWorkerResultMessage({
        fixedStep: 1,
        step: createStepReportFixture(1),
        readback: { bodyCount: 0, eventCount: 0 },
        results: { bodies: [], events: [] },
      }),
    );

    await expect(
      createPhysicsWorkerTransferProxy(errorEndpoint).sleepBody("1:0"),
    ).rejects.toMatchObject({
      name: "PhysicsWorkerTransferError",
      reason: "custom.action-error",
      message: "action exploded",
    });
    await expect(
      createPhysicsWorkerTransferProxy(invalidEndpoint).wakeBody("1:0"),
    ).rejects.toMatchObject({
      name: "PhysicsWorkerTransferError",
      reason: "physics-worker-transfer.invalid-action-response",
      message: expect.stringContaining(PHYSICS_WORKER_PROTOCOL.result),
    });
  });

  it("round-trips raycastAll, castShapeFirst, projectPoint, and moveCharacter queries", async () => {
    const raycastHit: PhysicsRaycastHit = {
      entity: "1:0",
      collider: "1:0",
      point: [0, 1, 0],
      normal: [0, 1, 0],
      distance: 2,
    };
    const shapeCastHit: PhysicsShapeCastHit = {
      entity: "2:0",
      timeOfImpact: 0.25,
      point: [0, 0.5, 0],
      normal: [0, 1, 0],
    };
    const projection: PhysicsPointProjection = {
      entity: "3:0",
      point: [0, 0, 0],
      normal: [0, 1, 0],
      distance: 1,
      inside: false,
    };
    const moveResult: PhysicsCharacterMoveResult = {
      entity: "4:0",
      desiredTranslation: [1, 0, 0],
      movement: [0.5, 0, 0],
      targetTranslation: [0.5, 0, 0],
      grounded: true,
      collisions: [],
    };
    const backend = {
      raycastAll: () => [raycastHit],
      castShapeFirst: () => shapeCastHit,
      projectPoint: () => projection,
      moveCharacter: () => moveResult,
    } as unknown as PhysicsBackend;
    const requestIds: number[] = [];
    const backendEndpoint = createPhysicsWorkerBackendEndpoint(backend);
    const endpoint: PhysicsWorkerTransferEndpoint = {
      step: backendEndpoint.step,
      action(request) {
        requestIds.push(request.message.requestId);
        if (backendEndpoint.action === undefined) {
          throw new Error("Backend endpoint is missing an action handler.");
        }
        return backendEndpoint.action(request);
      },
    };
    const proxy = createPhysicsWorkerTransferProxy(endpoint);

    await expect(
      proxy.raycastAll({ origin: [0, 2, 0], direction: [0, -1, 0] }),
    ).resolves.toEqual([raycastHit]);
    await expect(
      proxy.castShapeFirst(
        { kind: "sphere", radius: 0.5 },
        {
          from: { translation: [0, 2, 0], rotation: [0, 0, 0, 1] },
          to: { translation: [0, 0, 0], rotation: [0, 0, 0, 1] },
        },
        { includeSensors: true },
      ),
    ).resolves.toEqual(shapeCastHit);
    await expect(
      proxy.projectPoint([0, 0.5, 0], { includeSensors: false }),
    ).resolves.toEqual(projection);
    await expect(
      proxy.moveCharacter({
        entity: "4:0",
        desiredTranslation: [1, 0, 0],
      }),
    ).resolves.toEqual(moveResult);
    expect(requestIds).toEqual([1, 2, 3, 4]);
  });

  it("falls back to empty results when action replies carry a mismatched kind", async () => {
    const endpoint = createActionEndpoint((request) =>
      createPhysicsWorkerActionResultMessage({
        requestId: request.message.requestId,
        result: { kind: "sleepBody", changed: true },
      }),
    );
    const proxy = createPhysicsWorkerTransferProxy(endpoint);

    await expect(
      proxy.raycastAll({ origin: [0, 0, 0], direction: [0, -1, 0] }),
    ).resolves.toEqual([]);
    await expect(proxy.projectPoint([0, 0, 0])).resolves.toBeNull();
    await expect(proxy.debugGeometry()).resolves.toEqual({ lines: [] });
  });

  it("answers mismatched backend endpoint requests with invalid-request errors", async () => {
    const backend = {} as unknown as PhysicsBackend;
    const endpoint = createPhysicsWorkerBackendEndpoint(backend);
    const actionRequest = createPhysicsWorkerActionMessage({
      requestId: 9,
      action: { kind: "sleepBody", entity: "1:0" },
    });
    const stepRequest = createPhysicsWorkerStepMessage({
      fixedDelta: 1 / 60,
      fixedStep: 1,
      commands: { commands: [] },
    });

    const stepResponse = await endpoint.step(
      actionRequest as unknown as PhysicsWorkerMessageWithTransfer<PhysicsWorkerStepMessage>,
    );
    expect(stepResponse.message).toMatchObject({
      type: PHYSICS_WORKER_PROTOCOL.error,
      reason: "physics-worker-transfer.invalid-request",
      message: expect.stringContaining(PHYSICS_WORKER_PROTOCOL.action),
    });

    if (endpoint.action === undefined) {
      throw new Error("Backend endpoint is missing an action handler.");
    }
    const actionResponse = await endpoint.action(
      stepRequest as unknown as PhysicsWorkerMessageWithTransfer<PhysicsWorkerActionMessage>,
    );
    expect(actionResponse.message).toMatchObject({
      type: PHYSICS_WORKER_PROTOCOL.error,
      reason: "physics-worker-transfer.invalid-request",
      message: expect.stringContaining(PHYSICS_WORKER_PROTOCOL.step),
    });
  });

  it("converts backend failures into protocol error messages", async () => {
    const backend = {
      sync() {
        throw new Error("sync failed hard");
      },
      raycastFirst() {
        throw new Error("raycast failed hard");
      },
    } as unknown as PhysicsBackend;
    const endpoint = createPhysicsWorkerBackendEndpoint(backend);

    const stepResponse = await endpoint.step(
      createPhysicsWorkerStepMessage({
        fixedDelta: 1 / 60,
        fixedStep: 3,
        commands: { commands: [] },
      }),
    );
    expect(stepResponse.message).toEqual({
      type: PHYSICS_WORKER_PROTOCOL.error,
      reason: "physics-worker-transfer.backend-error",
      message: "sync failed hard",
    });

    if (endpoint.action === undefined) {
      throw new Error("Backend endpoint is missing an action handler.");
    }
    const actionResponse = await endpoint.action(
      createPhysicsWorkerActionMessage({
        requestId: 11,
        action: {
          kind: "raycastFirst",
          ray: { origin: [0, 0, 0], direction: [0, -1, 0] },
        },
      }),
    );
    expect(actionResponse.message).toEqual({
      type: PHYSICS_WORKER_PROTOCOL.error,
      reason: "physics-worker-transfer.backend-error",
      requestId: 11,
      message: "raycast failed hard",
    });
  });

  it("exposes constructor defaults on PhysicsWorkerTransferError", () => {
    const error = new PhysicsWorkerTransferError("plain failure");

    expect(error.name).toBe("PhysicsWorkerTransferError");
    expect(error.reason).toBe("physics-worker-transfer.error");
    expect(error.diagnostics).toBeUndefined();
  });
});

function createPhysicsWorldFixture(): {
  readonly world: EcsWorld;
  readonly body: Entity;
  readonly joint: Entity;
  readonly gravity: Entity;
} {
  const world = createWorld({ entityCapacity: 8 });
  registerPhysicsComponents(world);
  world.registerComponent(LocalTransform);

  const body = world.createEntity();
  body.addComponent(
    LocalTransform,
    createLocalTransform({ translation: [0, 0, 0], rotation: [0, 0, 0, 1] }),
  );
  body.addComponent(
    RigidBody,
    createRigidBody({ type: PhysicsRigidBodyType.Dynamic }),
  );
  body.addComponent(
    Collider,
    createCollider({ shape: { kind: "sphere", radius: 0.5 } }),
  );
  body.addComponent(
    PhysicsVelocity,
    createPhysicsVelocity({ linear: [1, 0, 0] }),
  );

  const joint = world.createEntity();
  joint.addComponent(
    PhysicsJoint,
    createPhysicsJoint({
      bodyARef: serializeEntityRef(body),
      bodyBRef: serializeEntityRef(body),
    }),
  );

  const gravity = world.createEntity();
  gravity.addComponent(
    PhysicsGravity,
    createPhysicsGravity({ gravity: [0, -5, 0] }),
  );

  return { world, body, joint, gravity };
}

function createEmptyResultEndpoint(): PhysicsWorkerTransferEndpoint {
  return {
    step(request) {
      return createPhysicsWorkerResultMessage({
        fixedStep: request.message.fixedStep,
        step: createStepReportFixture(request.message.fixedStep),
        readback: {
          bodyCount: 0,
          eventCount: 0,
        } satisfies PhysicsReadbackReport,
        results: { bodies: [], events: [] },
      });
    },
  };
}

function createActionEndpoint(
  respond: (
    request: PhysicsWorkerMessageWithTransfer<PhysicsWorkerActionMessage>,
  ) => PhysicsWorkerMessageWithTransfer<PhysicsWorkerOutboundMessage>,
): PhysicsWorkerTransferEndpoint {
  return {
    step: createEmptyResultEndpoint().step,
    action(request) {
      return respond(request);
    },
  };
}

function createStepReportFixture(fixedStep: number): PhysicsStepReport {
  return {
    enabled: true,
    backend: "test",
    backendVersion: "0.0.0-test",
    backendBuild: "test",
    execution: "physics-worker-transferable",
    fixedDelta: 1 / 60,
    fixedStep,
    bodyCount: 1,
    colliderCount: 1,
    jointCount: 1,
    eventCount: 0,
    queryCount: 0,
    syncToBackendMs: 0,
    backendStepMs: 0,
    writebackMs: 0,
  };
}
