import { copyReceiptAttribute, copyReceiptIndices, createRenderedMeshUploadReceipt, findReceiptAttribute, meshUploadReceiptByteLength, validateReceiptAttribute, } from "./rendered-geometry-upload.js";
const MiB = 1024 * 1024;
const DEFAULT_CAPTURE_BYTES = 32 * MiB;
const MAX_CAPTURE_BYTES = 128 * MiB;
const EXCLUDED_SCOPES = Object.freeze([
    "shadow-only-draws",
    "sky-and-fullscreen",
    "sprites-ui-text-particles",
    "shader-displacement-and-fragment-visibility",
]);
const DEFAULT_REQUEST = Object.freeze({
    maxBytes: 16 * MiB,
    maxMeshes: 1024,
    maxVertices: 250_000,
    maxIndices: 750_000,
    maxDraws: 4096,
    maxInstances: 25_000,
});
const MAX_REQUEST = Object.freeze({
    maxBytes: MAX_CAPTURE_BYTES,
    maxMeshes: 4096,
    maxVertices: 2_000_000,
    maxIndices: 6_000_000,
    maxDraws: 10_000,
    maxInstances: 100_000,
});
/** Internal derived observer. Do not re-export this factory on the public barrel. */
export function createRenderedGeometryInspector(setting = false) {
    const limit = setting === false
        ? 0
        : boundedInteger(setting.maxRetainedBytes ?? DEFAULT_CAPTURE_BYTES, MAX_CAPTURE_BYTES, "maxRetainedBytes");
    if (setting !== false && limit === 0)
        throw new RangeError("Geometry capture maxRetainedBytes must be positive.");
    const uploads = new Map();
    const meshes = new Map();
    const currentMeshBuffers = new WeakMap();
    const worlds = new Map();
    const indirects = new Map();
    const groups = new WeakMap();
    const pending = new Set();
    let last = null;
    let serial = 0;
    let disposed = false;
    const retainedBytes = () => {
        const receipts = new Set(uploads.values());
        const arrays = new Set(pending);
        if (last !== null)
            arrays.add(last.draws);
        for (const entries of arrays)
            for (const entry of entries)
                if (entry.receipt !== null)
                    receipts.add(entry.receipt);
        let bytes = 0;
        for (const receipt of receipts)
            bytes += receipt.bytes;
        for (const world of worlds.values())
            bytes += world.bytes.byteLength;
        for (const indirect of indirects.values())
            bytes += indirect.bytes.byteLength;
        for (const entries of arrays)
            for (const entry of entries)
                bytes += entry.draw.worldMatrices.byteLength;
        return bytes;
    };
    const result = (status, omissions, meshes = [], draws = [], copiedBytes = 0) => Object.freeze({
        status,
        scope: "submitted-static-triangle-meshes",
        submissionSerial: last?.serial ?? null,
        frame: last?.frame ?? null,
        meshes: Object.freeze(meshes),
        draws: Object.freeze(draws),
        omissions: Object.freeze(omissions.map((entry) => Object.freeze({ ...entry }))),
        copiedBytes,
        retainedBytes: retainedBytes(),
        excludedScopes: EXCLUDED_SCOPES,
    });
    return {
        enabled: limit > 0,
        /** Called only for a successful fresh upload or successful in-place update. */
        uploaded(input) {
            if (limit === 0 || disposed)
                return;
            const previous = uploads.get(input.previousKey ?? input.key);
            const bytes = meshUploadReceiptByteLength(input.mesh);
            // No allocation until the actual byte budget permits this copy. The
            // previous receipt may remain pinned by the last submitted frame.
            if (!Number.isSafeInteger(bytes) ||
                bytes < 0 ||
                retainedBytes() + bytes > limit ||
                uploads.size >= MAX_REQUEST.maxMeshes) {
                uploads.delete(input.key);
                return;
            }
            try {
                const receipt = createRenderedMeshUploadReceipt({
                    ...input,
                    ...(previous === undefined ? {} : { previous }),
                });
                uploads.set(input.key, receipt);
                const position = findReceiptAttribute(receipt, "POSITION");
                const buffer = input.resource?.vertexBuffers.find((entry) => entry.streamId === position?.stream.id);
                if (buffer !== undefined) {
                    meshes.set(input.key, {
                        positionBufferKey: buffer.resourceKey,
                        positionBuffer: buffer.buffer,
                        indexBuffer: input.resource?.indexBuffer?.buffer ?? null,
                    });
                    if (typeof buffer.buffer === "object" && buffer.buffer !== null)
                        currentMeshBuffers.set(buffer.buffer, input.key);
                    const index = input.resource?.indexBuffer?.buffer;
                    if (typeof index === "object" && index !== null)
                        currentMeshBuffers.set(index, input.key);
                }
            }
            catch {
                // Unknown previous bytes or malformed input must never become a guessed
                // receipt. Rendering itself can remain successful without inspection.
                uploads.delete(input.key);
            }
        },
        /** Same-version cache hits leave the previous uploaded bytes untouched. */
        releaseMesh(key) {
            uploads.delete(key);
            meshes.delete(key);
        },
        meshBinding(key) {
            const mesh = meshes.get(key);
            if (mesh === undefined ||
                typeof mesh.positionBuffer !== "object" ||
                mesh.positionBuffer === null ||
                currentMeshBuffers.get(mesh.positionBuffer) !== key)
                return null;
            if (mesh.indexBuffer !== null &&
                (typeof mesh.indexBuffer !== "object" ||
                    currentMeshBuffers.get(mesh.indexBuffer) !== key))
                return null;
            return mesh;
        },
        deviceObserver: {
            worldBufferCreated(buffer, resourceKey, capacity, initial) {
                if (disposed ||
                    limit === 0 ||
                    worlds.size >= 64 ||
                    !Number.isSafeInteger(capacity) ||
                    capacity < initial.byteLength ||
                    capacity % 4 !== 0 ||
                    retainedBytes() + capacity > limit)
                    return;
                const bytes = new Uint8Array(capacity);
                bytes.set(new Uint8Array(initial.buffer, initial.byteOffset, initial.byteLength));
                worlds.set(buffer, { resourceKey, bytes, validPrefix: capacity });
            },
            indirectBufferCreated(buffer, resourceKey, capacity) {
                if (disposed ||
                    limit === 0 ||
                    indirects.size >= 64 ||
                    !Number.isSafeInteger(capacity) ||
                    capacity < 0 ||
                    capacity % 4 !== 0 ||
                    retainedBytes() + capacity > limit)
                    return;
                indirects.set(buffer, {
                    resourceKey,
                    bytes: new Uint8Array(capacity),
                    validPrefix: capacity,
                });
            },
            bufferWritten(buffer, offset, data, dataOffset = 0, size) {
                const world = worlds.get(buffer) ?? indirects.get(buffer);
                if (world === undefined)
                    return;
                const view = ArrayBuffer.isView(data);
                const width = view
                    ? (data
                        .BYTES_PER_ELEMENT ?? 1)
                    : 1;
                const sourceOffset = dataOffset * width;
                const available = view ? data.byteLength : data.byteLength;
                const byteLength = size === undefined ? available - sourceOffset : size * width;
                if (!Number.isSafeInteger(offset) ||
                    offset < 0 ||
                    !Number.isSafeInteger(sourceOffset) ||
                    sourceOffset < 0 ||
                    !Number.isSafeInteger(byteLength) ||
                    byteLength < 0 ||
                    sourceOffset + byteLength > available ||
                    offset + byteLength > world.bytes.length) {
                    world.validPrefix = 0;
                    return;
                }
                const source = view ? data.buffer : data;
                const base = view ? data.byteOffset : 0;
                world.bytes.set(new Uint8Array(source, base + sourceOffset, byteLength), offset);
                if (offset <= world.validPrefix)
                    world.validPrefix = Math.max(world.validPrefix, offset + byteLength);
            },
            bufferInvalidated(buffer) {
                const world = worlds.get(buffer) ?? indirects.get(buffer);
                if (world !== undefined)
                    world.validPrefix = 0;
            },
            bufferDestroyed(buffer) {
                worlds.delete(buffer);
                indirects.delete(buffer);
            },
            bindGroupCreated(group, descriptor) {
                if (typeof group !== "object" ||
                    group === null ||
                    typeof descriptor !== "object" ||
                    descriptor === null)
                    return;
                const entries = descriptor.entries;
                if (!Array.isArray(entries) || entries.length > 64)
                    return;
                const resource = entries.find((entry) => entry.binding === 0)?.resource;
                if (resource?.buffer === undefined || !worlds.has(resource.buffer))
                    return;
                const offset = resource.offset ?? 0;
                const size = resource.size;
                if (!Number.isSafeInteger(offset) ||
                    offset < 0 ||
                    offset % 4 !== 0 ||
                    (size !== undefined &&
                        (!Number.isSafeInteger(size) || size < 0 || size % 4 !== 0)))
                    return;
                groups.set(group, { buffer: resource.buffer, offset, size });
            },
        },
        worldBinding(group) {
            if (typeof group !== "object" || group === null)
                return null;
            const binding = groups.get(group);
            if (binding === undefined)
                return null;
            const world = worlds.get(binding.buffer);
            if (world === undefined || binding.offset > world.validPrefix)
                return null;
            const end = binding.size === undefined
                ? world.validPrefix
                : binding.offset + binding.size;
            if (end > world.validPrefix)
                return null;
            return {
                resourceKey: world.resourceKey,
                matrices: new Float32Array(world.bytes.buffer, binding.offset, Math.floor((end - binding.offset) / 4)),
            };
        },
        indirectCommand(command) {
            if (command.kind !== "drawIndirect" &&
                command.kind !== "drawIndexedIndirect")
                return command;
            const receipt = indirects.get(command.buffer);
            const bytes = command.kind === "drawIndirect" ? 16 : 20;
            if (receipt === undefined ||
                !Number.isSafeInteger(command.offset) ||
                command.offset < 0 ||
                command.offset % 4 !== 0 ||
                command.offset + bytes > receipt.validPrefix ||
                receipt.resourceKey !== command.resourceKey)
                return command;
            const view = new DataView(receipt.bytes.buffer, command.offset, bytes);
            return command.kind === "drawIndexedIndirect"
                ? {
                    kind: "drawIndexed",
                    renderId: command.renderId,
                    indexCount: view.getUint32(0, true),
                    instanceCount: view.getUint32(4, true),
                    firstIndex: view.getUint32(8, true),
                    baseVertex: view.getInt32(12, true),
                    firstInstance: view.getUint32(16, true),
                }
                : {
                    kind: "draw",
                    renderId: command.renderId,
                    vertexCount: view.getUint32(0, true),
                    instanceCount: view.getUint32(4, true),
                    firstVertex: view.getUint32(8, true),
                    firstInstance: view.getUint32(12, true),
                };
        },
        beginFrame(frame) {
            if (limit === 0 || disposed)
                return null;
            if (!Number.isSafeInteger(frame) || frame < 0)
                throw new RangeError("A geometry frame must be a non-negative safe integer.");
            const captured = [];
            const omissions = [];
            let unavailable = pending.size >= 16;
            let closed = false;
            let submitted = false;
            if (!unavailable)
                pending.add(captured);
            const publish = () => {
                last = { frame, serial, draws: captured, omissions, unavailable };
            };
            return {
                submitted(input) {
                    if (closed || disposed)
                        return;
                    // Called synchronously immediately after a successful queue submission,
                    // before GPU readback/report awaits can complete out of order.
                    serial += 1;
                    submitted = true;
                    omissions.push(...(input.omissions ?? []).map((entry) => ({ ...entry })));
                    if (input.unsupportedRoute !== undefined) {
                        unavailable = true;
                        captured.length = 0;
                        omissions.push({
                            reason: input.unsupportedRoute,
                            message: "This submitted route can alter geometry outside static CPU receipts.",
                        });
                    }
                    const matricesBytes = input.draws.reduce((sum, draw) => sum + draw.worldMatrices.byteLength, 0);
                    const instances = captured.reduce((sum, entry) => sum + entry.draw.instances.length, 0) +
                        input.draws.reduce((sum, draw) => sum + draw.instances.length, 0);
                    if (unavailable ||
                        captured.length + input.draws.length > MAX_REQUEST.maxDraws ||
                        instances > MAX_REQUEST.maxInstances ||
                        retainedBytes() + matricesBytes > limit) {
                        unavailable = true;
                        captured.length = 0;
                        if (input.unsupportedRoute === undefined)
                            omissions.push({
                                reason: "capture-budget",
                                message: "Submitted geometry exceeds retained capture limits.",
                            });
                    }
                    else
                        for (const draw of input.draws) {
                            if (draw.omission !== undefined) {
                                omissions.push({ ...draw.omission });
                                continue;
                            }
                            if (draw.worldMatrices.length !== draw.instances.length * 16 ||
                                !draw.worldMatrices.every(Number.isFinite)) {
                                omissions.push({
                                    reason: "missing-instance-binding",
                                    renderId: draw.renderId,
                                    message: "The exact submitted instance window is unavailable.",
                                });
                                continue;
                            }
                            captured.push({
                                receipt: uploads.get(draw.meshKey) ?? null,
                                draw: Object.freeze({
                                    ...copyDrawMetadata(draw),
                                    instances: Object.freeze(draw.instances.map((entry) => Object.freeze({
                                        renderId: entry.renderId,
                                        entity: Object.freeze({ ...entry.entity }),
                                    }))),
                                    worldMatrices: draw.worldMatrices.slice(),
                                }),
                            });
                        }
                    publish();
                },
                failedTarget(message) {
                    if (closed)
                        return;
                    omissions.push({ reason: "submission-failed", message });
                    // An older operation finishing must never overwrite a newer submit.
                    if (submitted && last?.draws === captured)
                        last = { ...last, omissions };
                },
                close() {
                    closed = true;
                    pending.delete(captured);
                },
            };
        },
        inspect(options = {}) {
            const budget = {
                ...DEFAULT_REQUEST,
            };
            for (const key of Object.keys(MAX_REQUEST))
                budget[key] = boundedInteger(options[key] ?? budget[key], MAX_REQUEST[key], key);
            if (disposed)
                throw new Error("Aperture WebGPU app was disposed.");
            if (limit === 0)
                return result("unavailable", [
                    {
                        reason: "capture-disabled",
                        message: "Enable render.geometryInspection before rendering to retain submitted mesh receipts.",
                    },
                ]);
            if (last === null)
                return result("unavailable", [
                    {
                        reason: "no-submitted-frame",
                        message: "No submitted frame has a geometry receipt yet.",
                    },
                ]);
            if (last.unavailable)
                return result("unavailable", last.omissions);
            const omissions = [...last.omissions];
            const meshes = [];
            const draws = [];
            const included = new Map();
            let bytes = 0;
            let vertices = 0;
            let indices = 0;
            let instances = 0;
            for (const entry of last.draws) {
                const { receipt, draw } = entry;
                if (receipt === null) {
                    omissions.push({
                        reason: "missing-upload-receipt",
                        renderId: draw.renderId,
                        message: "The submitted mesh upload was not retained within capture limits.",
                    });
                    continue;
                }
                const position = findReceiptAttribute(receipt, "POSITION");
                const normal = findReceiptAttribute(receipt, "NORMAL");
                if (position?.attribute.format !== "float32x3" ||
                    (normal !== null && normal.attribute.format !== "float32x3")) {
                    omissions.push({
                        reason: position?.attribute.format !== "float32x3"
                            ? "unsupported-position-format"
                            : "unsupported-normal-format",
                        renderId: draw.renderId,
                        message: "Static geometry inspection requires float32x3 POSITION and, when present, NORMAL source attributes.",
                    });
                    continue;
                }
                const fresh = !included.has(receipt);
                const vertexCount = fresh ? position.stream.vertexCount : 0;
                const indexCount = fresh ? (receipt.indices?.count ?? 0) : 0;
                const meshBytes = fresh
                    ? vertexCount * 12 +
                        (normal === null ? 0 : normal.stream.vertexCount * 12) +
                        indexCount * (receipt.indices?.format === "uint16" ? 2 : 4)
                    : 0;
                if (bytes + meshBytes + draw.worldMatrices.byteLength > budget.maxBytes ||
                    vertices + vertexCount > budget.maxVertices ||
                    indices + indexCount > budget.maxIndices ||
                    meshes.length + (fresh ? 1 : 0) > budget.maxMeshes ||
                    draws.length >= budget.maxDraws ||
                    instances + draw.instances.length > budget.maxInstances) {
                    omissions.push({
                        reason: "request-budget",
                        renderId: draw.renderId,
                        message: "This complete draw and its mesh exceed the requested inspection budget.",
                    });
                    continue;
                }
                try {
                    if (fresh) {
                        validateReceiptAttribute(position);
                        if (normal !== null) {
                            validateReceiptAttribute(normal);
                            if (normal.stream.vertexCount !== position.stream.vertexCount)
                                throw new Error("Submitted normal and position counts differ.");
                        }
                        const mesh = Object.freeze({
                            key: receipt.key,
                            sourceKey: receipt.sourceKey,
                            sourceVersion: receipt.sourceVersion,
                            label: receipt.label,
                            positions: copyReceiptAttribute(position),
                            normals: normal === null ? null : copyReceiptAttribute(normal),
                            indices: copyReceiptIndices(receipt),
                        });
                        meshes.push(mesh);
                        included.set(receipt, receipt.key);
                        vertices += vertexCount;
                        indices += indexCount;
                        bytes += meshBytes;
                    }
                    draws.push(Object.freeze({
                        ...draw,
                        instances: Object.freeze(draw.instances.map((instance) => Object.freeze({
                            renderId: instance.renderId,
                            entity: Object.freeze({ ...instance.entity }),
                        }))),
                        worldMatrices: draw.worldMatrices.slice(),
                    }));
                    bytes += draw.worldMatrices.byteLength;
                    instances += draw.instances.length;
                }
                catch {
                    omissions.push({
                        reason: "invalid-source-data",
                        renderId: draw.renderId,
                        message: "The retained uploaded bytes do not form supported finite mesh attributes and indices.",
                    });
                }
            }
            return result(omissions.length === 0 ? "complete" : "partial", omissions, meshes, draws, bytes);
        },
        dispose() {
            disposed = true;
            uploads.clear();
            meshes.clear();
            worlds.clear();
            indirects.clear();
            pending.clear();
            last = null;
        },
    };
}
function copyDrawMetadata(draw) {
    return {
        renderId: draw.renderId,
        viewId: draw.viewId,
        targetKey: draw.targetKey,
        meshKey: draw.meshKey,
        submesh: draw.submesh,
        materialSlot: draw.materialSlot,
        indexed: draw.indexed,
        firstIndex: draw.firstIndex,
        indexCount: draw.indexCount,
        baseVertex: draw.baseVertex,
        firstVertex: draw.firstVertex,
        vertexCount: draw.vertexCount,
        firstInstance: draw.firstInstance,
    };
}
function boundedInteger(value, maximum, field) {
    if (!Number.isSafeInteger(value) || value < 0 || value > maximum)
        throw new RangeError(`Geometry inspection ${field} must be an integer from 0 to ${maximum}.`);
    return value;
}
//# sourceMappingURL=rendered-geometry-inspector.js.map