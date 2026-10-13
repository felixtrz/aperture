import { type PhysicsBackend, type PhysicsBackendBuild, type PhysicsBackendCapabilities, type PhysicsBackendKind, type PhysicsExecutionMode, type PhysicsEventKind, type PhysicsSyncReport } from "./backend.js";
import { type PhysicsVec3 } from "./components.js";
export interface PhysicsBackendBenchmarkOptions {
    readonly dynamicBodyCount?: number;
    readonly contactPairCount?: number;
    readonly jointCount?: number;
    readonly characterMoveRepeats?: number;
    readonly debugGeometryRepeats?: number;
    readonly resyncRepeats?: number;
    readonly fixedSteps?: number;
    readonly fixedDelta?: number;
    readonly queryRepeats?: number;
    readonly gravity?: PhysicsVec3;
    readonly execution?: PhysicsExecutionMode;
    readonly initialize?: boolean;
    readonly dispose?: boolean;
}
export interface PhysicsBackendBenchmarkScenario {
    readonly name: string;
    readonly description: string;
    readonly options: PhysicsBackendBenchmarkOptions;
}
export interface PhysicsBackendBenchmarkScenarioReport {
    readonly name: string;
    readonly description: string;
    readonly report: PhysicsBackendBenchmarkReport;
}
export interface PhysicsBackendBenchmarkSuiteReport {
    readonly scenarioCount: number;
    readonly scenarios: readonly PhysicsBackendBenchmarkScenarioReport[];
}
export interface PhysicsBackendBenchmarkBackendReport {
    readonly kind: PhysicsBackendKind;
    readonly version: string;
    readonly build: PhysicsBackendBuild;
    readonly execution: PhysicsExecutionMode;
    readonly capabilities: PhysicsBackendCapabilities;
}
export interface PhysicsBackendBenchmarkInputReport {
    readonly dynamicBodyCount: number;
    readonly contactPairCount: number;
    readonly jointCount: number;
    readonly characterMoveRepeats: number;
    readonly debugGeometryRepeats: number;
    readonly resyncRepeats: number;
    readonly fixedSteps: number;
    readonly fixedDelta: number;
    readonly queryRepeats: number;
    readonly gravity: PhysicsVec3;
    readonly execution: PhysicsExecutionMode;
}
export interface PhysicsBackendBenchmarkSupportReport {
    readonly overlapShape: boolean;
    readonly castShapeFirst: boolean;
    readonly projectPoint: boolean;
    readonly moveCharacter: boolean;
    readonly debugGeometry: boolean;
}
export interface PhysicsBackendBenchmarkCountReport {
    readonly commandCount: number;
    readonly syncCount: number;
    readonly resyncCommandCount: number;
    readonly bodyCount: number;
    readonly colliderCount: number;
    readonly jointCount: number;
    readonly readbackBodyCount: number;
    readonly eventCount: number;
    readonly unsupportedFeatureCount: number;
    readonly queryCount: number;
    readonly raycastFirstHitCount: number;
    readonly sensorRaycastHitCount: number;
    readonly groupedRaycastHitCount: number;
    readonly overlapHitCount: number;
    readonly shapeCastHitCount: number;
    readonly projectPointHitCount: number;
    readonly characterMoveCount: number;
    readonly characterCollisionCount: number;
    readonly characterGroundedCount: number;
    readonly debugGeometryCallCount: number;
    readonly debugLineCount: number;
}
export interface PhysicsBackendBenchmarkTimingReport {
    readonly initMs: number;
    readonly syncMs: number;
    readonly stepMs: number;
    readonly readbackMs: number;
    readonly queryMs: number;
    readonly totalMs: number;
}
export type PhysicsBackendBenchmarkMemorySource = "performance.memory" | "process.memoryUsage" | "unavailable";
export interface PhysicsBackendBenchmarkMemoryReport {
    readonly available: boolean;
    readonly source: PhysicsBackendBenchmarkMemorySource;
    readonly usedBeforeBytes: number | null;
    readonly usedAfterBytes: number | null;
    readonly deltaBytes: number | null;
    readonly totalBeforeBytes: number | null;
    readonly totalAfterBytes: number | null;
    readonly limitBytes: number | null;
    readonly checkpointCount: number;
    readonly peakUsedBytes: number | null;
    readonly peakDeltaBytes: number | null;
    readonly checkpoints: readonly PhysicsBackendBenchmarkMemoryCheckpoint[];
}
export interface PhysicsBackendBenchmarkMemoryCheckpoint {
    readonly label: string;
    readonly stepIndex: number | null;
    readonly source: PhysicsBackendBenchmarkMemorySource;
    readonly usedBytes: number | null;
    readonly totalBytes: number | null;
    readonly limitBytes: number | null;
    readonly deltaFromStartBytes: number | null;
    readonly deltaFromPreviousBytes: number | null;
}
export interface PhysicsBackendBenchmarkEventKindCount {
    readonly kind: PhysicsEventKind;
    readonly count: number;
}
export interface PhysicsBackendBenchmarkEventReport {
    readonly totalCount: number;
    readonly byKind: readonly PhysicsBackendBenchmarkEventKindCount[];
}
export interface PhysicsBackendBenchmarkSignatureReport {
    readonly firstBodyEntity: string | null;
    readonly firstBodyY: number | null;
    readonly minBodyY: number | null;
    readonly maxBodyY: number | null;
    readonly raycastFirstEntity: string | null;
    readonly sensorRaycastFirstEntity: string | null;
    readonly groupedRaycastEntities: readonly string[];
    readonly overlapEntities: readonly string[];
    readonly shapeCastEntity: string | null;
    readonly projectPointEntity: string | null;
    readonly characterEntity: string | null;
    readonly characterTargetX: number | null;
    readonly characterGrounded: boolean | null;
    readonly characterCollisionCount: number;
    readonly value: string;
}
export interface PhysicsBackendBenchmarkReport {
    readonly backend: PhysicsBackendBenchmarkBackendReport;
    readonly input: PhysicsBackendBenchmarkInputReport;
    readonly support: PhysicsBackendBenchmarkSupportReport;
    readonly counts: PhysicsBackendBenchmarkCountReport;
    readonly timingsMs: PhysicsBackendBenchmarkTimingReport;
    readonly memory: PhysicsBackendBenchmarkMemoryReport;
    readonly events: PhysicsBackendBenchmarkEventReport;
    readonly signature: PhysicsBackendBenchmarkSignatureReport;
    readonly unsupportedFeatures: readonly PhysicsSyncReport["unsupportedFeatures"][number][];
}
export declare function createDefaultPhysicsBackendBenchmarkScenarios(options?: PhysicsBackendBenchmarkOptions): readonly PhysicsBackendBenchmarkScenario[];
export declare function runPhysicsBackendBenchmarkScenarios(createBackend: () => PhysicsBackend | Promise<PhysicsBackend>, scenarios?: readonly PhysicsBackendBenchmarkScenario[]): Promise<PhysicsBackendBenchmarkSuiteReport>;
export declare function runPhysicsBackendBenchmark(backend: PhysicsBackend, options?: PhysicsBackendBenchmarkOptions): Promise<PhysicsBackendBenchmarkReport>;
//# sourceMappingURL=benchmark.d.ts.map