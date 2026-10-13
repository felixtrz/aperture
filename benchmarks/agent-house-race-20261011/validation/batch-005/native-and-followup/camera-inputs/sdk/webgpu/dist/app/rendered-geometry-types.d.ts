import type { RenderEntityRef } from "@aperture-engine/render";
/** Opt-in CPU receipts. This never reads back GPU buffers or changes ECS state. */
export interface RenderedGeometryCaptureOptions {
    /** Includes upload receipts and the last submitted frame's instance matrices. */
    readonly maxRetainedBytes?: number;
}
export interface RenderedGeometryInspectionOptions {
    readonly maxBytes?: number;
    readonly maxMeshes?: number;
    readonly maxVertices?: number;
    readonly maxIndices?: number;
    readonly maxDraws?: number;
    readonly maxInstances?: number;
}
export interface RenderedGeometryMesh {
    readonly key: string;
    readonly sourceKey: string;
    readonly sourceVersion: number;
    readonly label: string;
    /** Packed local-space float32x3 source attributes, preserving vertex order. */
    readonly positions: Float32Array;
    /** null means the source had no NORMAL attribute; normals are never generated. */
    readonly normals: Float32Array | null;
    /** null preserves a non-indexed source; indices are never manufactured. */
    readonly indices: Uint16Array | Uint32Array | null;
}
export interface RenderedGeometryInstance {
    readonly renderId: number;
    readonly entity: RenderEntityRef;
}
export interface RenderedGeometryDraw {
    readonly renderId: number;
    readonly viewId: number;
    readonly targetKey: string;
    readonly meshKey: string;
    readonly submesh: number;
    readonly materialSlot: number;
    readonly indexed: boolean;
    readonly firstIndex: number;
    readonly indexCount: number;
    readonly baseVertex: number;
    readonly firstVertex: number;
    readonly vertexCount: number;
    readonly firstInstance: number;
    readonly instances: readonly RenderedGeometryInstance[];
    /** Column-major WORLD matrices, 16 floats per instance, in GPU instance order. */
    readonly worldMatrices: Float32Array;
}
export type RenderedGeometryOmissionReason = "capture-disabled" | "no-submitted-frame" | "capture-budget" | "request-budget" | "missing-upload-receipt" | "unsupported-position-format" | "unsupported-normal-format" | "unsupported-topology" | "skinned" | "morphed" | "custom-wgsl" | "user-pass" | "unsupported-route" | "invalid-source-data" | "missing-instance-binding" | "submission-failed";
export interface RenderedGeometryOmission {
    readonly reason: RenderedGeometryOmissionReason;
    readonly message: string;
    readonly renderId?: number;
}
export interface RenderedGeometryInspection {
    readonly status: "complete" | "partial" | "unavailable";
    readonly scope: "submitted-static-triangle-meshes";
    /** Monotonic renderer receipt number, distinct from a simulation frame. */
    readonly submissionSerial: number | null;
    readonly frame: number | null;
    readonly meshes: readonly RenderedGeometryMesh[];
    readonly draws: readonly RenderedGeometryDraw[];
    readonly omissions: readonly RenderedGeometryOmission[];
    /** Typed array bytes in this detached result, not GPU allocation statistics. */
    readonly copiedBytes: number;
    readonly retainedBytes: number;
    /** These are scope exclusions, not estimates of their submitted counts. */
    readonly excludedScopes: readonly [
        "shadow-only-draws",
        "sky-and-fullscreen",
        "sprites-ui-text-particles",
        "shader-displacement-and-fragment-visibility"
    ];
}
//# sourceMappingURL=rendered-geometry-types.d.ts.map