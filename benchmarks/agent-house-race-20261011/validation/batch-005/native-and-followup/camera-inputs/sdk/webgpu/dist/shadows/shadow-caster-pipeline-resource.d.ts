import type { WebGpuRenderPipelineCreateDescriptor, WebGpuRenderPipelineDeviceLike } from "../gpu/pipeline-cache.js";
import type { WebGpuShaderCreateDescriptor, WebGpuShaderModuleLike } from "../gpu/shader.js";
import type { ShadowCasterPipelineDescriptorMetadata, ShadowCasterPipelineDescriptorReport } from "./shadow-caster-pipeline-descriptor.js";
export declare const SHADOW_CASTER_DEPTH_ONLY_WGSL = "\nstruct ShadowPassMatrix {\n  viewProjection: mat4x4<f32>,\n};\n\n@group(0) @binding(0) var<uniform> shadowPassMatrix: ShadowPassMatrix;\n@group(0) @binding(1) var<storage, read> worldTransforms: array<mat4x4<f32>>;\n\nstruct VertexInput {\n  @location(0) position: vec3f,\n  @builtin(instance_index) instanceIndex: u32,\n};\n\n@vertex\nfn vs_main(input: VertexInput) -> @builtin(position) vec4f {\n  return shadowPassMatrix.viewProjection * worldTransforms[input.instanceIndex] * vec4f(input.position, 1.0);\n}\n\n@fragment\nfn fs_main() {\n}\n";
export declare const SHADOW_CASTER_ALPHA_TEST_WGSL = "\nstruct ShadowPassMatrix {\n  viewProjection: mat4x4<f32>,\n};\n\nstruct AlphaTestParams {\n  alphaCutoff: f32,\n};\n\n@group(0) @binding(0) var<uniform> shadowPassMatrix: ShadowPassMatrix;\n@group(0) @binding(1) var<storage, read> worldTransforms: array<mat4x4<f32>>;\n@group(1) @binding(0) var baseColorTexture: texture_2d<f32>;\n@group(1) @binding(1) var baseColorSampler: sampler;\n@group(1) @binding(2) var<uniform> alphaTestParams: AlphaTestParams;\n\nstruct VertexInput {\n  @location(0) position: vec3f,\n  @location(1) uv: vec2f,\n  @builtin(instance_index) instanceIndex: u32,\n};\n\nstruct VertexOutput {\n  @builtin(position) position: vec4f,\n  @location(0) uv: vec2f,\n};\n\n@vertex\nfn vs_main(input: VertexInput) -> VertexOutput {\n  var output: VertexOutput;\n  output.position = shadowPassMatrix.viewProjection * worldTransforms[input.instanceIndex] * vec4f(input.position, 1.0);\n  output.uv = input.uv;\n  return output;\n}\n\n@fragment\nfn fs_main(input: VertexOutput) {\n  let alpha = textureSample(baseColorTexture, baseColorSampler, input.uv).a;\n  if (alpha < alphaTestParams.alphaCutoff) {\n    discard;\n  }\n}\n";
export type ShadowCasterPipelineResourceStatus = "available" | "missing" | "not-required";
export type ShadowCasterPipelineResourceDiagnosticCode = "shadowCasterPipelineResource.missingDescriptor" | "shadowCasterPipelineResource.createShaderModuleUnavailable" | "shadowCasterPipelineResource.createRenderPipelineUnavailable" | "shadowCasterPipelineResource.pipelineCreationFailed" | "shadowCasterPipelineResource.passSubmissionDeferred" | "shadowCasterPipelineResource.shaderSamplingDeferred";
export interface ShadowCasterPipelineResourceDiagnostic {
    readonly code: ShadowCasterPipelineResourceDiagnosticCode;
    readonly severity: "warning" | "error";
    readonly message: string;
}
export interface ShadowCasterPipelineResource {
    readonly pipelineKey: string;
    readonly resourceKey: string;
    readonly shaderModuleKey: string;
    readonly label: string;
    readonly shaderModule: WebGpuShaderModuleLike;
    readonly matrixBindGroupLayout: unknown;
    readonly pipeline: unknown;
    readonly descriptor: WebGpuRenderPipelineCreateDescriptor;
}
export interface ShadowCasterPipelineResourceReport {
    readonly ready: boolean;
    readonly status: ShadowCasterPipelineResourceStatus;
    readonly descriptorCount: number;
    readonly createdPipelineCount: number;
    readonly reusedPipelineCount: number;
    readonly sections: {
        readonly pipelineDescriptor: boolean;
        readonly shaderModule: boolean;
        readonly pipelineCreation: boolean;
        readonly passSubmission: false;
        readonly shaderSampling: false;
    };
    readonly resource: ShadowCasterPipelineResource | null;
    readonly resources: readonly ShadowCasterPipelineResource[];
    readonly diagnostics: readonly ShadowCasterPipelineResourceDiagnostic[];
}
export type ShadowCasterPipelineResourceReportJsonValue = Omit<ShadowCasterPipelineResourceReport, "resource" | "resources"> & {
    readonly resource: {
        readonly pipelineKey: string;
        readonly resourceKey: string;
        readonly shaderModuleKey: string;
        readonly label: string;
    } | null;
    readonly resources: readonly {
        readonly pipelineKey: string;
        readonly resourceKey: string;
        readonly shaderModuleKey: string;
        readonly label: string;
    }[];
};
export interface ShadowCasterPipelineDeviceLike extends WebGpuRenderPipelineDeviceLike {
    createShaderModule?: (descriptor: WebGpuShaderCreateDescriptor) => WebGpuShaderModuleLike;
    createBindGroupLayout?: (descriptor: unknown) => unknown;
    createPipelineLayout?: (descriptor: unknown) => unknown;
}
export interface CreateShadowCasterPipelineResourceReportOptions {
    readonly device: ShadowCasterPipelineDeviceLike;
    readonly descriptor: ShadowCasterPipelineDescriptorReport;
    readonly cache?: Map<string, ShadowCasterPipelineResource>;
}
export declare function createShadowCasterPipelineResourceReport(options: CreateShadowCasterPipelineResourceReportOptions): ShadowCasterPipelineResourceReport;
export declare function createBrowserShadowCasterPipelineDescriptor(metadata: ShadowCasterPipelineDescriptorMetadata, shaderModule: WebGpuShaderModuleLike, layout?: unknown): WebGpuRenderPipelineCreateDescriptor;
export declare function shadowCasterPipelineResourceReportToJsonValue(value: ShadowCasterPipelineResourceReport): ShadowCasterPipelineResourceReportJsonValue;
export declare function shadowCasterPipelineResourceReportToJson(value: ShadowCasterPipelineResourceReport): string;
//# sourceMappingURL=shadow-caster-pipeline-resource.d.ts.map