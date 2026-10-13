import type { RenderSnapshot } from "./snapshot.js";
import type { PackedSnapshotTransforms, PackedSnapshotTransformsScratch } from "./transform-pack-types.js";
export { createPackedSnapshotInstanceAttributesScratch, createPackedSnapshotInstanceTintsScratch, createPackedSnapshotPreviousTransformsScratch, createPackedSnapshotTransformsScratch, } from "./transform-pack-scratch.js";
export type * from "./transform-pack-types.js";
export { rememberPackedSnapshotTransformsByRenderId, writePackedSnapshotPreviousTransforms, } from "./transform-pack-history.js";
export { packSnapshotInstanceAttributesForVertexBuffer, packSnapshotInstanceTints, packSnapshotInstanceTintsForVertexBuffer, writePackedSnapshotInstanceAttributesForVertexBuffer, writePackedSnapshotInstanceTintsForVertexBuffer, } from "./transform-pack-instances.js";
export declare function packSnapshotTransforms(snapshot: Pick<RenderSnapshot, "meshDraws" | "transforms">): PackedSnapshotTransforms;
/**
 * Above this fraction of changed floats the dirty range degrades to one full
 * write (`full: true`) — a near-whole-buffer sub-range write has no upload
 * advantage over a plain whole-buffer write (AI-64 fallback).
 */
export declare const TRANSFORM_DIRTY_FULL_WRITE_FRACTION = 0.5;
export declare const TRANSFORM_DIRTY_FULL_SPAN_FRACTION = 0.875;
export declare const TRANSFORM_DIRTY_MAX_RANGES = 16;
export declare function writePackedSnapshotTransforms(snapshot: Pick<RenderSnapshot, "meshDraws" | "transforms">, scratch: PackedSnapshotTransformsScratch): PackedSnapshotTransforms;
/**
 * Packs only transforms referenced by mesh draw packets into a compact
 * render-world buffer. Full snapshots can contain camera, light, audio, bounds,
 * and helper transforms that mesh shaders never read; keeping those in the mesh
 * world-transform GPU buffer causes unrelated ECS movement to dirty every mesh
 * route. The packed offsets remain renderId-addressable, so render queues,
 * previous-transform history, instance tints, and instance attributes can keep
 * using the normal packed-transform contract.
 */
export declare function writePackedSnapshotMeshTransforms(snapshot: Pick<RenderSnapshot, "meshDraws" | "transforms">, scratch: PackedSnapshotTransformsScratch): PackedSnapshotTransforms;
//# sourceMappingURL=transform-pack.d.ts.map