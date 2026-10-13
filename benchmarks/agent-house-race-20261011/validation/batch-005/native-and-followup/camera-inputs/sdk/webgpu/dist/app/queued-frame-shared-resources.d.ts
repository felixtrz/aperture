import type { PackedSnapshotTransforms, PackedSnapshotViewUniforms } from "@aperture-engine/render";
import { type ViewUniformBufferDescriptorScratch } from "../resources/views/view-uniform-buffer.js";
import { type ViewUniformGpuBufferResource } from "../resources/views/view-uniform-buffer-resource.js";
import { type WorldTransformBufferDescriptorScratch, type WorldTransformGpuBufferResource } from "../resources/transforms/world-transform-buffer.js";
import { type VersionedUploadStamp } from "./app-frame-resource-utils.js";
interface SharedViewUniformResource {
    readonly resource: ViewUniformGpuBufferResource;
    /** Allocated GPU byte capacity, not necessarily the current active byte length. */
    readonly byteLength: number;
    readonly uploadStamp: VersionedUploadStamp;
}
interface SharedWorldTransformResource {
    readonly resource: WorldTransformGpuBufferResource;
    /** Allocated GPU byte capacity, not necessarily the current active byte length. */
    readonly byteLength: number;
    readonly uploadStamp: VersionedUploadStamp;
}
export interface QueuedBuiltInSharedFrameResourceCache {
    viewUniform: SharedViewUniformResource | null;
    worldTransforms: SharedWorldTransformResource | null;
    readonly viewDescriptorScratch: ViewUniformBufferDescriptorScratch;
    readonly worldTransformDescriptorScratch: WorldTransformBufferDescriptorScratch;
}
export interface PrepareQueuedBuiltInSharedFrameResourcesResult {
    readonly valid: boolean;
    readonly viewUniform: ViewUniformGpuBufferResource | null;
    readonly worldTransforms: WorldTransformGpuBufferResource | null;
    readonly diagnostics: readonly unknown[];
}
export declare function createQueuedBuiltInSharedFrameResourceCache(): QueuedBuiltInSharedFrameResourceCache;
export declare function prepareQueuedBuiltInSharedFrameResources(input: {
    readonly device: unknown;
    readonly cache: QueuedBuiltInSharedFrameResourceCache;
    readonly viewUniforms: PackedSnapshotViewUniforms;
    readonly worldTransforms: PackedSnapshotTransforms;
}): PrepareQueuedBuiltInSharedFrameResourcesResult;
export {};
//# sourceMappingURL=queued-frame-shared-resources.d.ts.map