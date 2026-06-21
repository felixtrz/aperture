// TAA color-history pool (M3-T6): a persistent double-buffered pair of post
// textures that carries an effect's accumulation buffer across frames as a
// FrameGraph history resource, replacing the hand-threaded ping/pong closure.
//
//   current()  -> this frame's write target (a node declaring write 'current')
//   previous() -> last frame's written buffer (a node declaring read 'previous')
//
// At frame end the route calls pool.swap() exactly once, so this frame's write
// becomes next frame's previous with no read-write aliasing of one physical
// texture in any single frame. On resize both buffers are reallocated and the
// pool is recreated (swapCount 0 ⇒ hasPrevious() false), dropping stale history
// so a resized frame never samples a mismatched buffer — mirroring three.js
// PassNode's _previousTextures reallocation on setSize
// (references/three.js/src/nodes/display/PassNode.js; concept borrowed, not code).
import { createFrameGraphHistoryResource, } from "../render/graph/frame-graph-history.js";
import { createOrReuseWebGpuPostPassTexture, createWebGpuPostPassTextureCacheSlot, } from "./post-pass.js";
export function createWebGpuAppPostPassColorHistorySlot() {
    return {
        current: null,
        bufferA: createWebGpuPostPassTextureCacheSlot(),
        bufferB: createWebGpuPostPassTextureCacheSlot(),
    };
}
/**
 * Resolve (and lazily allocate / resize) the double-buffered color-history pool
 * for the given target dimensions and format. Returns the existing pool when the
 * descriptor is unchanged (history persists across frames); reallocates both
 * buffers and recreates the pool — dropping stale history — when width/height/
 * format changes.
 */
export function resolveWebGpuAppPostPassColorHistory(options) {
    const existing = options.slot.current;
    if (existing !== null &&
        existing.width === options.width &&
        existing.height === options.height &&
        existing.format === options.format) {
        return { history: existing, resized: false, diagnostics: [] };
    }
    const a = createOrReuseWebGpuPostPassTexture({
        device: options.device,
        slot: options.slot.bufferA,
        width: options.width,
        height: options.height,
        format: options.format,
        label: `${options.label}:history:a`,
    });
    const b = createOrReuseWebGpuPostPassTexture({
        device: options.device,
        slot: options.slot.bufferB,
        width: options.width,
        height: options.height,
        format: options.format,
        label: `${options.label}:history:b`,
    });
    const diagnostics = [
        ...a.diagnostics,
        ...b.diagnostics,
    ];
    if (!a.valid || a.resource === null || !b.valid || b.resource === null) {
        options.slot.current = null;
        return { history: null, resized: true, diagnostics };
    }
    const history = {
        pool: createFrameGraphHistoryResource(a.resource, b.resource),
        width: options.width,
        height: options.height,
        format: options.format,
    };
    options.slot.current = history;
    return { history, resized: true, diagnostics };
}
//# sourceMappingURL=post-color-history.js.map