import type { RenderSnapshot } from "@aperture-engine/render";
import { type WebGpuIdBufferPickBindGroupResource, type WebGpuIdBufferPickPipelineResource } from "../picking/id-buffer-pick.js";
export declare function webGpuAppPickPixel(dimensions: {
    readonly width: number;
    readonly height: number;
}, x: number, y: number): {
    readonly x: number;
    readonly y: number;
} | null;
export declare function pushWebGpuPickErrorScope(device: unknown): void;
export declare function popWebGpuPickErrorScope(device: unknown): Promise<string | null>;
export declare function createWebGpuAppPickSharedBindGroups(options: {
    readonly device: unknown;
    readonly pipeline: WebGpuIdBufferPickPipelineResource;
    readonly viewUniformBuffer: unknown;
    readonly worldTransformBuffer: unknown;
}): {
    readonly valid: boolean;
    readonly viewBindGroup: WebGpuIdBufferPickBindGroupResource;
    readonly worldTransformBindGroup: WebGpuIdBufferPickBindGroupResource;
    readonly diagnostics: readonly unknown[];
};
export declare function getOrCreateWebGpuIdBufferPickPipelines(options: {
    readonly app: {
        readonly initialization: {
            readonly device: unknown;
        };
    };
    readonly cache: {
        readonly idPickPipelines: Map<string, WebGpuIdBufferPickPipelineResource>;
    };
    readonly snapshot: Pick<RenderSnapshot, "meshDraws">;
    /**
     * The frame plan's renderId → resolved pipeline cache key map. Draw commands
     * carry the resolved key (not the authored batch key), so the returned pick
     * pipeline map must be keyed by the exact same derivation
     * (resolveDrawCommandPipelineKey) or pick command rewriting reports
     * idBufferPick.missingPickPipeline.
     */
    readonly pipelineKeysByRenderId?: ReadonlyMap<number, string>;
}): Promise<{
    readonly valid: boolean;
    readonly pipelines: ReadonlyMap<string, WebGpuIdBufferPickPipelineResource>;
    readonly diagnostics: readonly unknown[];
}>;
//# sourceMappingURL=picking.d.ts.map