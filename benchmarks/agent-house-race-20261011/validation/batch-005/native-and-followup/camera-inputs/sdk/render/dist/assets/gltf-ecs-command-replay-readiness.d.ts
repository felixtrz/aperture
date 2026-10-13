import type { GltfEcsAuthoringCommandPlan, GltfEcsAuthoringComponentName } from "./gltf-ecs-authoring-command-plan.js";
export type GltfEcsReplayReadinessStatus = "absent" | "ready" | "blocked";
export type GltfEcsReplayReadinessBlockerCode = "gltfEcsReplayReadiness.invalidPlan" | "gltfEcsReplayReadiness.duplicateEntityKey" | "gltfEcsReplayReadiness.missingEntityKey" | "gltfEcsReplayReadiness.missingParentEntityKey" | "gltfEcsReplayReadiness.unknownComponent";
export interface GltfEcsReplayReadinessBlockerSummary {
    readonly code: GltfEcsReplayReadinessBlockerCode;
    readonly message: string;
    readonly count: number;
}
export interface GltfEcsReplayReadinessSummaryJsonValue {
    readonly status: GltfEcsReplayReadinessStatus;
    readonly ready: boolean | null;
    readonly reason: string | null;
    readonly requiredWorld: true;
    readonly wouldRegisterComponents: boolean;
    readonly expectedCreateEntityCount: number;
    readonly expectedAddComponentCount: number;
    readonly requiredComponents: readonly GltfEcsAuthoringComponentName[];
    readonly blockerCount: number;
    readonly blockers: readonly GltfEcsReplayReadinessBlockerSummary[];
}
export interface GltfEcsReplayReadinessSummaryOptions {
    readonly registerComponents?: boolean;
}
export declare function createGltfEcsReplayReadinessSummaryJsonValue(plan: GltfEcsAuthoringCommandPlan | null, options?: GltfEcsReplayReadinessSummaryOptions): GltfEcsReplayReadinessSummaryJsonValue;
//# sourceMappingURL=gltf-ecs-command-replay-readiness.d.ts.map