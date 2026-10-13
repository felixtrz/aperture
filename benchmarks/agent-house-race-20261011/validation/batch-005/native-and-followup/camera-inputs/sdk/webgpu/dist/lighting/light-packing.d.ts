import type { AreaLightShape, LightKind, LightPacket, RenderSnapshot } from "@aperture-engine/render";
import type { PackedTransformDirtyRange } from "@aperture-engine/render";
import type { WebGpuBufferDescriptor } from "../gpu/buffer.js";
import { type WebGpuBufferDeviceLike, type WebGpuBufferFailureReason } from "../gpu/buffer.js";
export declare const PACKED_LIGHT_FLOAT_STRIDE = 29;
export declare const PACKED_LIGHT_METADATA_STRIDE = 6;
export declare const PackedLightKindId: {
    readonly Ambient: 0;
    readonly Directional: 1;
    readonly Point: 2;
    readonly Spot: 3;
    readonly Environment: 4;
    readonly RectArea: 5;
};
export type PackedLightKindId = (typeof PackedLightKindId)[keyof typeof PackedLightKindId];
export declare const PackedAreaLightShapeId: {
    readonly Rect: 1;
    readonly Disk: 2;
    readonly Sphere: 3;
};
export type PackedAreaLightShapeId = (typeof PackedAreaLightShapeId)[keyof typeof PackedAreaLightShapeId];
export interface PackedLightPackets {
    readonly count: number;
    readonly floatStride: typeof PACKED_LIGHT_FLOAT_STRIDE;
    readonly metadataStride: typeof PACKED_LIGHT_METADATA_STRIDE;
    readonly floats: Float32Array;
    readonly metadata: Int32Array;
}
export interface LightPacketPackingScratch {
    floats: Float32Array;
    metadata: Int32Array;
    floatView: Float32Array;
    metadataView: Int32Array;
    readonly packed: {
        count: number;
        readonly floatStride: typeof PACKED_LIGHT_FLOAT_STRIDE;
        readonly metadataStride: typeof PACKED_LIGHT_METADATA_STRIDE;
        floats: Float32Array;
        metadata: Int32Array;
    };
    /** Previous frame's packed content for dirty diffing (AI-65). */
    previousFloats: Float32Array;
    previousMetadata: Int32Array;
    /** Element counts written on the previous frame (-1 before first write). */
    lastFloatCount: number;
    lastMetadataCount: number;
}
export declare const DEFAULT_LIGHT_BUFFER_RESOURCE_KEY = "light-buffer:main";
export type LightBufferUsageIntent = "read-only-storage";
export interface LightBufferDescriptor {
    readonly resourceKey: string;
    readonly usageIntent: LightBufferUsageIntent;
    readonly count: number;
    readonly byteLength: number;
    readonly floatByteLength: number;
    readonly metadataByteLength: number;
    readonly packed: PackedLightPackets;
    /**
     * Changed 4-byte-element windows vs the previous descriptor write through
     * the same scratch (AI-65): null = byte-identical (skip the upload), full =
     * no comparable history. Offsets/counts are elements of the corresponding
     * packed array (floats are f32, metadata is i32 — both 4 bytes).
     */
    readonly floatsDirty?: PackedTransformDirtyRange | null | undefined;
    readonly metadataDirty?: PackedTransformDirtyRange | null | undefined;
}
export interface LightBufferDescriptorScratch {
    readonly packing: LightPacketPackingScratch;
    readonly descriptor: {
        resourceKey: string;
        usageIntent: LightBufferUsageIntent;
        count: number;
        byteLength: number;
        floatByteLength: number;
        metadataByteLength: number;
        packed: PackedLightPackets;
        floatsDirty?: PackedTransformDirtyRange | null | undefined;
        metadataDirty?: PackedTransformDirtyRange | null | undefined;
    };
}
export interface CreateLightBufferDescriptorOptions {
    readonly resourceKey?: string;
}
export declare const DEFAULT_LIGHT_BUFFER_USAGE: number;
export type LightBufferDescriptorPlanDiagnosticCode = "lightBufferDescriptor.invalidUsageFlags";
export interface LightBufferDescriptorPlanDiagnostic {
    readonly code: LightBufferDescriptorPlanDiagnosticCode;
    readonly message: string;
    readonly field?: string;
}
export interface LightBufferDescriptorPlan {
    readonly resourceKey: string;
    readonly source: PackedLightPackets;
    readonly floatDescriptor: WebGpuBufferDescriptor;
    readonly metadataDescriptor: WebGpuBufferDescriptor;
}
export interface CreateLightBufferDescriptorPlanOptions {
    readonly label?: string;
    readonly usage?: number;
}
export interface CreateLightBufferDescriptorPlanResult {
    readonly valid: boolean;
    readonly plan: LightBufferDescriptorPlan | null;
    readonly diagnostics: readonly LightBufferDescriptorPlanDiagnostic[];
}
export interface LightBufferDescriptorPlanScratch {
    readonly floatDescriptor: {
        label?: string;
        size: number;
        usage: number;
        mappedAtCreation?: boolean;
        initialData?: ArrayBufferView;
    };
    readonly metadataDescriptor: {
        label?: string;
        size: number;
        usage: number;
        mappedAtCreation?: boolean;
        initialData?: ArrayBufferView;
    };
    readonly plan: {
        resourceKey: string;
        source: PackedLightPackets;
        floatDescriptor: WebGpuBufferDescriptor;
        metadataDescriptor: WebGpuBufferDescriptor;
    };
    readonly diagnostics: LightBufferDescriptorPlanDiagnostic[];
    readonly result: {
        valid: boolean;
        plan: LightBufferDescriptorPlan | null;
        diagnostics: readonly LightBufferDescriptorPlanDiagnostic[];
    };
}
export type LightGpuBufferDiagnosticCode = "lightGpuBuffer.nullDescriptorPlan" | "lightGpuBuffer.creationFailed";
export interface LightGpuBufferDiagnostic {
    readonly code: LightGpuBufferDiagnosticCode;
    readonly message: string;
    readonly reason?: WebGpuBufferFailureReason;
    readonly resourceKey?: string;
}
export interface LightGpuBufferResource {
    readonly resourceKey: string;
    readonly floatResourceKey: string;
    readonly metadataResourceKey: string;
    readonly floatBuffer: unknown;
    readonly metadataBuffer: unknown;
    readonly count: number;
}
export interface CreateLightGpuBuffersOptions {
    readonly device: WebGpuBufferDeviceLike;
    readonly plan: LightBufferDescriptorPlan | null;
}
export interface CreateLightGpuBuffersResult {
    readonly valid: boolean;
    readonly resource: LightGpuBufferResource | null;
    readonly diagnostics: readonly LightGpuBufferDiagnostic[];
}
export interface LightGpuBufferDiagnosticJsonValue {
    readonly code: LightGpuBufferDiagnosticCode;
    readonly message: string;
    readonly reason?: WebGpuBufferFailureReason;
    readonly resourceKey?: string;
}
export interface LightGpuBufferResourceJsonValue {
    readonly resourceKey: string;
    readonly floatResourceKey: string;
    readonly metadataResourceKey: string;
    readonly count: number;
}
export interface CreateLightGpuBuffersResultJsonValue {
    readonly valid: boolean;
    readonly resource: LightGpuBufferResourceJsonValue | null;
    readonly counts: {
        readonly lights: number;
        readonly gpuBuffers: number;
        readonly diagnostics: number;
    };
    readonly diagnostics: readonly LightGpuBufferDiagnosticJsonValue[];
}
export type PackLightPacketsInput = readonly LightPacket[] | (Pick<RenderSnapshot, "lights" | "transforms"> & Partial<Pick<RenderSnapshot, "shadowRequests">>);
export type CreateLightBufferDescriptorInput = PackedLightPackets | PackLightPacketsInput;
export declare function packLightPackets(input: PackLightPacketsInput): PackedLightPackets;
export declare function createLightPacketPackingScratch(lightCapacity?: number): LightPacketPackingScratch;
export declare function writePackedLightPackets(input: PackLightPacketsInput, scratch: LightPacketPackingScratch): PackedLightPackets;
export declare function createLightBufferDescriptor(input: CreateLightBufferDescriptorInput, options?: CreateLightBufferDescriptorOptions): LightBufferDescriptor;
export declare function createLightBufferDescriptorScratch(lightCapacity?: number): LightBufferDescriptorScratch;
export declare function writeLightBufferDescriptor(input: CreateLightBufferDescriptorInput, scratch: LightBufferDescriptorScratch, options?: CreateLightBufferDescriptorOptions): LightBufferDescriptor;
export declare function createLightBufferDescriptorPlan(descriptor: LightBufferDescriptor, options?: CreateLightBufferDescriptorPlanOptions): CreateLightBufferDescriptorPlanResult;
export declare function createLightBufferDescriptorPlanScratch(): LightBufferDescriptorPlanScratch;
export declare function writeLightBufferDescriptorPlan(descriptor: LightBufferDescriptor, scratch: LightBufferDescriptorPlanScratch, options?: CreateLightBufferDescriptorPlanOptions): CreateLightBufferDescriptorPlanResult;
export declare function createLightGpuBuffers(options: CreateLightGpuBuffersOptions): CreateLightGpuBuffersResult;
export declare function createLightGpuBuffersResultToJsonValue(result: CreateLightGpuBuffersResult): CreateLightGpuBuffersResultJsonValue;
export declare function createLightGpuBuffersResultToJson(result: CreateLightGpuBuffersResult): string;
export declare function packedLightKindId(kind: LightKind): PackedLightKindId;
export declare function packedAreaLightShapeId(shape: AreaLightShape | undefined): PackedAreaLightShapeId;
//# sourceMappingURL=light-packing.d.ts.map