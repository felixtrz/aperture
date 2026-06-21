// Public user-pass insertion API (M3-T7). Lets a library user inject custom
// render / compute passes into the frame graph via app.addRenderPass /
// app.addComputePass / app.removePass. The signed-off shape is M3 §Design
// decisions D1: a pass is a plain, JSON-describable node (name / kind / reads /
// writes / before / after) whose GPU work lives in an `encode(ctx)` callback
// that is NEVER serialized; resources are referenced by string id and ordering
// is driven by declared reads/writes edges (before/after is sugar that compiles
// to edges).
//
// encode(ctx) is invoked at graph-build time: ctx is a command recorder
// (setPipeline/draw → RenderPassCommand[]; setComputePipeline/dispatchWorkgroups
// → ComputePassCommand[]) plus a resource resolver (view / buffer / bindings).
// The recorded commands feed the existing single-encoder executor unchanged — so
// the callback model is a thin authoring layer over RenderPassCommand /
// ComputePassCommand, not a second execution path. This keeps the graph model
// GPU-free (resolvers are injected by the route layer; this module is headless).
//
// Reference (study, not copied): references/engine/src/platform/graphics/
// frame-pass.js (FramePass beforePasses/afterPasses insertion points).
export function createWebGpuAppUserPassRegistry() {
    // Insertion-ordered map keyed by name; re-adding a name replaces in place.
    const passes = new Map();
    const add = (descriptor) => {
        if (descriptor.name.length === 0) {
            throw new Error("A user pass requires a non-empty name.");
        }
        passes.set(descriptor.name, descriptor);
    };
    return {
        addRenderPass(descriptor) {
            add({ ...descriptor, kind: "render" });
        },
        addComputePass(descriptor) {
            add({ ...descriptor, kind: "compute" });
        },
        removePass(name) {
            return passes.delete(name);
        },
        has(name) {
            return passes.has(name);
        },
        list() {
            return [...passes.values()];
        },
        get size() {
            return passes.size;
        },
    };
}
function normalizeWrites(writes) {
    return (writes ?? []).map((write) => typeof write === "string"
        ? { handle: write, attachment: "load" }
        : {
            handle: write.handle,
            attachment: write.attachment ?? "load",
            ...(write.clearColor === undefined
                ? {}
                : { clearColor: write.clearColor }),
            ...(write.clearDepth === undefined
                ? {}
                : { clearDepth: write.clearDepth }),
        });
}
function createRecorderContext(name, kind, resolvers) {
    const renderCommands = [];
    const computeCommands = [];
    let seq = 0;
    const key = (suffix) => `user:${name}:${suffix}:${seq++}`;
    const renderOnly = (method) => {
        throw new Error(`Compute pass '${name}' called render method ctx.${method}() — use setComputePipeline/dispatchWorkgroups in a compute pass.`);
    };
    const computeOnly = (method) => {
        throw new Error(`Render pass '${name}' called compute method ctx.${method}() — use setPipeline/draw in a render pass.`);
    };
    const ctx = {
        view: (handle) => resolvers.view(handle),
        buffer: (handle) => resolvers.buffer(handle),
        bindings: (entries) => resolvers.createBindGroup(entries),
        setPipeline(pipeline) {
            if (kind !== "render") {
                renderOnly("setPipeline");
            }
            renderCommands.push({
                kind: "setPipeline",
                renderId: 0,
                pipelineKey: key("pipeline"),
                pipeline,
            });
        },
        setBindGroup(index, bindGroup) {
            if (kind === "render") {
                renderCommands.push({
                    kind: "setBindGroup",
                    renderId: 0,
                    index,
                    resourceKey: key("bind"),
                    bindGroup,
                });
            }
            else {
                computeCommands.push({
                    kind: "setComputeBindGroup",
                    index,
                    resourceKey: key("bind"),
                    bindGroup,
                });
            }
        },
        setVertexBuffer(slot, buffer) {
            if (kind !== "render") {
                renderOnly("setVertexBuffer");
            }
            renderCommands.push({
                kind: "setVertexBuffer",
                renderId: 0,
                slot,
                resourceKey: key("vbuf"),
                buffer,
            });
        },
        setIndexBuffer(buffer, format) {
            if (kind !== "render") {
                renderOnly("setIndexBuffer");
            }
            renderCommands.push({
                kind: "setIndexBuffer",
                renderId: 0,
                resourceKey: key("ibuf"),
                buffer,
                format,
            });
        },
        draw(vertexCount, instanceCount = 1, firstVertex = 0, firstInstance = 0) {
            if (kind !== "render") {
                renderOnly("draw");
            }
            renderCommands.push({
                kind: "draw",
                renderId: 0,
                vertexCount,
                instanceCount,
                firstVertex,
                firstInstance,
            });
        },
        drawIndexed(indexCount, instanceCount = 1, firstIndex = 0, baseVertex = 0, firstInstance = 0) {
            if (kind !== "render") {
                renderOnly("drawIndexed");
            }
            renderCommands.push({
                kind: "drawIndexed",
                renderId: 0,
                indexCount,
                instanceCount,
                firstIndex,
                baseVertex,
                firstInstance,
            });
        },
        setComputePipeline(pipeline) {
            if (kind !== "compute") {
                computeOnly("setComputePipeline");
            }
            computeCommands.push({
                kind: "setComputePipeline",
                pipelineKey: key("compute-pipeline"),
                pipeline,
            });
        },
        dispatchWorkgroups(x, y = 1, z = 1) {
            if (kind !== "compute") {
                computeOnly("dispatchWorkgroups");
            }
            computeCommands.push({
                kind: "dispatchWorkgroups",
                workgroupCountX: x,
                workgroupCountY: y,
                workgroupCountZ: z,
            });
        },
    };
    return { ctx, renderCommands, computeCommands };
}
/**
 * Turn one user pass descriptor into a graph-ready node by invoking its
 * encode(ctx) with a command recorder. Returns a RenderPassNodeInput or
 * ComputePassNodeInput (commands populated) ready for graph.addRenderPass /
 * addComputePass. Pure given the resolvers — the route layer supplies GPU
 * resolvers; tests supply fakes.
 */
export function buildUserPassNode(descriptor, resolvers) {
    const kind = descriptor.kind === "compute" ? "compute" : "render";
    const recorder = createRecorderContext(descriptor.name, kind, resolvers);
    descriptor.encode(recorder.ctx);
    const shared = {
        name: descriptor.name,
        reads: descriptor.reads ?? [],
        writes: normalizeWrites(descriptor.writes),
        ...(descriptor.before === undefined ? {} : { before: descriptor.before }),
        ...(descriptor.after === undefined ? {} : { after: descriptor.after }),
        ...(descriptor.enabled === undefined
            ? {}
            : { enabled: descriptor.enabled }),
    };
    if (kind === "compute") {
        return { ...shared, kind: "compute", commands: recorder.computeCommands };
    }
    return { ...shared, kind: "render", commands: recorder.renderCommands };
}
/** Build graph-ready nodes for every enabled pass in the registry, in order. */
export function buildUserPassNodes(registry, resolvers) {
    return registry
        .list()
        .filter((descriptor) => descriptor.enabled !== false)
        .map((descriptor) => buildUserPassNode(descriptor, resolvers));
}
/**
 * AI-12: the shared "registered user passes cannot run on the legacy
 * multi-submit route" diagnostic — emitted by the legacy forward route
 * (frame-boundaries.ts) and the legacy post fallback (post-processing.ts) so a
 * pass that does not run is loud rather than a silent no-op. The FrameGraph
 * routes (forward no-post graph + post-effect graph) are the only routes that
 * execute user passes.
 */
export function createUserPassSkippedOnLegacyRouteDiagnostic(passes) {
    return {
        code: "webgpu.userPass.skippedOnLegacyRoute",
        severity: "warning",
        message: `Registered user passes ${JSON.stringify(passes)} run only on the FrameGraph routes (forward graph or post-effect graph); the legacy multi-submit route skipped them. Enable useFrameGraph to run them.`,
        data: { passes },
    };
}
//# sourceMappingURL=user-pass.js.map