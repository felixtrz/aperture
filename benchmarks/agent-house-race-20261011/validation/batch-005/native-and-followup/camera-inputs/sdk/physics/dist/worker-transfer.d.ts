import { type EcsWorld } from "@aperture-engine/simulation";
import { type PhysicsBackend, type PhysicsCharacterMove, type PhysicsDebugOptions, type PhysicsOverlapHit, type PhysicsPointProjection, type PhysicsQueryOptions, type PhysicsRay, type PhysicsRaycastHit, type PhysicsReadbackReport, type PhysicsResultBuffer, type PhysicsShapeCast, type PhysicsShapeCastHit, type PhysicsStepReport, type PhysicsTransform } from "./backend.js";
import type { PhysicsShape, PhysicsVec3 } from "./components.js";
import { type PhysicsWorldSyncState, type PhysicsWorldWritebackReport } from "./ecs-sync.js";
import { type PhysicsWorkerActionMessage, type PhysicsWorkerMessageWithTransfer, type PhysicsWorkerOutboundMessage, type PhysicsWorkerStepMessage } from "./worker-protocol.js";
export interface PhysicsWorkerTransferEndpoint {
    step(request: PhysicsWorkerMessageWithTransfer<PhysicsWorkerStepMessage>): PhysicsWorkerMessageWithTransfer<PhysicsWorkerOutboundMessage> | Promise<PhysicsWorkerMessageWithTransfer<PhysicsWorkerOutboundMessage>>;
    action?(request: PhysicsWorkerMessageWithTransfer<PhysicsWorkerActionMessage>): PhysicsWorkerMessageWithTransfer<PhysicsWorkerOutboundMessage> | Promise<PhysicsWorkerMessageWithTransfer<PhysicsWorkerOutboundMessage>>;
}
export interface PhysicsWorkerTransferProxy {
    readonly execution: "physics-worker-transferable";
    stepWorld(options: PhysicsWorkerTransferStepWorldOptions): Promise<PhysicsWorkerTransferStepWorldReport>;
    raycastFirst(ray: PhysicsRay, options?: PhysicsQueryOptions): Promise<PhysicsRaycastHit | null>;
    raycastAll(ray: PhysicsRay, options?: PhysicsQueryOptions): Promise<readonly PhysicsRaycastHit[]>;
    overlapShape(shape: PhysicsShape, transform: PhysicsTransform, options?: PhysicsQueryOptions): Promise<readonly PhysicsOverlapHit[]>;
    castShapeFirst(shape: PhysicsShape, cast: PhysicsShapeCast, options?: PhysicsQueryOptions): Promise<PhysicsShapeCastHit | null>;
    projectPoint(point: PhysicsVec3, options?: PhysicsQueryOptions): Promise<PhysicsPointProjection | null>;
    moveCharacter(move: PhysicsCharacterMove): Promise<ReturnType<NonNullable<PhysicsBackend["moveCharacter"]>>>;
    sleepBody(entity: string): Promise<boolean>;
    wakeBody(entity: string): Promise<boolean>;
    debugGeometry(options?: PhysicsDebugOptions): Promise<ReturnType<NonNullable<PhysicsBackend["debugGeometry"]>>>;
}
export interface PhysicsWorkerTransferStepWorldOptions {
    readonly world: EcsWorld;
    readonly fixedDelta: number;
    readonly fixedStep: number;
    readonly state?: PhysicsWorldSyncState;
}
export interface PhysicsWorkerTransferCommandReport {
    readonly commandCount: number;
    readonly upsertBodyCount: number;
    readonly destroyBodyCount: number;
    readonly upsertJointCount: number;
    readonly destroyJointCount: number;
    readonly otherCommandCount: number;
}
export interface PhysicsWorkerTransferTransportReport {
    readonly mode: "physics-worker-transferable";
    readonly submittedFixedStep: number;
    readonly completedFixedStep: number;
    readonly latencyFrames: number;
    readonly transferBytes: number;
    readonly structuredCloneBytes: number;
    readonly totalResultBytes: number;
    readonly resultBodyBytes: number;
    readonly resultSleepingBytes: number;
    readonly resultEventCount: number;
}
export interface PhysicsWorkerTransferStepWorldReport {
    readonly commands: PhysicsWorkerTransferCommandReport;
    readonly step: PhysicsStepReport;
    readonly readback: PhysicsReadbackReport;
    readonly writeback: PhysicsWorldWritebackReport;
    readonly events: readonly PhysicsResultBuffer["events"][number][];
    readonly transport: PhysicsWorkerTransferTransportReport;
}
export declare class PhysicsWorkerTransferError extends Error {
    readonly reason: string;
    readonly diagnostics?: readonly unknown[];
    constructor(message: string, reason?: string, diagnostics?: readonly unknown[]);
}
export declare function createPhysicsWorkerTransferProxy(endpoint: PhysicsWorkerTransferEndpoint): PhysicsWorkerTransferProxy;
export declare function createPhysicsWorkerBackendEndpoint(backend: PhysicsBackend): PhysicsWorkerTransferEndpoint;
//# sourceMappingURL=worker-transfer.d.ts.map