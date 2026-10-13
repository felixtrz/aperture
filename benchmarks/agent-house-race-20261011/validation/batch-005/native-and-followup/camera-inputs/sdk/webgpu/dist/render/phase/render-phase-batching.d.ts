export type RenderPhaseBatchScalar = string | number | boolean | null | undefined;
export interface RenderPhaseBatchKeyInput {
    readonly phase?: string | undefined;
    readonly passKey?: string | undefined;
    readonly pipelineKey?: string | undefined;
    readonly meshResourceKey?: string | undefined;
    readonly materialResourceKey?: string | undefined;
    readonly materialParameterKey?: string | undefined;
    readonly meshLayoutKey?: string | undefined;
    readonly topology?: string | undefined;
    readonly vertexBufferKeys?: readonly string[] | undefined;
    readonly indexBufferKey?: string | null | undefined;
    readonly indexFormat?: string | null | undefined;
    readonly bindGroupKeys?: readonly string[] | undefined;
    readonly submesh?: number | undefined;
    readonly vertexStart?: number | undefined;
    readonly vertexCount?: number | undefined;
    readonly indexStart?: number | undefined;
    readonly indexCount?: number | undefined;
    readonly cullMode?: string | undefined;
    readonly layerMask?: number | undefined;
    readonly lightMask?: number | undefined;
    readonly materialAlphaMode?: string | undefined;
    readonly receivesShadow?: boolean | undefined;
    readonly negativeScale?: boolean | undefined;
    readonly cullingGroupKey?: string | undefined;
    readonly extra?: readonly RenderPhaseBatchScalar[] | undefined;
}
export type RenderPhaseBatchMissReason = "ineligible" | "singleton" | "culling-granularity";
export interface RenderPhaseBatchRun<TRecord> {
    readonly key: string;
    readonly start: number;
    readonly end: number;
    readonly count: number;
    readonly records: readonly TRecord[];
}
export interface RenderPhaseBatchMiss<TRecord> {
    readonly reason: RenderPhaseBatchMissReason;
    readonly start: number;
    readonly end: number;
    readonly count: number;
    readonly records: readonly TRecord[];
}
export interface RenderPhaseBatchRunScratch<TRecord> {
    readonly runs: RenderPhaseBatchRun<TRecord>[];
    readonly misses: RenderPhaseBatchMiss<TRecord>[];
}
export interface WriteRenderPhaseBatchRunsOptions<TRecord> {
    readonly keyForRecord: (record: TRecord, index: number) => string;
    readonly eligibleForRecord?: (record: TRecord, index: number) => boolean;
    readonly minRunLength?: number;
    readonly includeRecords?: boolean;
}
export declare function createRenderPhaseBatchRunScratch<TRecord>(): RenderPhaseBatchRunScratch<TRecord>;
export declare function writeRenderPhaseBatchRuns<TRecord>(records: readonly TRecord[], scratch: RenderPhaseBatchRunScratch<TRecord>, options: WriteRenderPhaseBatchRunsOptions<TRecord>): RenderPhaseBatchRunScratch<TRecord>;
export declare function createRenderPhaseBatchKey(input: RenderPhaseBatchKeyInput): string;
//# sourceMappingURL=render-phase-batching.d.ts.map