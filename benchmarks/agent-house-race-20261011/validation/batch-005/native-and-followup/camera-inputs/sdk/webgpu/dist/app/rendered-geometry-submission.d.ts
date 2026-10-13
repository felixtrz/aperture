import type { MeshTopology, RenderEntityRef } from "@aperture-engine/render";
import type { RenderPassCommand } from "../render/passes/render-pass-commands.js";
import type { RenderedGeometryOmission } from "./rendered-geometry-types.js";
import type { SubmittedGeometryDraw } from "./rendered-geometry-inspector.js";
/** Renderer-owned bindings, supplied from actual prepared resources, not ECS. */
export interface StaticGeometryDrawBinding {
    readonly renderId: number;
    readonly entity: RenderEntityRef;
    readonly meshKey: string;
    readonly positionBufferKey: string;
    readonly positionBufferSlot?: number;
    readonly worldTransformBindGroupKey: string;
    readonly sourceVertexCount: number;
    readonly submesh: number;
    readonly materialSlot: number;
    readonly topology: MeshTopology;
    readonly skinned: boolean;
    readonly morphed: boolean;
    readonly positionBuffer?: unknown;
    readonly indexBuffer?: unknown;
    readonly worldTransformBindGroup?: unknown;
}
export interface SubmittedWorldTransformBinding {
    /** Exact current uploaded bytes, including successfully applied dirty ranges. */
    readonly matrices: Float32Array;
    /** One packet reference per GPU transform slot, including reordered batches. */
    readonly slots: ReadonlyMap<number, StaticGeometryDrawBinding>;
    readonly slotsByRenderId?: ReadonlyMap<number, ReadonlyMap<number, StaticGeometryDrawBinding>>;
}
/**
 * Consume the FINAL per-view command span after layer/occlusion filtering.
 * Borrowed matrix windows are copied at the accepted submission, before any await.
 * A command's representative renderId cannot stand in for its other instances.
 */
export declare function collectSubmittedStaticGeometry(input: {
    readonly commands: readonly RenderPassCommand[];
    readonly viewId: number;
    readonly targetKey: string;
    /** All mesh packet ids in this route, including packets lacking a binding. */
    readonly meshRenderIds: ReadonlySet<number>;
    readonly draws: ReadonlyMap<number, StaticGeometryDrawBinding>;
    readonly transforms: ReadonlyMap<string, SubmittedWorldTransformBinding>;
}): {
    readonly draws: readonly SubmittedGeometryDraw[];
    readonly omissions: readonly RenderedGeometryOmission[];
};
//# sourceMappingURL=rendered-geometry-submission.d.ts.map