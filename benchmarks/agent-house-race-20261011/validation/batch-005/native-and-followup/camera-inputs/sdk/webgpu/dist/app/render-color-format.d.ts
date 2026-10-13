export interface WebGpuAppRenderColorFormatContext {
    readonly initialization: {
        readonly format: string;
    };
    readonly sceneRenderFormat?: string;
}
export declare function webGpuAppScenePassColorFormat(app: WebGpuAppRenderColorFormatContext): string;
export declare function webGpuAppUsesHdrScenePass(app: WebGpuAppRenderColorFormatContext): boolean;
//# sourceMappingURL=render-color-format.d.ts.map