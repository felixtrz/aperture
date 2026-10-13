import type { MeshIndexFormat, MeshTopology } from "@aperture-engine/render";
import type { ShadowCasterCullMode, ShadowCasterDrawListPlanReport } from "./shadow-caster-draw-list-plan.js";
import type { ShadowPassCommandEncodingReport } from "./shadow-pass-command-encoding-report.js";
export type ShadowCasterPipelineDescriptorStatus = "ready" | "deferred" | "missing" | "not-required";
export type ShadowCasterPipelineDescriptorDiagnosticCode = "shadowCasterPipelineDescriptor.missingCommandEncoding" | "shadowCasterPipelineDescriptor.missingDepthFormat" | "shadowCasterPipelineDescriptor.unsupportedTopology" | "shadowCasterPipelineDescriptor.commandEncodingDeferred" | "shadowCasterPipelineDescriptor.passSubmissionDeferred";
export interface ShadowCasterPipelineDescriptorDiagnostic {
    readonly code: ShadowCasterPipelineDescriptorDiagnosticCode;
    readonly severity: "warning" | "error";
    readonly message: string;
    readonly field?: string;
}
export interface ShadowCasterPipelineDescriptorMetadata {
    readonly pipelineKey: string;
    readonly label: string;
    readonly shader: {
        readonly family: "shadow-caster";
        readonly label: "shadow-caster-depth-only" | "shadow-caster-alpha-test";
        readonly entryPoints: {
            readonly vertex: "vs_main";
            readonly fragment: "fs_main";
        };
    };
    readonly vertex: {
        readonly buffers: readonly ("POSITION" | "TEXCOORD_0")[];
        readonly meshLayoutKey: string | null;
        readonly matrixBufferLayoutKey: "shadow-caster/group-0:directional-shadow-matrices@0";
    };
    /**
     * Alpha-test caster metadata (M4-T8). Present only on the alpha-test pipeline
     * variant: a second bind group binds the material baseColor texture + sampler
     * + alpha cutoff so the fragment can discard cutout fragments. Absent on the
     * opaque (position-only, empty-fragment) variant.
     */
    readonly alphaTest?: {
        readonly alphaCutoff: number;
        readonly baseColorTextureKey: string;
        readonly baseColorSamplerKey: string;
    };
    readonly index: {
        /** Triangle-list pipelines accept both indexed and non-indexed draws. */
        readonly required: boolean;
        readonly format: MeshIndexFormat;
    };
    readonly primitive: {
        readonly topology: "triangle-list";
        readonly cullMode: ShadowCasterCullMode;
        readonly frontFace: "ccw";
    };
    readonly depthStencil: {
        readonly format: "depth24plus";
        readonly depthWriteEnabled: true;
        readonly depthCompare: "less-equal";
        /** Constant depth bias in depth-buffer units (M4-T5). */
        readonly depthBias: number;
        /** Slope-scaled depth bias factor (M4-T5). */
        readonly depthBiasSlopeScale: number;
    };
    readonly colorTargets: readonly [];
}
export interface ShadowCasterPipelineDescriptorReport {
    readonly ready: boolean;
    readonly status: ShadowCasterPipelineDescriptorStatus;
    readonly commandRecordCount: number;
    readonly descriptorCount: number;
    readonly sections: {
        readonly commandEncoding: boolean;
        readonly vertexBufferLayout: boolean;
        readonly indexBuffer: boolean;
        readonly matrixBufferLayout: boolean;
        readonly depthStencil: boolean;
        readonly colorTargets: true;
        readonly pipelineCreation: false;
        readonly passSubmission: false;
        readonly shaderSampling: false;
    };
    readonly descriptor: ShadowCasterPipelineDescriptorMetadata | null;
    readonly descriptors: readonly ShadowCasterPipelineDescriptorMetadata[];
    readonly diagnostics: readonly ShadowCasterPipelineDescriptorDiagnostic[];
}
export type ShadowCasterPipelineDescriptorReportJsonValue = ShadowCasterPipelineDescriptorReport;
export interface CreateShadowCasterPipelineDescriptorReportOptions {
    readonly commandEncoding: ShadowPassCommandEncodingReport;
    readonly casterDrawList?: ShadowCasterDrawListPlanReport;
    readonly meshLayoutKeys?: readonly string[];
    readonly topology?: MeshTopology;
    readonly depthFormat?: "depth24plus" | "";
    readonly indexFormat?: MeshIndexFormat;
    /** Authored constant depth bias for the caster pipeline (M4-T5). */
    readonly depthBias?: number;
    /** Authored slope-scaled depth bias for the caster pipeline (M4-T5). */
    readonly slopeBias?: number;
    /**
     * Distinct caster cull modes present in the frame (three.js `shadowSide`
     * parity). One opaque descriptor is emitted per (meshLayoutKey, cullMode):
     * single-sided casters resolve to "front" (render back faces, the primary
     * self-shadow defense), double-sided to "none". Defaults to ["none"] (legacy
     * both-faces behavior) when absent.
     */
    readonly casterCullModes?: readonly ShadowCasterCullMode[];
    /**
     * Alpha-tested casters (M4-T8): each entry produces an additional alpha-test
     * pipeline variant (TEXCOORD_0 + baseColor discard) distinct from the opaque
     * position-only variant. Deduplicated by (meshLayoutKey, cutoff, textures).
     */
    readonly alphaTestCasters?: readonly AlphaTestCasterDescriptorInput[];
}
export interface AlphaTestCasterDescriptorInput {
    readonly meshLayoutKey: string | null;
    readonly alphaCutoff: number;
    readonly baseColorTextureKey: string;
    readonly baseColorSamplerKey: string;
}
export declare function createShadowCasterPipelineDescriptorReport(options: CreateShadowCasterPipelineDescriptorReportOptions): ShadowCasterPipelineDescriptorReport;
export declare function shadowCasterPipelineDescriptorReportToJsonValue(value: ShadowCasterPipelineDescriptorReport): ShadowCasterPipelineDescriptorReportJsonValue;
export declare function shadowCasterPipelineDescriptorReportToJson(value: ShadowCasterPipelineDescriptorReport): string;
export declare function shadowCasterPipelineKeyForMeshLayoutKey(meshLayoutKey?: string | null, cullMode?: ShadowCasterCullMode): string;
//# sourceMappingURL=shadow-caster-pipeline-descriptor.d.ts.map