import { describe, expect, it } from "vitest";
import {
  Collider,
  PhysicsRigidBodyType,
  PhysicsVelocity,
  RigidBody,
  createCollider,
  createPhysicsVelocity,
  createPhysicsWorkerBackendEndpoint,
  createPhysicsWorkerTransferProxy,
  createPhysicsWorldSyncState,
  createRigidBody,
  registerPhysicsComponents,
  type PhysicsWorkerMessageWithTransfer,
  type PhysicsWorkerOutboundMessage,
  type PhysicsWorkerStepMessage,
} from "@aperture-engine/physics";
import { createTestPhysicsBackend } from "@aperture-engine/physics/testing";
import {
  LocalTransform,
  createLocalTransform,
  createWorld,
  serializeEntityRef,
} from "@aperture-engine/simulation";

describe("physics worker transferable proxy", () => {
  it("applies transferred worker results to ECS at fixed-step boundaries", async () => {
    const world = createWorld({ entityCapacity: 4 });
    registerPhysicsComponents(world);
    world.registerComponent(LocalTransform);

    const body = world.createEntity();
    body.addComponent(
      LocalTransform,
      createLocalTransform({
        translation: [0, 0, 0],
        rotation: [0, 0, 0, 1],
      }),
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
      createPhysicsVelocity({ linear: [2, 0, 0] }),
    );

    const backend = createTestPhysicsBackend({
      execution: "physics-worker-transferable",
    });
    backend.init({ execution: "physics-worker-transferable" });
    const endpoint = createStructuredCloneEndpoint(
      createPhysicsWorkerBackendEndpoint(backend),
    );
    const proxy = createPhysicsWorkerTransferProxy(endpoint);
    const report = await proxy.stepWorld({
      world,
      state: createPhysicsWorldSyncState(),
      fixedDelta: 0.5,
      fixedStep: 8,
    });

    expect(proxy.execution).toBe("physics-worker-transferable");
    expect(report.commands).toMatchObject({
      commandCount: 1,
      upsertBodyCount: 1,
    });
    expect(report.step).toMatchObject({
      execution: "physics-worker-transferable",
      fixedStep: 8,
      bodyCount: 1,
    });
    expect(report.readback).toMatchObject({ bodyCount: 1, eventCount: 0 });
    expect(report.writeback).toMatchObject({
      bodyCount: 1,
      transformWrites: 1,
      velocityWrites: 1,
      bodyStateWrites: 1,
      missingEntities: 0,
    });
    expect(
      Array.from(body.getVectorView(LocalTransform, "translation")),
    ).toEqual([1, 0, 0]);
    expect(Array.from(body.getVectorView(PhysicsVelocity, "linear"))).toEqual([
      2, 0, 0,
    ]);
    expect(report.transport).toMatchObject({
      mode: "physics-worker-transferable",
      submittedFixedStep: 8,
      completedFixedStep: 8,
      latencyFrames: 0,
      resultEventCount: 0,
    });
    expect(report.transport.transferBytes).toBeGreaterThan(0);
    expect(report.transport.resultBodyBytes).toBeGreaterThan(0);
    expect(report.transport.resultSleepingBytes).toBe(1);
    expect(report.transport.structuredCloneBytes).toBe(
      serializeEntityRef(body).length,
    );
    expect(report.transport.totalResultBytes).toBe(
      report.transport.transferBytes + report.transport.structuredCloneBytes,
    );
    expect(report.events).toEqual([]);
  });
});

function createStructuredCloneEndpoint(endpoint: {
  step(
    request: PhysicsWorkerMessageWithTransfer<PhysicsWorkerStepMessage>,
  ):
    | PhysicsWorkerMessageWithTransfer<PhysicsWorkerOutboundMessage>
    | Promise<PhysicsWorkerMessageWithTransfer<PhysicsWorkerOutboundMessage>>;
}) {
  return {
    async step(
      request: PhysicsWorkerMessageWithTransfer<PhysicsWorkerStepMessage>,
    ): Promise<PhysicsWorkerMessageWithTransfer<PhysicsWorkerOutboundMessage>> {
      const response = await endpoint.step(request);
      return {
        message: structuredClone(response.message, {
          transfer: response.transfer,
        }),
        transfer: [],
      };
    },
  };
}
