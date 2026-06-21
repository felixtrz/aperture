// FrameGraph: the pure, headless-safe data model for a single rendered frame (M3).
//
// A frame is described as a list of named PassNodes (render AND compute) that
// declare which string-named resource handles they read and write. The handles
// plus their descriptors live in a handle map keyed by stable id (mirroring
// PlayCanvas FrameGraph's renderTargetMap keyed by RenderTarget — see
// references/engine/src/scene/frame-graph.js — and three.js PassNode's
// _previousTextures history model in references/three.js/src/nodes/display/PassNode.js;
// concepts borrowed, not code).
//
// This layer has NO GPU side effects: no device, no encoder, no texture
// allocation. It only accumulates JSON-describable metadata + opaque command
// lists. compileFrameGraph (frame-graph-compile.ts) turns it into an ordered,
// load/store-annotated plan. The executor (M3-T2) is the only layer that touches
// the GPU. Keeping this split is an architectural invariant: the graph model
// stays worker/headless-safe.
export const SWAPCHAIN_HANDLE_ID = "swapchain";
export function createFrameGraph() {
    const handles = new Map();
    const nodes = [];
    function declareResource(handle) {
        handles.set(handle.id, handle);
        return handle;
    }
    function addRenderPass(node) {
        const resolved = {
            ...node,
            kind: "render",
            enabled: node.enabled ?? true,
        };
        nodes.push(resolved);
        return resolved;
    }
    function addComputePass(node) {
        const resolved = {
            ...node,
            kind: "compute",
            enabled: node.enabled ?? true,
        };
        nodes.push(resolved);
        return resolved;
    }
    return {
        handles,
        nodes,
        addRenderPass,
        addComputePass,
        declareResource,
        declareTransient(id, descriptor) {
            return declareResource({
                id,
                descriptor: { ...descriptor, lifetime: "transient" },
            });
        },
        declareHistory(id, descriptor) {
            return declareResource({
                id,
                descriptor: {
                    ...descriptor,
                    kind: "history-texture",
                    lifetime: "persistent",
                    history: true,
                },
            });
        },
        importSwapchain(id = SWAPCHAIN_HANDLE_ID) {
            return declareResource({
                id,
                descriptor: { kind: "swapchain", lifetime: "imported" },
            });
        },
        importDepth(id, descriptor) {
            return declareResource({
                id,
                descriptor: {
                    ...descriptor,
                    kind: "depth-texture",
                    lifetime: "imported",
                },
            });
        },
        handle(id) {
            return handles.get(id);
        },
        reset() {
            handles.clear();
            nodes.length = 0;
        },
    };
}
//# sourceMappingURL=frame-graph.js.map