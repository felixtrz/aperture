import { createPhysicsResultBuffer } from "./backend.js";
export const PHYSICS_WORKER_PROTOCOL = {
    init: "aperture.physics.init",
    step: "aperture.physics.step",
    action: "aperture.physics.action",
    result: "aperture.physics.result",
    actionResult: "aperture.physics.actionResult",
    error: "aperture.physics.error",
    dispose: "aperture.physics.dispose",
};
export const PHYSICS_TRANSFERABLE_BODY_FLOAT_STRIDE = 13;
export function createPhysicsWorkerStepMessage(input) {
    return {
        message: {
            type: PHYSICS_WORKER_PROTOCOL.step,
            fixedDelta: input.fixedDelta,
            fixedStep: input.fixedStep,
            commands: input.commands,
        },
        transfer: [],
    };
}
export function createPhysicsWorkerActionMessage(input) {
    return {
        message: {
            type: PHYSICS_WORKER_PROTOCOL.action,
            requestId: input.requestId,
            action: input.action,
        },
        transfer: [],
    };
}
export function createPhysicsWorkerResultMessage(input) {
    const packet = encodePhysicsResultPacket(input.results);
    return {
        message: {
            type: PHYSICS_WORKER_PROTOCOL.result,
            fixedStep: input.fixedStep,
            step: input.step,
            readback: input.readback,
            results: packet,
        },
        transfer: collectPhysicsResultTransferables(packet),
    };
}
export function createPhysicsWorkerActionResultMessage(input) {
    return {
        message: {
            type: PHYSICS_WORKER_PROTOCOL.actionResult,
            requestId: input.requestId,
            result: input.result,
        },
        transfer: [],
    };
}
export function encodePhysicsResultPacket(results) {
    const bodyEntities = [];
    const bodyFloats = new Float32Array(results.bodies.length * PHYSICS_TRANSFERABLE_BODY_FLOAT_STRIDE);
    const bodySleeping = new Uint8Array(results.bodies.length);
    results.bodies.forEach((body, index) => {
        bodyEntities.push(body.entity);
        writeBodyFloats(bodyFloats, index, body.transform, body.velocity);
        bodySleeping[index] = body.sleeping ? 1 : 0;
    });
    return {
        bodyEntities,
        bodyFloats,
        bodySleeping,
        events: results.events.map(clonePhysicsEvent),
    };
}
export function decodePhysicsResultPacket(packet, out = createPhysicsResultBuffer()) {
    const bodyCount = packet.bodyEntities.length;
    const expectedFloats = bodyCount * PHYSICS_TRANSFERABLE_BODY_FLOAT_STRIDE;
    if (packet.bodyFloats.length !== expectedFloats) {
        throw new Error(`Physics worker result packet bodyFloats length mismatch: expected ${expectedFloats}, received ${packet.bodyFloats.length}.`);
    }
    if (packet.bodySleeping.length !== bodyCount) {
        throw new Error(`Physics worker result packet bodySleeping length mismatch: expected ${bodyCount}, received ${packet.bodySleeping.length}.`);
    }
    out.bodies.length = 0;
    out.events.length = 0;
    for (let index = 0; index < bodyCount; index += 1) {
        out.bodies.push({
            entity: packet.bodyEntities[index] ?? "",
            transform: readBodyTransform(packet.bodyFloats, index),
            velocity: readBodyVelocity(packet.bodyFloats, index),
            sleeping: packet.bodySleeping[index] !== 0,
        });
    }
    out.events.push(...packet.events.map(clonePhysicsEvent));
    return out;
}
export function collectPhysicsResultTransferables(packet) {
    const transfer = [];
    pushTransferableBuffer(transfer, packet.bodyFloats.buffer);
    pushTransferableBuffer(transfer, packet.bodySleeping.buffer);
    return transfer;
}
function writeBodyFloats(bodyFloats, index, transform, velocity) {
    const offset = index * PHYSICS_TRANSFERABLE_BODY_FLOAT_STRIDE;
    bodyFloats.set(transform.translation, offset);
    bodyFloats.set(transform.rotation, offset + 3);
    bodyFloats.set(velocity.linear, offset + 7);
    bodyFloats.set(velocity.angular, offset + 10);
}
function readBodyTransform(bodyFloats, index) {
    const offset = index * PHYSICS_TRANSFERABLE_BODY_FLOAT_STRIDE;
    return {
        translation: [
            bodyFloats[offset] ?? 0,
            bodyFloats[offset + 1] ?? 0,
            bodyFloats[offset + 2] ?? 0,
        ],
        rotation: [
            bodyFloats[offset + 3] ?? 0,
            bodyFloats[offset + 4] ?? 0,
            bodyFloats[offset + 5] ?? 0,
            bodyFloats[offset + 6] ?? 1,
        ],
    };
}
function readBodyVelocity(bodyFloats, index) {
    const offset = index * PHYSICS_TRANSFERABLE_BODY_FLOAT_STRIDE;
    return {
        linear: [
            bodyFloats[offset + 7] ?? 0,
            bodyFloats[offset + 8] ?? 0,
            bodyFloats[offset + 9] ?? 0,
        ],
        angular: [
            bodyFloats[offset + 10] ?? 0,
            bodyFloats[offset + 11] ?? 0,
            bodyFloats[offset + 12] ?? 0,
        ],
    };
}
function clonePhysicsEvent(event) {
    return {
        ...event,
        ...(event.point === undefined
            ? {}
            : { point: [...event.point] }),
        ...(event.normal === undefined
            ? {}
            : { normal: [...event.normal] }),
        ...(event.force === undefined
            ? {}
            : { force: [...event.force] }),
    };
}
function pushTransferableBuffer(transfer, buffer) {
    if (buffer instanceof ArrayBuffer && buffer.byteLength > 0) {
        transfer.push(buffer);
    }
}
//# sourceMappingURL=worker-protocol.js.map