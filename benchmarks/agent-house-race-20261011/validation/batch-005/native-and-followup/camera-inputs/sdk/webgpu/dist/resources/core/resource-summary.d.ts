import type { CreateMeshGpuBuffersResult } from "../meshes/mesh-buffer-resources.js";
import type { GetOrCreateRenderPipelineResult } from "../../gpu/pipeline-cache-integration.js";
import type { EnvironmentResourcePlan } from "../../lighting/environment-resource-planning.js";
import type { CreateLightGpuBuffersResult, LightBufferDescriptor } from "../../lighting/light-packing.js";
import type { CreateLightBindGroupResourceResult } from "../../lighting/light-bind-group.js";
import type { CreateShaderModuleResourceResult } from "../../gpu/shader-resource.js";
import type { CreateSamplerGpuResourceResult, CreateTextureGpuResourceResult } from "../textures/texture-resources.js";
import type { CreateMatcapMaterialGpuBufferResult } from "../../materials/matcap/matcap-material-buffer-resource.js";
import type { CreateStandardMaterialGpuBufferResult } from "../../materials/standard/standard-material-buffer-resource.js";
import type { CreateUnlitMaterialGpuBufferResult } from "../../materials/unlit/unlit-material-buffer-resource.js";
import type { CreateViewUniformGpuBufferResult } from "../views/view-uniform-buffer-resource.js";
import type { RenderResourceInspectionReport } from "./resource-lifecycle.js";
export type RenderResourceSummarySeverity = "warning" | "error";
export interface RenderResourceSummaryDiagnostic {
    readonly code: string;
    readonly message: string;
    readonly severity: RenderResourceSummarySeverity;
    readonly resourceKey?: string;
}
export interface RenderResourceSummaryCounts {
    readonly meshResources: number;
    readonly meshVertexBuffers: number;
    readonly meshIndexBuffers: number;
    readonly materialBuffers: number;
    readonly textures: number;
    readonly samplers: number;
    readonly lightBuffers: number;
    readonly lightGpuBuffers: number;
    readonly lightBindGroups: number;
    readonly environmentMaps: number;
    readonly viewUniformBuffers: number;
    readonly shaderModules: number;
    readonly pipelineHits: number;
    readonly pipelineMisses: number;
    readonly inspectedResources: number;
    readonly staleResources: number;
    readonly missingResources: number;
    readonly pendingDestroyResources: number;
    readonly warnings: number;
    readonly errors: number;
}
export type CreateMaterialGpuBufferResult = CreateUnlitMaterialGpuBufferResult | CreateMatcapMaterialGpuBufferResult | CreateStandardMaterialGpuBufferResult;
export interface RenderResourceSummaryInput {
    readonly meshResources: readonly CreateMeshGpuBuffersResult[];
    readonly materialResources: readonly CreateMaterialGpuBufferResult[];
    readonly textureResources?: readonly CreateTextureGpuResourceResult[];
    readonly samplerResources?: readonly CreateSamplerGpuResourceResult[];
    readonly lightBuffers?: readonly LightBufferDescriptor[];
    readonly lightGpuBufferResources?: readonly CreateLightGpuBuffersResult[];
    readonly lightBindGroupResources?: readonly CreateLightBindGroupResourceResult[];
    readonly environmentResources?: readonly EnvironmentResourcePlan[];
    readonly viewUniformResources: readonly CreateViewUniformGpuBufferResult[];
    readonly shaderResources: readonly CreateShaderModuleResourceResult[];
    readonly pipelines: readonly GetOrCreateRenderPipelineResult[];
    readonly resourceInspection?: RenderResourceInspectionReport;
}
export interface RenderResourceSummaryReport {
    readonly counts: RenderResourceSummaryCounts;
    readonly diagnostics: readonly RenderResourceSummaryDiagnostic[];
}
export interface RenderResourceSummaryDiagnosticJsonValue {
    readonly code: string;
    readonly message: string;
    readonly severity: RenderResourceSummarySeverity;
    readonly resourceKey?: string;
}
export interface RenderResourceSummaryReportJsonValue {
    readonly counts: RenderResourceSummaryCounts;
    readonly diagnostics: readonly RenderResourceSummaryDiagnosticJsonValue[];
}
export declare function createRenderResourceSummaryReport(input: RenderResourceSummaryInput): RenderResourceSummaryReport;
export declare function renderResourceSummaryReportToJsonValue(report: RenderResourceSummaryReport): RenderResourceSummaryReportJsonValue;
export declare function renderResourceSummaryReportToJson(report: RenderResourceSummaryReport): string;
export declare function mergeRenderResourceSummaryReports(reports: readonly RenderResourceSummaryReport[]): RenderResourceSummaryReport;
//# sourceMappingURL=resource-summary.d.ts.map