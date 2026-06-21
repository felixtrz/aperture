import { createWebGpuBuffer, } from "../../gpu/buffer.js";
import { WEBGPU_BUFFER_USAGE_FLAGS } from "../../resources/meshes/mesh-buffer-descriptors.js";
const indirectDrawArgumentStride = 5;
const indirectDrawArgumentStrideBytes = indirectDrawArgumentStride * 4;
export function createIndirectDrawCommandCache(capacity = 0) {
    const args = new Uint32Array(Math.max(0, capacity) * indirectDrawArgumentStride);
    return {
        resource: null,
        args,
        signedArgs: new Int32Array(args.buffer),
        commands: [],
    };
}
export function prepareIndirectDrawCommands(options) {
    const minInstanceCount = options.minInstanceCount ?? 2;
    const candidates = candidateDrawCommands(options.commands, minInstanceCount);
    if (options.enabled === false) {
        return {
            commands: options.commands,
            report: report({
                status: "disabled",
                candidates: candidates.length,
                indirectDraws: 0,
                directDraws: countDrawCommands(options.commands),
                fallbackReason: null,
            }),
        };
    }
    if (candidates.length === 0) {
        return {
            commands: options.commands,
            report: report({
                status: "skipped",
                candidates: 0,
                indirectDraws: 0,
                directDraws: countDrawCommands(options.commands),
                fallbackReason: "no-candidates",
            }),
        };
    }
    if (!options.supportsIndirectFirstInstance &&
        candidates.some((command) => firstInstanceForDrawCommand(command) !== 0)) {
        return fallback(options, {
            candidates: candidates.length,
            reason: "first-instance-unsupported",
            diagnostic: {
                code: "indirectDraw.firstInstanceUnsupported",
                reason: "first-instance-unsupported",
                message: "Indirect draws with non-zero firstInstance require the 'indirect-first-instance' WebGPU feature.",
            },
        });
    }
    if (options.device.createBuffer === undefined) {
        return fallback(options, {
            candidates: candidates.length,
            reason: "create-buffer-unavailable",
            diagnostic: {
                code: "indirectDraw.createBufferUnavailable",
                reason: "create-buffer-unavailable",
                message: "WebGPU device cannot create an indirect draw argument buffer.",
            },
        });
    }
    if (options.device.queue?.writeBuffer === undefined) {
        return fallback(options, {
            candidates: candidates.length,
            reason: "queue-write-buffer-unavailable",
            diagnostic: {
                code: "indirectDraw.queueWriteBufferUnavailable",
                reason: "queue-write-buffer-unavailable",
                message: "WebGPU queue cannot upload indirect draw argument buffer contents.",
            },
        });
    }
    const resourceKey = `indirect-draw-buffer:${options.label}`;
    const allocated = ensureIndirectDrawBuffer(options.device, options.cache, resourceKey, candidates.length);
    if (!allocated.ok) {
        return fallback(options, {
            candidates: candidates.length,
            reason: "buffer-creation-failed",
            diagnostic: {
                code: "indirectDraw.bufferCreationFailed",
                reason: "buffer-creation-failed",
                message: allocated.message,
            },
        });
    }
    writeIndirectArguments(options.cache, candidates);
    options.device.queue.writeBuffer(allocated.resource.buffer, 0, options.cache.args.buffer, options.cache.args.byteOffset, candidates.length * indirectDrawArgumentStrideBytes);
    const transformed = writeIndirectCommandList(options.commands, candidates, allocated.resource, options.cache);
    const indexedIndirectDraws = candidates.filter((command) => command.kind === "drawIndexed").length;
    const indirectDraws = candidates.length;
    return {
        commands: transformed,
        report: report({
            status: allocated.created ? "created" : "updated",
            candidates: candidates.length,
            indirectDraws,
            indexedIndirectDraws,
            nonIndexedIndirectDraws: indirectDraws - indexedIndirectDraws,
            directDraws: countDrawCommands(options.commands) - indirectDraws,
            bufferResourceKey: allocated.resource.resourceKey,
            bufferBytes: allocated.resource.byteLength,
            fallbackReason: null,
        }),
    };
}
function candidateDrawCommands(commands, minInstanceCount) {
    return commands.filter((command) => (command.kind === "draw" || command.kind === "drawIndexed") &&
        command.instanceCount >= minInstanceCount);
}
function ensureIndirectDrawBuffer(device, cache, resourceKey, count) {
    const byteLength = count * indirectDrawArgumentStrideBytes;
    if (cache.resource !== null && cache.resource.capacity >= count) {
        return { ok: true, resource: cache.resource, created: false };
    }
    const result = createWebGpuBuffer({
        device,
        descriptor: {
            label: resourceKey,
            size: byteLength,
            usage: WEBGPU_BUFFER_USAGE_FLAGS.INDIRECT | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
        },
    });
    if (!result.ok) {
        return {
            ok: false,
            message: `Failed to create indirect draw buffer '${resourceKey}': ${result.message}`,
        };
    }
    const resource = {
        resourceKey,
        buffer: result.buffer,
        capacity: count,
        byteLength,
    };
    cache.resource = resource;
    return { ok: true, resource, created: true };
}
function writeIndirectArguments(cache, candidates) {
    ensureArgumentCapacity(cache, candidates.length);
    cache.args.fill(0, 0, candidates.length * indirectDrawArgumentStride);
    for (let index = 0; index < candidates.length; index += 1) {
        const command = candidates[index];
        const offset = index * indirectDrawArgumentStride;
        if (command === undefined) {
            continue;
        }
        if (command.kind === "drawIndexed") {
            cache.args[offset] = command.indexCount;
            cache.args[offset + 1] = command.instanceCount;
            cache.args[offset + 2] = command.firstIndex;
            cache.signedArgs[offset + 3] = command.baseVertex;
            cache.args[offset + 4] = command.firstInstance;
            continue;
        }
        cache.args[offset] = command.vertexCount;
        cache.args[offset + 1] = command.instanceCount;
        cache.args[offset + 2] = command.firstVertex;
        cache.args[offset + 3] = command.firstInstance;
    }
}
function ensureArgumentCapacity(cache, count) {
    const requiredLength = count * indirectDrawArgumentStride;
    if (cache.args.length >= requiredLength) {
        return;
    }
    const args = new Uint32Array(requiredLength);
    cache.args = args;
    cache.signedArgs = new Int32Array(args.buffer);
}
function writeIndirectCommandList(commands, candidates, resource, cache) {
    cache.commands.length = 0;
    let candidateIndex = 0;
    for (const command of commands) {
        const candidate = candidates[candidateIndex];
        if (candidate === command) {
            cache.commands.push(indirectCommand(command, resource, candidateIndex));
            candidateIndex += 1;
            continue;
        }
        cache.commands.push(command);
    }
    return cache.commands;
}
function indirectCommand(command, resource, candidateIndex) {
    const offset = candidateIndex * indirectDrawArgumentStrideBytes;
    if (command.kind === "drawIndexed") {
        return {
            kind: "drawIndexedIndirect",
            renderId: command.renderId,
            resourceKey: resource.resourceKey,
            buffer: resource.buffer,
            offset,
            indexCount: command.indexCount,
            instanceCount: command.instanceCount,
            firstIndex: command.firstIndex,
            baseVertex: command.baseVertex,
            firstInstance: command.firstInstance,
        };
    }
    return {
        kind: "drawIndirect",
        renderId: command.renderId,
        resourceKey: resource.resourceKey,
        buffer: resource.buffer,
        offset,
        vertexCount: command.vertexCount,
        instanceCount: command.instanceCount,
        firstVertex: command.firstVertex,
        firstInstance: command.firstInstance,
    };
}
function fallback(options, input) {
    return {
        commands: options.commands,
        report: report({
            status: "fallback",
            candidates: input.candidates,
            indirectDraws: 0,
            directDraws: countDrawCommands(options.commands),
            bufferResourceKey: null,
            bufferBytes: 0,
            fallbackReason: input.reason,
            diagnostics: [input.diagnostic],
        }),
    };
}
function report(input) {
    const diagnostics = input.diagnostics ?? [];
    return {
        valid: diagnostics.length === 0,
        status: input.status,
        candidates: input.candidates,
        indirectDraws: input.indirectDraws,
        directDraws: input.directDraws,
        indexedIndirectDraws: input.indexedIndirectDraws ?? 0,
        nonIndexedIndirectDraws: input.nonIndexedIndirectDraws ?? 0,
        bufferResourceKey: input.bufferResourceKey ?? null,
        bufferBytes: input.bufferBytes ?? 0,
        fallbackReason: input.fallbackReason,
        diagnostics,
    };
}
function countDrawCommands(commands) {
    return commands.filter((command) => command.kind === "draw" ||
        command.kind === "drawIndexed" ||
        command.kind === "drawIndirect" ||
        command.kind === "drawIndexedIndirect").length;
}
function firstInstanceForDrawCommand(command) {
    return command.firstInstance;
}
//# sourceMappingURL=indirect-draw-commands.js.map