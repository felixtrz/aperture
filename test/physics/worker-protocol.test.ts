import { describe, expect, it } from "vitest";
import {
  PHYSICS_TRANSFERABLE_BODY_FLOAT_STRIDE,
  PHYSICS_WORKER_PROTOCOL,
  collectPhysicsResultTransferables,
  createPhysicsWorkerResultMessage,
  createPhysicsWorkerStepMessage,
  decodePhysicsResultPacket,
  encodePhysicsResultPacket,
  type PhysicsResultBuffer,
} from "@aperture-engine/physics";

describe("physics worker protocol", () => {
  it("encodes body writeback into transferable result packets", () => {
    const results = createResultFixture();

    const packet = encodePhysicsResultPacket(results);
    const transfer = collectPhysicsResultTransferables(packet);
    const decoded = decodePhysicsResultPacket(packet);

    expect(packet.bodyEntities).toEqual(["1:0", "2:0"]);
    expect(packet.bodyFloats).toHaveLength(
      2 * PHYSICS_TRANSFERABLE_BODY_FLOAT_STRIDE,
    );
    expect(packet.bodySleeping).toEqual(new Uint8Array([0, 1]));
    expect(transfer).toEqual([
      packet.bodyFloats.buffer,
      packet.bodySleeping.buffer,
    ]);
    expect(decoded).toEqual(results);
  });

  it("copies events so worker packet mutation cannot rewrite the source buffer", () => {
    const results = createResultFixture();
    const packet = encodePhysicsResultPacket(results);

    (packet.events[0]?.point as number[] | undefined)?.fill(99);
    (packet.events[0]?.force as number[] | undefined)?.fill(99);

    expect(results.events[0]?.point).toEqual([1, 2, 3]);
    expect(results.events[0]?.force).toEqual([4, 5, 6]);
  });

  it("builds explicit step/result messages for transferable worker mode", () => {
    const step = createPhysicsWorkerStepMessage({
      fixedDelta: 1 / 60,
      fixedStep: 12,
      commands: { commands: [] },
    });
    const result = createPhysicsWorkerResultMessage({
      fixedStep: 12,
      step: {
        enabled: true,
        backend: "test",
        backendVersion: "0.0.0-test",
        backendBuild: "test",
        execution: "physics-worker-transferable",
        fixedDelta: 1 / 60,
        fixedStep: 12,
        bodyCount: 2,
        colliderCount: 2,
        jointCount: 1,
        eventCount: 1,
        queryCount: 0,
        syncToBackendMs: 0,
        backendStepMs: 0,
        writebackMs: 0,
      },
      readback: { bodyCount: 2, eventCount: 1 },
      results: createResultFixture(),
    });

    expect(step.message.type).toBe(PHYSICS_WORKER_PROTOCOL.step);
    expect(step.transfer).toEqual([]);
    expect(result.message.type).toBe(PHYSICS_WORKER_PROTOCOL.result);
    expect(result.transfer).toHaveLength(2);
    expect(
      decodePhysicsResultPacket(result.message.results).bodies,
    ).toHaveLength(2);
  });

  it("rejects malformed transferable result body buffers", () => {
    const packet = encodePhysicsResultPacket(createResultFixture());

    expect(() =>
      decodePhysicsResultPacket({
        ...packet,
        bodyFloats: packet.bodyFloats.slice(1),
      }),
    ).toThrow("bodyFloats length mismatch");
    expect(() =>
      decodePhysicsResultPacket({
        ...packet,
        bodySleeping: packet.bodySleeping.slice(1),
      }),
    ).toThrow("bodySleeping length mismatch");
  });
});

function createResultFixture(): PhysicsResultBuffer {
  return {
    bodies: [
      {
        entity: "1:0",
        transform: {
          translation: [1, 2, 3],
          rotation: [0, 0, 0, 1],
        },
        velocity: {
          linear: [4, 5, 6],
          angular: [7, 8, 9],
        },
        sleeping: false,
      },
      {
        entity: "2:0",
        transform: {
          translation: [-1, -2, -3],
          rotation: [0.125, 0.25, 0.5, 0.75],
        },
        velocity: {
          linear: [-4, -5, -6],
          angular: [-7, -8, -9],
        },
        sleeping: true,
      },
    ],
    events: [
      {
        kind: "collisionStart",
        frame: 12,
        fixedStep: 12,
        substep: 0,
        entityA: "1:0",
        entityB: "2:0",
        colliderA: "1:0",
        colliderB: "2:0",
        point: [1, 2, 3],
        normal: [0, 1, 0],
        force: [4, 5, 6],
        forceMagnitude: 8.77,
        maxForceMagnitude: 6.5,
        impulse: 0.5,
      },
    ],
  };
}
