import type { PhysicsBackendBuild, PhysicsBackendKind, PhysicsCharacterMove, PhysicsCharacterMoveResult, PhysicsCommandBuffer, PhysicsDebugGeometry, PhysicsDebugOptions, PhysicsEvent, PhysicsExecutionMode, PhysicsOverlapHit, PhysicsPointProjection, PhysicsQueryOptions, PhysicsRay, PhysicsRaycastHit, PhysicsReadbackReport, PhysicsResultBuffer, PhysicsShapeCast, PhysicsShapeCastHit, PhysicsStepReport, PhysicsTransform } from "./backend.js";
import type { PhysicsShape, PhysicsVec3 } from "./components.js";
export declare const PHYSICS_WORKER_PROTOCOL: {
    readonly init: "aperture.physics.init";
    readonly step: "aperture.physics.step";
    readonly action: "aperture.physics.action";
    readonly result: "aperture.physics.result";
    readonly actionResult: "aperture.physics.actionResult";
    readonly error: "aperture.physics.error";
    readonly dispose: "aperture.physics.dispose";
};
export declare const PHYSICS_TRANSFERABLE_BODY_FLOAT_STRIDE = 13;
export type PhysicsWorkerExecutionMode = Exclude<PhysicsExecutionMode, "simulation-worker">;
export interface PhysicsWorkerInitMessage {
    readonly type: typeof PHYSICS_WORKER_PROTOCOL.init;
    readonly backend: PhysicsBackendKind;
    readonly backendBuild?: PhysicsBackendBuild;
    readonly execution: PhysicsWorkerExecutionMode;
    readonly gravity?: PhysicsVec3;
}
export interface PhysicsWorkerStepMessage {
    readonly type: typeof PHYSICS_WORKER_PROTOCOL.step;
    readonly fixedDelta: number;
    readonly fixedStep: number;
    readonly commands: PhysicsCommandBuffer;
}
export type PhysicsWorkerAction = {
    readonly kind: "raycastFirst";
    readonly ray: PhysicsRay;
    readonly options?: PhysicsQueryOptions;
} | {
    readonly kind: "raycastAll";
    readonly ray: PhysicsRay;
    readonly options?: PhysicsQueryOptions;
} | {
    readonly kind: "overlapShape";
    readonly shape: PhysicsShape;
    readonly transform: PhysicsTransform;
    readonly options?: PhysicsQueryOptions;
} | {
    readonly kind: "castShapeFirst";
    readonly shape: PhysicsShape;
    readonly cast: PhysicsShapeCast;
    readonly options?: PhysicsQueryOptions;
} | {
    readonly kind: "projectPoint";
    readonly point: PhysicsVec3;
    readonly options?: PhysicsQueryOptions;
} | {
    readonly kind: "moveCharacter";
    readonly move: PhysicsCharacterMove;
} | {
    readonly kind: "sleepBody";
    readonly entity: string;
} | {
    readonly kind: "wakeBody";
    readonly entity: string;
} | {
    readonly kind: "debugGeometry";
    readonly options?: PhysicsDebugOptions;
};
export interface PhysicsWorkerActionMessage {
    readonly type: typeof PHYSICS_WORKER_PROTOCOL.action;
    readonly requestId: number;
    readonly action: PhysicsWorkerAction;
}
export type PhysicsWorkerActionResult = {
    readonly kind: "raycastFirst";
    readonly hit: PhysicsRaycastHit | null;
} | {
    readonly kind: "raycastAll";
    readonly hits: readonly PhysicsRaycastHit[];
} | {
    readonly kind: "overlapShape";
    readonly hits: readonly PhysicsOverlapHit[];
} | {
    readonly kind: "castShapeFirst";
    readonly hit: PhysicsShapeCastHit | null;
} | {
    readonly kind: "projectPoint";
    readonly projection: PhysicsPointProjection | null;
} | {
    readonly kind: "moveCharacter";
    readonly result: PhysicsCharacterMoveResult | null;
} | {
    readonly kind: "sleepBody";
    readonly changed: boolean;
} | {
    readonly kind: "wakeBody";
    readonly changed: boolean;
} | {
    readonly kind: "debugGeometry";
    readonly geometry: PhysicsDebugGeometry;
};
export interface PhysicsTransferableResultPacket {
    readonly bodyEntities: readonly string[];
    readonly bodyFloats: Float32Array;
    readonly bodySleeping: Uint8Array;
    readonly events: readonly PhysicsEvent[];
}
export interface PhysicsWorkerResultMessage {
    readonly type: typeof PHYSICS_WORKER_PROTOCOL.result;
    readonly fixedStep: number;
    readonly step: PhysicsStepReport;
    readonly readback: PhysicsReadbackReport;
    readonly results: PhysicsTransferableResultPacket;
}
export interface PhysicsWorkerActionResultMessage {
    readonly type: typeof PHYSICS_WORKER_PROTOCOL.actionResult;
    readonly requestId: number;
    readonly result: PhysicsWorkerActionResult;
}
export interface PhysicsWorkerErrorMessage {
    readonly type: typeof PHYSICS_WORKER_PROTOCOL.error;
    readonly reason: string;
    readonly message: string;
    readonly requestId?: number;
    readonly diagnostics?: readonly unknown[];
}
export interface PhysicsWorkerDisposeMessage {
    readonly type: typeof PHYSICS_WORKER_PROTOCOL.dispose;
}
export type PhysicsWorkerInboundMessage = PhysicsWorkerInitMessage | PhysicsWorkerStepMessage | PhysicsWorkerActionMessage | PhysicsWorkerDisposeMessage;
export type PhysicsWorkerOutboundMessage = PhysicsWorkerResultMessage | PhysicsWorkerActionResultMessage | PhysicsWorkerErrorMessage;
export interface PhysicsWorkerMessageWithTransfer<TMessage> {
    readonly message: TMessage;
    readonly transfer: Transferable[];
}
export declare function createPhysicsWorkerStepMessage(input: {
    readonly fixedDelta: number;
    readonly fixedStep: number;
    readonly commands: PhysicsCommandBuffer;
}): PhysicsWorkerMessageWithTransfer<PhysicsWorkerStepMessage>;
export declare function createPhysicsWorkerActionMessage(input: {
    readonly requestId: number;
    readonly action: PhysicsWorkerAction;
}): PhysicsWorkerMessageWithTransfer<PhysicsWorkerActionMessage>;
export declare function createPhysicsWorkerResultMessage(input: {
    readonly fixedStep: number;
    readonly step: PhysicsStepReport;
    readonly readback: PhysicsReadbackReport;
    readonly results: PhysicsResultBuffer;
}): PhysicsWorkerMessageWithTransfer<PhysicsWorkerResultMessage>;
export declare function createPhysicsWorkerActionResultMessage(input: {
    readonly requestId: number;
    readonly result: PhysicsWorkerActionResult;
}): PhysicsWorkerMessageWithTransfer<PhysicsWorkerActionResultMessage>;
export declare function encodePhysicsResultPacket(results: PhysicsResultBuffer): PhysicsTransferableResultPacket;
export declare function decodePhysicsResultPacket(packet: PhysicsTransferableResultPacket, out?: PhysicsResultBuffer): PhysicsResultBuffer;
export declare function collectPhysicsResultTransferables(packet: PhysicsTransferableResultPacket): Transferable[];
//# sourceMappingURL=worker-protocol.d.ts.map