import type { RenderPassNodeInput, ComputePassNodeInput } from "../render/graph/frame-graph.js";
/**
 * A write target for a user pass: a handle id, optionally with attachment
 * intent. A bare string defaults to `attachment: "load"` (augment existing
 * contents — the safe default for an injected pass) for render targets; the
 * intent is ignored for buffer handles.
 */
export type WebGpuAppPassWriteInput = string | {
    readonly handle: string;
    readonly attachment?: "clear" | "load";
    readonly clearColor?: readonly [number, number, number, number];
    readonly clearDepth?: number;
};
/**
 * The command sink + resource resolver passed to a user pass's encode(). Method
 * names are shared between render and compute; the pass `kind` selects which
 * command list each call records into (calling a render method inside a compute
 * pass, or vice versa, throws so authoring mistakes surface immediately).
 */
export interface WebGpuAppPassEncodeContext {
    /** Resolve a declared read handle to a sampleable GPU texture view. */
    view(handle: string): unknown;
    /** Resolve a declared buffer handle to its GPU buffer. */
    buffer(handle: string): unknown;
    /** Build an opaque bind group from named resources (never serialized). */
    bindings(entries: Readonly<Record<string, unknown>>): unknown;
    setPipeline(pipeline: unknown): void;
    setBindGroup(index: number, bindGroup: unknown): void;
    setVertexBuffer(slot: number, buffer: unknown): void;
    setIndexBuffer(buffer: unknown, format: string): void;
    draw(vertexCount: number, instanceCount?: number, firstVertex?: number, firstInstance?: number): void;
    drawIndexed(indexCount: number, instanceCount?: number, firstIndex?: number, baseVertex?: number, firstInstance?: number): void;
    setComputePipeline(pipeline: unknown): void;
    dispatchWorkgroups(x: number, y?: number, z?: number): void;
}
interface WebGpuAppPassDescriptorBase {
    readonly name: string;
    /** Handle ids this pass samples/consumes — drives ordering + load/store. */
    readonly reads?: readonly string[];
    /** Optional ordering sugar; compiles to an edge. Edges remain the truth. */
    readonly before?: string;
    readonly after?: string;
    readonly enabled?: boolean;
    encode(ctx: WebGpuAppPassEncodeContext): void;
}
export interface WebGpuAppRenderPassDescriptor extends WebGpuAppPassDescriptorBase {
    readonly kind?: "render";
    /**
     * Render targets declared by this pass. M3-T7 scope: a render pass is currently
     * drawn over the `"scene-color"` overlay target with LOAD (depth-tested against
     * scene depth); a declared write to a transient/history/swapchain is NOT yet
     * honored for render passes and is reported as a diagnostic. Use a compute pass
     * for arbitrary writable targets (those DO honor their declared writes).
     */
    readonly writes: readonly WebGpuAppPassWriteInput[];
}
export interface WebGpuAppComputePassDescriptor extends WebGpuAppPassDescriptorBase {
    readonly kind?: "compute";
    /** Buffers/textures written this pass (typically a declared transient buffer). */
    readonly writes?: readonly WebGpuAppPassWriteInput[];
}
export type WebGpuAppPassDescriptor = WebGpuAppRenderPassDescriptor | WebGpuAppComputePassDescriptor;
/**
 * A graph-ready node built from a user descriptor: a RenderPassNodeInput or
 * ComputePassNodeInput with `commands` populated and `kind` REQUIRED, so the
 * route layer (and tests) can discriminate on `kind` without a cast.
 */
export type WebGpuAppBuiltPassNode = (RenderPassNodeInput & {
    readonly kind: "render";
}) | (ComputePassNodeInput & {
    readonly kind: "compute";
});
/** Injected resolvers that turn string handle ids into concrete GPU resources. */
export interface WebGpuAppPassResolvers {
    view(handle: string): unknown;
    buffer(handle: string): unknown;
    createBindGroup(entries: Readonly<Record<string, unknown>>): unknown;
}
/**
 * The registry backing app.addRenderPass / addComputePass / removePass. Holds
 * user pass descriptors in insertion order (the deterministic topo tiebreaker);
 * the route layer calls buildUserPassNodes() each frame to turn them into
 * graph-ready PassNodes.
 */
export interface WebGpuAppUserPassRegistry {
    addRenderPass(descriptor: WebGpuAppRenderPassDescriptor): void;
    addComputePass(descriptor: WebGpuAppComputePassDescriptor): void;
    /** Remove a pass by name; returns true if one was removed. */
    removePass(name: string): boolean;
    has(name: string): boolean;
    /** Descriptors in insertion order. */
    list(): readonly WebGpuAppPassDescriptor[];
    readonly size: number;
}
export declare function createWebGpuAppUserPassRegistry(): WebGpuAppUserPassRegistry;
/**
 * Turn one user pass descriptor into a graph-ready node by invoking its
 * encode(ctx) with a command recorder. Returns a RenderPassNodeInput or
 * ComputePassNodeInput (commands populated) ready for graph.addRenderPass /
 * addComputePass. Pure given the resolvers — the route layer supplies GPU
 * resolvers; tests supply fakes.
 */
export declare function buildUserPassNode(descriptor: WebGpuAppPassDescriptor, resolvers: WebGpuAppPassResolvers): WebGpuAppBuiltPassNode;
/** Build graph-ready nodes for every enabled pass in the registry, in order. */
export declare function buildUserPassNodes(registry: WebGpuAppUserPassRegistry, resolvers: WebGpuAppPassResolvers): WebGpuAppBuiltPassNode[];
/**
 * AI-12: the shared "registered user passes cannot run on the legacy
 * multi-submit route" diagnostic — emitted by the legacy forward route
 * (frame-boundaries.ts) and the legacy post fallback (post-processing.ts) so a
 * pass that does not run is loud rather than a silent no-op. The FrameGraph
 * routes (forward no-post graph + post-effect graph) are the only routes that
 * execute user passes.
 */
export declare function createUserPassSkippedOnLegacyRouteDiagnostic(passes: readonly string[]): {
    readonly code: "webgpu.userPass.skippedOnLegacyRoute";
    readonly severity: "warning";
    readonly message: string;
    readonly data: {
        readonly passes: readonly string[];
    };
};
export {};
//# sourceMappingURL=user-pass.d.ts.map