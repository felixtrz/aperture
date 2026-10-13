export interface MaterialPipelineRenderStateTokens {
    readonly alphaMode: string | null;
    readonly cullMode: string | null;
    readonly frontFace: string | null;
    readonly depthCompare: string | null;
    readonly depthBias: number | null;
    readonly depthBiasSlopeScale: number | null;
    readonly blendPreset: string | null;
}
export interface WebGpuBlendComponentState {
    readonly srcFactor: string;
    readonly dstFactor: string;
    readonly operation: string;
}
export interface WebGpuBlendState {
    readonly color: WebGpuBlendComponentState;
    readonly alpha: WebGpuBlendComponentState;
}
export interface WebGpuPipelineRenderState {
    readonly alphaMode: string;
    readonly cullMode: string;
    readonly frontFace: "ccw" | "cw";
    readonly depthCompare: string;
    readonly depthWriteEnabled: boolean;
    readonly depthBias: number;
    readonly depthBiasSlopeScale: number;
    readonly blend: WebGpuBlendState | null;
}
export declare function parseMaterialPipelineRenderStateTokens(pipelineKey: string | undefined): MaterialPipelineRenderStateTokens;
export declare function resolveWebGpuPipelineRenderState(pipelineKey: string | undefined, depthFormat: string | null | undefined): WebGpuPipelineRenderState;
export declare function createWebGpuDepthStencilStateKey(depthFormat: string | null | undefined, renderState: WebGpuPipelineRenderState): {
    readonly format: string | null;
    readonly depthWriteEnabled: boolean;
    readonly depthCompare: string;
    readonly depthBias?: number;
    readonly depthBiasSlopeScale?: number;
};
export declare function createWebGpuDepthStencilDescriptor(depthFormat: string | null | undefined, renderState: WebGpuPipelineRenderState): {
    readonly format: string;
    readonly depthWriteEnabled: boolean;
    readonly depthCompare: string;
    readonly depthBias?: number;
    readonly depthBiasSlopeScale?: number;
} | null;
export declare function createWebGpuColorTargetStateKey(colorFormat: string, renderState: WebGpuPipelineRenderState): {
    readonly format: string;
    readonly blend: WebGpuBlendState | null;
    readonly writeMask: "all";
};
export declare function createWebGpuColorTargetDescriptor(colorFormat: string, renderState: WebGpuPipelineRenderState): {
    readonly format: string;
    readonly blend?: WebGpuBlendState;
};
//# sourceMappingURL=material-render-state.d.ts.map