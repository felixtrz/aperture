export interface PipelineScopedBindGroupResource {
    readonly group: number;
    readonly resourceKey: string;
    readonly layoutKey: string;
    readonly bindGroup: unknown;
    readonly entryResourceKeys: readonly string[];
}
export interface PipelineScopedBindGroupScratch {
    readonly pool: MutablePipelineScopedBindGroupResource[];
    count: number;
}
interface MutablePipelineScopedBindGroupResource {
    group: number;
    resourceKey: string;
    layoutKey: string;
    bindGroup: unknown;
    entryResourceKeys: string[];
}
export declare function createPipelineScopedBindGroupScratch(): PipelineScopedBindGroupScratch;
export declare function resetPipelineScopedBindGroupScratch(scratch: PipelineScopedBindGroupScratch): void;
export declare function appendPipelineScopedBindGroups(bindGroups: readonly PipelineScopedBindGroupResource[], pipelineKey: string, output: PipelineScopedBindGroupResource[], scratch: PipelineScopedBindGroupScratch): void;
export {};
//# sourceMappingURL=pipeline-scoped-bind-groups.d.ts.map