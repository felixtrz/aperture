export declare const OUTPUT_COLOR_SPACES: readonly ["linear", "srgb"];
export type OutputColorSpace = (typeof OUTPUT_COLOR_SPACES)[number];
export declare const DEFAULT_OUTPUT_COLOR_SPACE: OutputColorSpace;
export declare function isOutputColorSpace(value: unknown): value is OutputColorSpace;
export declare function parseOutputColorSpace(value: unknown): OutputColorSpace | null;
export declare function resolveOutputColorSpace(value: unknown): OutputColorSpace;
export declare function createOutputColorSpacePipelineKey(colorSpace: OutputColorSpace): string;
export declare function createOutputColorSpaceWgsl(colorSpace: OutputColorSpace): string;
//# sourceMappingURL=output-stage-color-space.d.ts.map