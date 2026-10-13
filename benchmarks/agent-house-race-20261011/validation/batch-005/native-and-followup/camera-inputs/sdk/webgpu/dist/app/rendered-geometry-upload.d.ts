import type { MeshAsset, MeshVertexAttributeDescriptor } from "@aperture-engine/render";
export interface RenderedMeshUploadReceipt {
    readonly key: string;
    readonly sourceKey: string;
    readonly sourceVersion: number;
    readonly label: string;
    readonly streams: readonly {
        readonly id: string;
        readonly stride: number;
        readonly vertexCount: number;
        readonly attributes: readonly MeshVertexAttributeDescriptor[];
        readonly bytes: Uint8Array;
    }[];
    readonly indices: {
        readonly format: "uint16" | "uint32";
        readonly count: number;
        readonly bytes: Uint8Array;
    } | null;
    readonly bytes: number;
}
export declare function meshUploadReceiptByteLength(mesh: MeshAsset): number;
/**
 * Call only after a successful upload. Fresh buffers receive all source bytes;
 * in-place reuse applies exactly the ranges sent to queue.writeBuffer. An empty
 * range list means no bytes changed, not a request for a full upload.
 */
export declare function createRenderedMeshUploadReceipt(input: {
    readonly key: string;
    readonly sourceKey: string;
    readonly sourceVersion: number;
    readonly mesh: MeshAsset;
    readonly reused: boolean;
    readonly previous?: RenderedMeshUploadReceipt;
}): RenderedMeshUploadReceipt;
export declare function findReceiptAttribute(receipt: RenderedMeshUploadReceipt, semantic: "POSITION" | "NORMAL"): {
    stream: {
        readonly id: string;
        readonly stride: number;
        readonly vertexCount: number;
        readonly attributes: readonly MeshVertexAttributeDescriptor[];
        readonly bytes: Uint8Array;
    };
    attribute: MeshVertexAttributeDescriptor;
} | null;
export declare function validateReceiptAttribute(found: NonNullable<ReturnType<typeof findReceiptAttribute>>): void;
export declare function copyReceiptAttribute(found: NonNullable<ReturnType<typeof findReceiptAttribute>>): Float32Array;
export declare function copyReceiptIndices(receipt: RenderedMeshUploadReceipt): Uint16Array | Uint32Array | null;
//# sourceMappingURL=rendered-geometry-upload.d.ts.map