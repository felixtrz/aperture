import type { BatchCompatibilityKey, RenderSnapshot } from "@aperture-engine/render";
import { WEBGPU_ID_BUFFER_FORMAT } from "./id-buffer.js";
import { type WebGpuBufferDeviceLike } from "../gpu/buffer.js";
import { type WebGpuShaderDeviceLike } from "../gpu/shader.js";
import type { WebGpuRenderPipelineCreateDescriptor, WebGpuRenderPipelineDeviceLike } from "../gpu/pipeline-cache.js";
import type { RenderPassCommand } from "../render/passes/render-pass-commands.js";
export type WebGpuIdBufferPickDiagnosticCode = "idBufferPick.unsupportedBatchKey" | "idBufferPick.shaderCreationFailed" | "idBufferPick.createRenderPipelineUnavailable" | "idBufferPick.pipelineCreationFailed" | "idBufferPick.createBufferFailed" | "idBufferPick.createBindGroupUnavailable" | "idBufferPick.pipelineLayoutUnavailable" | "idBufferPick.createBindGroupFailed" | "idBufferPick.createTextureUnavailable" | "idBufferPick.copyTextureToBufferUnavailable" | "idBufferPick.createReadbackBufferUnavailable" | "idBufferPick.invalidReadbackOrigin" | "idBufferPick.mapReadUnavailable" | "idBufferPick.readbackMapFailed" | "idBufferPick.mappedRangeUnavailable" | "idBufferPick.missingPickPipeline";
export interface WebGpuIdBufferPickDiagnostic {
    readonly code: WebGpuIdBufferPickDiagnosticCode;
    readonly message: string;
    readonly renderId?: number;
    readonly pipelineKey?: string;
}
export interface WebGpuIdBufferPickPipelineResource {
    readonly cacheKey: string;
    readonly shaderModule: unknown;
    readonly pipeline: unknown;
    readonly descriptor: WebGpuRenderPipelineCreateDescriptor;
    readonly layouts: {
        readonly view: unknown;
        readonly worldTransforms: unknown;
        readonly ids: unknown;
    };
}
export interface CreateWebGpuIdBufferPickPipelineResourceResult {
    readonly valid: boolean;
    readonly resource: WebGpuIdBufferPickPipelineResource | null;
    readonly diagnostics: readonly WebGpuIdBufferPickDiagnostic[];
}
export interface WebGpuIdBufferPickIdStorageResource {
    readonly resourceKey: string;
    readonly buffer: unknown;
    readonly ids: Uint32Array;
}
export interface CreateWebGpuIdBufferPickIdStorageResult {
    readonly valid: boolean;
    readonly resource: WebGpuIdBufferPickIdStorageResource | null;
    readonly diagnostics: readonly WebGpuIdBufferPickDiagnostic[];
}
export interface WebGpuIdBufferPickBindGroupResource {
    readonly group: number;
    readonly resourceKey: string;
    readonly bindGroup: unknown;
}
export interface CreateWebGpuIdBufferPickBindGroupResult {
    readonly valid: boolean;
    readonly resource: WebGpuIdBufferPickBindGroupResource | null;
    readonly diagnostics: readonly WebGpuIdBufferPickDiagnostic[];
}
export interface WebGpuIdBufferPickTextureResource {
    readonly texture: unknown;
    readonly width: number;
    readonly height: number;
    readonly format: typeof WEBGPU_ID_BUFFER_FORMAT;
    destroy?(): void;
}
export interface CreateWebGpuIdBufferPickTextureResult {
    readonly valid: boolean;
    readonly resource: WebGpuIdBufferPickTextureResource | null;
    readonly diagnostics: readonly WebGpuIdBufferPickDiagnostic[];
}
export interface WebGpuIdBufferPickReadbackSuccess {
    readonly ok: true;
    readonly id: number;
    readonly origin: {
        readonly x: number;
        readonly y: number;
    };
    readonly bytesPerRow: number;
}
export interface WebGpuIdBufferPickReadbackFailure {
    readonly ok: false;
    readonly reason: WebGpuIdBufferPickDiagnosticCode;
    readonly message: string;
    readonly origin?: {
        readonly x: number;
        readonly y: number;
    };
}
export type WebGpuIdBufferPickReadbackResult = WebGpuIdBufferPickReadbackSuccess | WebGpuIdBufferPickReadbackFailure;
export interface WebGpuIdBufferPickPipelineDeviceLike extends WebGpuShaderDeviceLike, WebGpuRenderPipelineDeviceLike {
    createBindGroupLayout?: (descriptor: unknown) => unknown;
    createPipelineLayout?: (descriptor: unknown) => unknown;
    pushErrorScope?: (filter: "validation") => void;
    popErrorScope?: () => Promise<{
        readonly message?: string;
    } | null>;
}
export interface WebGpuIdBufferPickBindGroupDeviceLike {
    createBindGroup?: (descriptor: unknown) => unknown;
}
export interface WebGpuIdBufferPickTextureDeviceLike {
    createTexture?: (descriptor: unknown) => {
        createView?: () => unknown;
        destroy?: () => void;
    };
}
export interface WebGpuIdBufferPickReadbackDeviceLike {
    readonly queue?: {
        submit?: (commandBuffers: readonly unknown[]) => void;
    };
    createCommandEncoder?: () => {
        copyTextureToBuffer?: (source: unknown, destination: unknown, copySize: unknown) => void;
        finish?: () => unknown;
    };
    createBuffer?: (descriptor: unknown) => {
        mapAsync?: (mode: number) => Promise<void>;
        getMappedRange?: () => ArrayBuffer | ArrayBufferView;
        unmap?: () => void;
    };
}
export declare function createWebGpuIdBufferPickPipelineResource(options: {
    readonly device: WebGpuIdBufferPickPipelineDeviceLike;
    readonly batchKey: BatchCompatibilityKey;
    readonly depthFormat?: string | null;
}): Promise<CreateWebGpuIdBufferPickPipelineResourceResult>;
export declare function webGpuIdBufferPickPipelineCacheKey(batchKey: BatchCompatibilityKey): string;
export declare function createWebGpuIdBufferPickIdStorageValues(snapshot: Pick<RenderSnapshot, "meshDraws" | "transforms">): Uint32Array;
export declare function createWebGpuIdBufferPickIdStorage(options: {
    readonly device: WebGpuBufferDeviceLike;
    readonly snapshot: Pick<RenderSnapshot, "meshDraws" | "transforms">;
}): CreateWebGpuIdBufferPickIdStorageResult;
export declare function createWebGpuIdBufferPickBindGroup(options: {
    readonly device: WebGpuIdBufferPickBindGroupDeviceLike;
    readonly pipeline: WebGpuIdBufferPickPipelineResource;
    readonly ids: WebGpuIdBufferPickIdStorageResource;
}): CreateWebGpuIdBufferPickBindGroupResult;
export declare function createWebGpuIdBufferPickTexture(options: {
    readonly device: WebGpuIdBufferPickTextureDeviceLike;
    readonly width: number;
    readonly height: number;
}): CreateWebGpuIdBufferPickTextureResult;
export declare function createWebGpuIdBufferPickCommands(options: {
    readonly commands: readonly RenderPassCommand[];
    readonly pipelineByKey: ReadonlyMap<string, WebGpuIdBufferPickPipelineResource>;
    readonly viewBindGroup: WebGpuIdBufferPickBindGroupResource;
    readonly worldTransformBindGroup: WebGpuIdBufferPickBindGroupResource;
    readonly idBindGroup: WebGpuIdBufferPickBindGroupResource;
}): {
    readonly valid: boolean;
    readonly commands: readonly RenderPassCommand[];
    readonly diagnostics: readonly WebGpuIdBufferPickDiagnostic[];
};
export declare function readWebGpuIdBufferPickPixel(options: {
    readonly device: WebGpuIdBufferPickReadbackDeviceLike;
    readonly texture: unknown;
    readonly width: number;
    readonly height: number;
    readonly x: number;
    readonly y: number;
    readonly mapModeRead?: number;
}): Promise<WebGpuIdBufferPickReadbackResult>;
//# sourceMappingURL=id-buffer-pick.d.ts.map