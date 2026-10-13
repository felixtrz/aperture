export type WebGpuMaterialPipelineFamily = "unlit" | "matcap" | "standard" | "debug-normal";
export declare function materialPipelineFamilyFromKey(pipelineKey: string): WebGpuMaterialPipelineFamily | null;
export declare function requiredBindGroupGroupsForPipelineKey(pipelineKey: string): readonly number[];
//# sourceMappingURL=material-pipeline-selection.d.ts.map