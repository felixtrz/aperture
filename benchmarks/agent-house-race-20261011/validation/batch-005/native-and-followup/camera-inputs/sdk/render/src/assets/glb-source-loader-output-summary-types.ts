import type {
  GltfEcsAuthoringCommandPlan,
  GltfEcsAuthoringComponentName,
} from "./gltf-ecs-authoring-command-plan.js";
import type { GltfEcsReplayReadinessSummaryJsonValue } from "./gltf-ecs-command-replay-readiness.js";
import type { GltfSourceRegistrationOrchestrationReport } from "./gltf-source-registration-orchestration.js";

export type GlbSourceLoaderSummaryStatus = "absent" | "ready" | "invalid";

export interface GlbSourceLoaderMeshConstructionSummaryJsonValue {
  readonly status: GlbSourceLoaderSummaryStatus;
  readonly valid: boolean | null;
  readonly meshCount: number;
  readonly submeshCount: number;
  readonly vertexCount: number;
  readonly indexCount: number;
  readonly diagnosticsCount: number;
}

export interface GlbSourceLoaderOutputSummaryJsonValue {
  readonly meshConstruction: GlbSourceLoaderMeshConstructionSummaryJsonValue;
  readonly sourceRegistration: GlbSourceLoaderSourceRegistrationSummaryJsonValue;
  readonly ecsCommandPlan: GlbSourceLoaderEcsCommandPlanSummaryJsonValue;
  readonly ecsReplayReadiness: GltfEcsReplayReadinessSummaryJsonValue;
}

export interface GlbSourceLoaderSourceRegistrationSummaryJsonValue {
  readonly status: GlbSourceLoaderSummaryStatus;
  readonly valid: boolean | null;
  readonly writtenCount: number;
  readonly skippedCount: number;
  readonly diagnosticsCount: number;
  readonly stages: readonly {
    readonly stage: string;
    readonly status: string;
    readonly writtenCount: number;
    readonly skippedCount: number;
    readonly diagnosticCount: number;
  }[];
}

export interface GlbSourceLoaderOutputSummaryOptions {
  readonly sourceRegistration?: GltfSourceRegistrationOrchestrationReport | null;
  readonly ecsCommandPlan?: GltfEcsAuthoringCommandPlan | null;
}

export interface GlbSourceLoaderEcsCommandPlanSummaryJsonValue {
  readonly status: GlbSourceLoaderSummaryStatus;
  readonly valid: boolean | null;
  readonly sceneIndex: number | null;
  readonly rootEntityCount: number;
  readonly commandCount: number;
  readonly createEntityCount: number;
  readonly addComponentCount: number;
  readonly componentCounts: readonly {
    readonly component: GltfEcsAuthoringComponentName;
    readonly count: number;
  }[];
  readonly dependencyCount: number;
  readonly skippedCount: number;
  readonly diagnosticsCount: number;
}
