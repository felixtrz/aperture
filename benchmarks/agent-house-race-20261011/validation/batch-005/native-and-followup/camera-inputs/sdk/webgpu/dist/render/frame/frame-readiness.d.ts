import type { PackedSnapshotViewUniforms, RenderWorldDrawPackagePlan } from "@aperture-engine/render";
import type { CreateMeshGpuBuffersResult } from "../../resources/meshes/mesh-buffer-resources.js";
import type { GetOrCreateRenderPipelineResult } from "../../gpu/pipeline-cache-integration.js";
import type { CreateUnlitMaterialGpuBufferResult } from "../../materials/unlit/unlit-material-buffer-resource.js";
export type FrameAssemblyReadinessSeverity = "info" | "warning" | "error";
export interface FrameAssemblyReadinessDiagnostic {
    readonly code: string;
    readonly message: string;
    readonly severity: FrameAssemblyReadinessSeverity;
}
export interface FrameAssemblyReadinessCounts {
    readonly drawPackages: number;
    readonly viewUniforms: number;
    readonly meshResourcesReady: number;
    readonly materialResourcesReady: number;
    readonly pipelineHits: number;
    readonly pipelineMisses: number;
    readonly blocked: number;
    readonly warnings: number;
    readonly errors: number;
}
export interface FrameAssemblyReadinessInput {
    readonly drawPackages: RenderWorldDrawPackagePlan;
    readonly viewUniforms: PackedSnapshotViewUniforms;
    readonly meshResources: readonly CreateMeshGpuBuffersResult[];
    readonly materialResources: readonly CreateUnlitMaterialGpuBufferResult[];
    readonly pipelines: readonly GetOrCreateRenderPipelineResult[];
}
export interface FrameAssemblyReadinessReport {
    readonly ready: boolean;
    readonly counts: FrameAssemblyReadinessCounts;
    readonly diagnostics: readonly FrameAssemblyReadinessDiagnostic[];
}
export declare function createFrameAssemblyReadinessReport(input: FrameAssemblyReadinessInput): FrameAssemblyReadinessReport;
//# sourceMappingURL=frame-readiness.d.ts.map