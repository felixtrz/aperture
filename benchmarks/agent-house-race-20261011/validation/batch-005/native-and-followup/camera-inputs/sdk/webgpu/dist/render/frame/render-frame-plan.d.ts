import type { MeshDrawPacket, PackedSnapshotTransforms, RenderDiagnostic, RenderSnapshot, OpaqueRenderStateSortPressureReport, RenderWorldDrawPackagePlan, RenderWorldDrawPackageScratch, RenderWorld, RenderSnapshotChangeSet } from "@aperture-engine/render";
import { type DrawCommandDescriptorPlan, type DrawCommandDescriptorScratch } from "../draw/draw-command.js";
import type { MeshGpuBufferResource } from "../../resources/meshes/mesh-buffer-resources.js";
import type { InstanceTintGpuBufferResource } from "../../resources/attributes/instance-tint-buffer.js";
import type { GetOrCreateRenderPipelineResult } from "../../gpu/pipeline-cache-integration.js";
import { type RenderPassCommandPlan, type RenderPassCommandScratch } from "../passes/render-pass-commands.js";
import { type RenderPassDrawListPlan, type RenderPassDrawListScratch } from "../passes/render-pass-draw-list.js";
import { type RenderFramePhase, type RenderFramePhaseReports } from "./render-frame-phases.js";
import { type ResolveRenderPassResourcesResult, type ResolveRenderPassResourcesScratch } from "../passes/render-pass-resources.js";
import { type InjectedRenderFrameSnapshotResourceBindingPlanScratch, type InjectedRenderFrameSnapshotResourceBindingPlan } from "./renderer-frame-summary.js";
import type { UnlitBindGroupResource } from "../../materials/unlit/unlit-bind-group.js";
export interface PlanRenderFrameFromSnapshotInput {
    readonly snapshot: RenderSnapshot;
    readonly snapshotChangeSet?: RenderSnapshotChangeSet;
    readonly renderWorld: RenderWorld;
    readonly transforms: PackedSnapshotTransforms;
    readonly resolveMeshResourceKey: (draw: MeshDrawPacket) => string | null;
    readonly resolveMaterialResourceKey: (draw: MeshDrawPacket) => string | null;
    readonly meshResources: readonly MeshGpuBufferResource[];
    readonly instanceTintResources?: readonly InstanceTintGpuBufferResource[];
    readonly pipelineKeysByRenderId?: ReadonlyMap<number, string>;
    readonly pipelines: readonly GetOrCreateRenderPipelineResult[];
    readonly bindGroups: readonly UnlitBindGroupResource[];
    readonly requiredBindGroupGroups?: readonly number[];
    readonly drawOrderTransformPacking?: (input: RenderFrameDrawOrderTransformPackingInput) => RenderFrameDrawOrderTransformPackingResult | null;
    readonly summaryScratch?: RenderFramePlanSummaryScratch;
}
export interface RenderFrameDrawOrderTransformPackingInput {
    readonly packages: RenderWorldDrawPackagePlan;
    readonly transforms: PackedSnapshotTransforms;
    readonly pipelineKeysByRenderId?: ReadonlyMap<number, string>;
    readonly pipelines: readonly GetOrCreateRenderPipelineResult[];
    readonly bindGroups: readonly UnlitBindGroupResource[];
}
export interface RenderFrameDrawOrderTransformPackingResult {
    readonly bindGroups?: readonly UnlitBindGroupResource[];
    readonly worldTransformResourceKeyByRenderId?: ReadonlyMap<number, string>;
}
export interface RenderFramePlanCounts {
    readonly apply: {
        readonly active: number;
        readonly created: number;
        readonly updated: number;
        readonly unchanged: number;
        readonly removed: number;
    };
    readonly binding: {
        readonly planned: number;
        readonly applied: number;
        readonly ready: number;
        readonly blocked: number;
    };
    readonly draw: {
        readonly packages: number;
        readonly descriptors: number;
        readonly drawList: number;
        readonly resolved: number;
    };
    readonly command: {
        readonly commands: number;
        readonly drawCount: number;
        readonly indexedDrawCount: number;
        readonly nonIndexedDrawCount: number;
    };
}
export interface RenderFramePlanDiagnostic {
    readonly phase: RenderFramePhase;
    readonly source?: string;
    readonly code: string;
    readonly message: string;
    readonly renderId?: number;
    readonly resourceKey?: string;
    readonly assetKey?: string;
    readonly entity?: RenderDiagnostic["entity"];
}
export interface RenderFramePlanSummary {
    readonly ready: boolean;
    readonly phaseOrder: readonly RenderFramePhase[];
    readonly phases: RenderFramePhaseReports<RenderFramePlanDiagnostic>;
    readonly counts: RenderFramePlanCounts;
    readonly diagnostics: readonly RenderFramePlanDiagnostic[];
}
export interface RenderFrameQueueDiagnosticSummary {
    readonly total: number;
    readonly byCode: Readonly<Record<string, number>>;
}
export interface RenderFrameQueueDiagnosticsSummary {
    readonly ready: boolean;
    readonly readyDrawCount: number;
    readonly blockedDrawCount: number;
    readonly packageCount: number;
    readonly packagePoolSize: number;
    readonly packageSlotsReused: number;
    readonly packageSlotsCreated: number;
    readonly missingPackedTransformCount: number;
    readonly draw?: RenderFramePlanCounts["draw"];
    readonly stateSort: OpaqueRenderStateSortPressureReport;
    readonly diagnostics: RenderFrameQueueDiagnosticSummary;
}
export interface RenderFramePlanSummaryScratch {
    readonly applyDiagnostics: RenderFramePlanDiagnostic[];
    readonly prepareDiagnostics: RenderFramePlanDiagnostic[];
    readonly queueDiagnostics: RenderFramePlanDiagnostic[];
    readonly resolveDiagnostics: RenderFramePlanDiagnostic[];
    readonly commandDiagnostics: RenderFramePlanDiagnostic[];
    readonly submitDiagnostics: RenderFramePlanDiagnostic[];
    readonly diagnostics: RenderFramePlanDiagnostic[];
    readonly counts: RenderFramePlanCounts;
    readonly queueCounts: RenderFramePhaseReports<RenderFramePlanDiagnostic>["queue"]["counts"];
    readonly submitCounts: RenderFramePhaseReports<RenderFramePlanDiagnostic>["submit"]["counts"];
    readonly phases: RenderFramePhaseReports<RenderFramePlanDiagnostic>;
    readonly summary: RenderFramePlanSummary;
}
export interface PlanRenderFrameFromSnapshotResult {
    readonly apply: ReturnType<RenderWorld["applySnapshot"]>;
    readonly bindingPlan: InjectedRenderFrameSnapshotResourceBindingPlan;
    readonly bindingResults: readonly ReturnType<RenderWorld["updateResourceBindings"]>[];
    readonly readiness: ReturnType<RenderWorld["createDrawReadinessReport"]>;
    readonly packages: RenderWorldDrawPackagePlan;
    readonly drawCommands: DrawCommandDescriptorPlan;
    readonly drawList: RenderPassDrawListPlan;
    readonly resources: ResolveRenderPassResourcesResult;
    readonly commandPlan: RenderPassCommandPlan;
    readonly summary: RenderFramePlanSummary;
}
export interface RenderFramePlanScratch {
    readonly summaryScratch: RenderFramePlanSummaryScratch;
    readonly bindingScratch: InjectedRenderFrameSnapshotResourceBindingPlanScratch;
    readonly drawPackageScratch: RenderWorldDrawPackageScratch;
    readonly drawCommandScratch: DrawCommandDescriptorScratch;
    readonly drawListScratch: RenderPassDrawListScratch;
    readonly resourcesScratch: ResolveRenderPassResourcesScratch;
    readonly commandScratch: RenderPassCommandScratch;
    readonly result: PlanRenderFrameFromSnapshotResult;
}
export type WriteRenderFrameFromSnapshotInput = PlanRenderFrameFromSnapshotInput & {
    readonly scratch: RenderFramePlanScratch;
};
export declare function planRenderFrameFromSnapshot(input: PlanRenderFrameFromSnapshotInput): PlanRenderFrameFromSnapshotResult;
export declare function createRenderFramePlanScratch(summaryScratch?: RenderFramePlanSummaryScratch): RenderFramePlanScratch;
export declare function writeRenderFramePlanFromSnapshot(input: WriteRenderFrameFromSnapshotInput): PlanRenderFrameFromSnapshotResult;
export declare function createRenderFrameQueueDiagnosticsSummary(input: Pick<PlanRenderFrameFromSnapshotResult, "readiness" | "packages"> & {
    readonly summary?: Pick<RenderFramePlanSummary, "counts">;
}): RenderFrameQueueDiagnosticsSummary;
export declare function createRenderFramePlanSummaryScratch(): RenderFramePlanSummaryScratch;
//# sourceMappingURL=render-frame-plan.d.ts.map