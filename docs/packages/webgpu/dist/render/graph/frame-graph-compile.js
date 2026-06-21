// compileFrameGraph: a PURE, headless-safe function that turns a FrameGraph into
// a deterministic, ordered, load/store-annotated execution plan plus a JSON-safe
// report. No GPU device is touched; calling it twice on the same graph yields
// deep-equal results.
//
// Two pieces of borrowed prior art (concepts only, no copied code):
//   * PlayCanvas FrameGraph._compilePasses (references/engine/src/scene/frame-graph.js)
//     — the renderTargetMap "store-on-no-clear" rule: when a later pass uses a
//     target without clearing it, the earlier producing pass must store. We
//     generalize it: a later *read* of a handle also forces the producer to store.
//   * three.js PassNode history model (references/three.js/src/nodes/display/PassNode.js)
//     — informs the history-texture handle kind consumed here (lifetime handling).
//
// Ordering is driven by declared read/write edges (D1, signed off): a write must
// precede a read of the same handle; same-handle writes keep builder insertion
// order; `before`/`after` sugar compiles to extra edges. A Kahn topological sort
// with insertion-index tiebreak yields a single deterministic order; a cycle is
// reported (never thrown).
export function compileFrameGraph(graph) {
    const nodes = graph.nodes.filter((node) => node.enabled !== false);
    const handles = graph.handles;
    const diagnostics = [];
    // ----- node-name index + duplicate detection ---------------------------
    const indexByName = new Map();
    for (let i = 0; i < nodes.length; i += 1) {
        const name = nodes[i].name;
        if (indexByName.has(name)) {
            diagnostics.push({
                code: "frameGraph.duplicateNodeName",
                message: `Duplicate pass node name '${name}'.`,
            });
        }
        else {
            indexByName.set(name, i);
        }
    }
    // ----- unknown-handle diagnostics (non-fatal) --------------------------
    for (const node of nodes) {
        for (const read of node.reads) {
            if (!handles.has(read)) {
                diagnostics.push({
                    code: "frameGraph.unknownReadHandle",
                    message: `Pass '${node.name}' reads undeclared handle '${read}'.`,
                });
            }
        }
        for (const write of node.writes) {
            if (!handles.has(write.handle)) {
                diagnostics.push({
                    code: "frameGraph.unknownWriteHandle",
                    message: `Pass '${node.name}' writes undeclared handle '${write.handle}'.`,
                });
            }
        }
    }
    // ----- build ordering edges -------------------------------------------
    // edge from -> to means `from` must execute before `to`.
    const edges = new Set();
    const adjacency = nodes.map(() => []);
    const inDegree = nodes.map(() => 0);
    const addEdge = (from, to) => {
        if (from === to) {
            return;
        }
        const key = `${from}->${to}`;
        if (edges.has(key)) {
            return;
        }
        edges.add(key);
        adjacency[from].push(to);
        inDegree[to] = inDegree[to] + 1;
    };
    const writersByHandle = new Map();
    for (let i = 0; i < nodes.length; i += 1) {
        for (const write of nodes[i].writes) {
            const list = writersByHandle.get(write.handle);
            if (list) {
                list.push(i);
            }
            else {
                writersByHandle.set(write.handle, [i]);
            }
        }
    }
    for (let i = 0; i < nodes.length; i += 1) {
        const node = nodes[i];
        // read-after-write: every writer of a read handle must precede this node.
        for (const read of node.reads) {
            const writers = writersByHandle.get(read);
            if (!writers) {
                continue;
            }
            for (const writer of writers) {
                addEdge(writer, i);
            }
        }
        // write-after-write: keep builder insertion order for same-handle writes.
        for (const write of node.writes) {
            const writers = writersByHandle.get(write.handle);
            if (!writers) {
                continue;
            }
            for (const writer of writers) {
                if (writer < i) {
                    addEdge(writer, i);
                }
            }
        }
        // ordering sugar compiles down to edges (edges remain the source of truth).
        if (node.after !== undefined) {
            const target = indexByName.get(node.after);
            if (target !== undefined) {
                addEdge(target, i);
            }
        }
        if (node.before !== undefined) {
            const target = indexByName.get(node.before);
            if (target !== undefined) {
                addEdge(i, target);
            }
        }
    }
    // ----- Kahn topological sort, insertion-index tiebreak -----------------
    const remainingInDegree = inDegree.slice();
    const order = [];
    const placed = new Array(nodes.length).fill(false);
    for (;;) {
        let next = -1;
        for (let i = 0; i < nodes.length; i += 1) {
            if (!placed[i] && remainingInDegree[i] === 0) {
                next = i;
                break;
            }
        }
        if (next === -1) {
            break;
        }
        placed[next] = true;
        order.push(next);
        for (const neighbor of adjacency[next]) {
            remainingInDegree[neighbor] = remainingInDegree[neighbor] - 1;
        }
    }
    const cycles = [];
    if (order.length < nodes.length) {
        const stuck = [];
        for (let i = 0; i < nodes.length; i += 1) {
            if (!placed[i]) {
                stuck.push(nodes[i].name);
            }
        }
        cycles.push(stuck);
        diagnostics.push({
            code: "frameGraph.cyclicDependency",
            message: `Cyclic resource dependency among passes: ${stuck.join(", ")}.`,
        });
        return buildFailedCompile(nodes.length, edges.size, diagnostics, cycles);
    }
    const orderedNodes = order.map((index) => nodes[index]);
    // ----- load/store inference (store-on-no-clear + read-forces-store) ----
    const loadStore = inferLoadStoreOps(orderedNodes, handles);
    // ----- transient aliasing (descriptor-keyed per-frame pool) ------------
    const aliasing = computeAliasing(orderedNodes, handles);
    const aliasedFromByHandle = new Map();
    for (const assignment of aliasing) {
        aliasedFromByHandle.set(assignment.handle, assignment.aliasedFrom);
    }
    // ----- JSON-safe report -----------------------------------------------
    const passes = orderedNodes.map((node) => {
        const ops = loadStore.get(node.name);
        return {
            name: node.name,
            kind: node.kind,
            reads: [...node.reads],
            writes: node.writes.map((write) => write.handle),
            colorLoadOp: ops ? ops.colorLoadOp : "none",
            depthLoadOp: ops ? ops.depthLoadOp : "none",
            storeOps: ops ? [...ops.writeStoreOps] : [],
            aliasedFrom: primaryAliasedFrom(node, aliasedFromByHandle),
        };
    });
    const report = {
        ok: true,
        nodeCount: nodes.length,
        edgeCount: edges.size,
        order: orderedNodes.map((node) => node.name),
        passes,
        cycles: [],
        diagnostics,
    };
    return {
        ok: true,
        orderedNodes,
        perNodeLoadStoreOps: loadStore,
        aliasing,
        diagnostics,
        report,
    };
}
function buildFailedCompile(nodeCount, edgeCount, diagnostics, cycles) {
    const report = {
        ok: false,
        nodeCount,
        edgeCount,
        order: [],
        passes: [],
        cycles: cycles.map((cycle) => [...cycle]),
        diagnostics: [...diagnostics],
    };
    return {
        ok: false,
        orderedNodes: [],
        perNodeLoadStoreOps: new Map(),
        aliasing: [],
        diagnostics: [...diagnostics],
        report,
    };
}
function isColorHandle(handle) {
    if (!handle) {
        return true; // undeclared handles default to color (best-effort)
    }
    const kind = handle.descriptor.kind;
    return (kind === "color-texture" ||
        kind === "history-texture" ||
        kind === "swapchain");
}
function isDepthHandle(handle) {
    return handle?.descriptor.kind === "depth-texture";
}
function keepsAcrossFrames(handle) {
    const lifetime = handle?.descriptor.lifetime;
    return lifetime === "imported" || lifetime === "persistent";
}
function inferLoadStoreOps(orderedNodes, handles) {
    // Per handle: ordered list of writes + the set of read order-positions.
    const writesByHandle = new Map();
    const readPositionsByHandle = new Map();
    for (let p = 0; p < orderedNodes.length; p += 1) {
        const node = orderedNodes[p];
        for (const write of node.writes) {
            const list = writesByHandle.get(write.handle);
            if (list) {
                list.push({ orderIndex: p, write });
            }
            else {
                writesByHandle.set(write.handle, [{ orderIndex: p, write }]);
            }
        }
        for (const read of node.reads) {
            const list = readPositionsByHandle.get(read);
            if (list) {
                list.push(p);
            }
            else {
                readPositionsByHandle.set(read, [p]);
            }
        }
    }
    // Compute store decision for each (handle, write) event.
    const storeByEvent = new Map();
    for (const [handleId, writeEvents] of writesByHandle) {
        const handle = handles.get(handleId);
        const reads = readPositionsByHandle.get(handleId) ?? [];
        for (let k = 0; k < writeEvents.length; k += 1) {
            const event = writeEvents[k];
            const nextWrite = writeEvents[k + 1];
            const upperBound = nextWrite ? nextWrite.orderIndex : Infinity;
            // a consumer reads this write's content before it is overwritten
            const consumedByRead = reads.some((r) => r > event.orderIndex && r < upperBound);
            // the next pass to use this target loads (does not clear) our content
            const loadedByNextWrite = nextWrite !== undefined && nextWrite.write.attachment === "load";
            // final producer of an externally-visible / cross-frame resource
            const isFinalWrite = nextWrite === undefined;
            const keptForLater = isFinalWrite && keepsAcrossFrames(handle);
            const store = consumedByRead || loadedByNextWrite || keptForLater
                ? "store"
                : "discard";
            storeByEvent.set(`${handleId}#${event.orderIndex}`, store);
        }
    }
    const result = new Map();
    for (let p = 0; p < orderedNodes.length; p += 1) {
        const node = orderedNodes[p];
        let colorLoadOp = "none";
        let colorStoreOp = "none";
        let depthLoadOp = "none";
        let depthStoreOp = "none";
        const writeStoreOps = [];
        for (const write of node.writes) {
            const handle = handles.get(write.handle);
            const store = storeByEvent.get(`${write.handle}#${p}`) ?? "discard";
            writeStoreOps.push(store);
            if (isDepthHandle(handle)) {
                if (depthLoadOp === "none") {
                    depthLoadOp = write.attachment;
                    depthStoreOp = store;
                }
            }
            else if (isColorHandle(handle)) {
                if (colorLoadOp === "none") {
                    colorLoadOp = write.attachment;
                    colorStoreOp = store;
                }
            }
        }
        result.set(node.name, {
            colorLoadOp,
            colorStoreOp,
            depthLoadOp,
            depthStoreOp,
            writeStoreOps,
        });
    }
    return result;
}
function descriptorKey(handle) {
    const d = handle.descriptor;
    return `${d.kind}:${d.width ?? 0}x${d.height ?? 0}:${d.format ?? ""}:${d.sampleCount ?? 1}`;
}
function computeAliasing(orderedNodes, handles) {
    // liveness per handle over the ordered nodes
    const first = new Map();
    const last = new Map();
    const touch = (id, p) => {
        if (!first.has(id)) {
            first.set(id, p);
        }
        last.set(id, p);
    };
    for (let p = 0; p < orderedNodes.length; p += 1) {
        const node = orderedNodes[p];
        for (const read of node.reads) {
            touch(read, p);
        }
        for (const write of node.writes) {
            touch(write.handle, p);
        }
    }
    // only transient handles participate in the per-frame pool
    const intervals = [];
    for (const [id, firstUse] of first) {
        const handle = handles.get(id);
        if (handle?.descriptor.lifetime !== "transient") {
            continue;
        }
        intervals.push({
            handle: id,
            first: firstUse,
            last: last.get(id) ?? firstUse,
        });
    }
    intervals.sort((a, b) => a.first - b.first || (a.handle < b.handle ? -1 : 1));
    const slots = [];
    const assignments = [];
    for (const interval of intervals) {
        const handle = handles.get(interval.handle);
        const key = descriptorKey(handle);
        let reusedSlot = -1;
        for (let s = 0; s < slots.length; s += 1) {
            const candidate = slots[s];
            if (candidate.key === key && candidate.freeAfter < interval.first) {
                reusedSlot = s;
                break;
            }
        }
        if (reusedSlot === -1) {
            slots.push({ key, freeAfter: interval.last, ownerId: interval.handle });
            assignments.push({
                handle: interval.handle,
                slot: slots.length - 1,
                aliasedFrom: null,
            });
        }
        else {
            const slot = slots[reusedSlot];
            const aliasedFrom = slot.ownerId;
            slot.freeAfter = interval.last;
            slot.ownerId = interval.handle;
            assignments.push({
                handle: interval.handle,
                slot: reusedSlot,
                aliasedFrom,
            });
        }
    }
    // stable order by handle id for deterministic reports
    assignments.sort((a, b) => a.handle < b.handle ? -1 : a.handle > b.handle ? 1 : 0);
    return assignments;
}
function primaryAliasedFrom(node, aliasedFromByHandle) {
    for (const write of node.writes) {
        if (aliasedFromByHandle.has(write.handle)) {
            return aliasedFromByHandle.get(write.handle) ?? null;
        }
    }
    return null;
}
//# sourceMappingURL=frame-graph-compile.js.map