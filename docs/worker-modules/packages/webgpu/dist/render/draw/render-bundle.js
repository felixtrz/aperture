import { executeRenderPassCommands, } from "../passes/render-pass-command-executor.js";
export function createRenderBundleCache() {
    return {
        entries: new Map(),
        objectIds: new WeakMap(),
        nextObjectId: 1,
    };
}
export function createRenderBundleCommandKey(options, cache) {
    const key = {
        targetKey: options.targetKey,
        colorFormats: [...options.colorFormats],
        depthStencilFormat: options.depthStencilFormat ?? null,
        sampleCount: options.sampleCount ?? 1,
        commands: options.commands.map((command) => commandKeyPart(command, cache)),
    };
    return JSON.stringify(key);
}
export function summarizeRenderBundleKey(key) {
    if (key === null) {
        return { key: null, keyHash: null, keyLength: null };
    }
    const hash = hashString(key);
    return {
        key: key.length <= 160 ? key : `hash:${hash}:length:${key.length}`,
        keyHash: hash,
        keyLength: key.length,
    };
}
export function executeRenderPassCommandsWithRenderBundle(options) {
    const split = splitRenderBundleCommands(options.commands, options.bundledCommandCount);
    if (options.enabled === false) {
        const execution = executeRenderPassCommands({
            pass: options.pass,
            commands: options.commands,
        });
        return {
            execution,
            renderBundle: reportFromExecution({
                execution,
                status: "disabled",
                key: options.key,
                encodedCommands: execution.executedCommands,
                executedBundles: 0,
                cacheSize: options.cache.entries.size,
                diagnostics: [],
            }),
        };
    }
    if (options.pass.executeBundles === undefined ||
        options.device.createRenderBundleEncoder === undefined) {
        const execution = executeRenderPassCommands({
            pass: options.pass,
            commands: options.commands,
        });
        return {
            execution,
            renderBundle: reportFromExecution({
                execution,
                status: "unsupported",
                key: options.key,
                encodedCommands: execution.executedCommands,
                executedBundles: 0,
                cacheSize: options.cache.entries.size,
                diagnostics: [],
            }),
        };
    }
    const cached = options.cache.entries.get(options.key);
    if (cached !== undefined) {
        try {
            options.pass.executeBundles([cached.bundle]);
        }
        catch (cause) {
            return fallbackAfterBundleFailure(options, "renderBundle.executeBundlesFailed", `WebGPU render bundle '${options.key}' could not be executed: ${messageFromCause(cause)}`);
        }
        const bundleExecution = executionReportFromCacheEntry(cached);
        const directExecution = executeRenderPassCommands({
            pass: options.pass,
            commands: split.directCommands,
        });
        const execution = combineRenderPassCommandExecutionReports(bundleExecution, directExecution, options.commands.length);
        return {
            execution,
            renderBundle: {
                valid: true,
                status: "reused",
                key: options.key,
                commandCount: cached.commandCount,
                encodedCommands: 0,
                executedBundles: 1,
                drawCalls: cached.drawCalls,
                indexedDrawCalls: cached.indexedDrawCalls,
                nonIndexedDrawCalls: cached.nonIndexedDrawCalls,
                cacheSize: options.cache.entries.size,
                diagnostics: [],
            },
        };
    }
    let bundleEncoder;
    try {
        bundleEncoder = options.device.createRenderBundleEncoder({
            ...options.descriptor,
            label: options.descriptor.label ?? `${options.label ?? options.key}:bundle`,
        });
    }
    catch (cause) {
        return fallbackAfterBundleFailure(options, "renderBundle.createEncoderFailed", `WebGPU render bundle encoder '${options.key}' could not be created: ${messageFromCause(cause)}`);
    }
    if (bundleEncoder.finish === undefined) {
        return fallbackAfterBundleFailure(options, "renderBundle.missingFinish", `WebGPU render bundle encoder '${options.key}' cannot finish a bundle.`);
    }
    const bundleExecution = executeRenderPassCommands({
        pass: bundleEncoder,
        commands: split.bundleCommands,
    });
    if (!bundleExecution.valid) {
        const directExecution = executeRenderPassCommands({
            pass: options.pass,
            commands: options.commands,
        });
        return {
            execution: directExecution,
            renderBundle: reportFromExecution({
                execution: directExecution,
                status: "failed",
                key: options.key,
                encodedCommands: bundleExecution.executedCommands,
                executedBundles: 0,
                cacheSize: options.cache.entries.size,
                diagnostics: bundleExecution.diagnostics.map((diagnostic) => ({
                    code: "renderBundle.finishFailed",
                    message: diagnostic.message,
                })),
            }),
        };
    }
    let bundle;
    try {
        bundle = bundleEncoder.finish();
    }
    catch (cause) {
        return fallbackAfterBundleFailure(options, "renderBundle.finishFailed", `WebGPU render bundle '${options.key}' could not be finished: ${messageFromCause(cause)}`);
    }
    try {
        options.pass.executeBundles([bundle]);
    }
    catch (cause) {
        return fallbackAfterBundleFailure(options, "renderBundle.executeBundlesFailed", `WebGPU render bundle '${options.key}' could not be executed: ${messageFromCause(cause)}`);
    }
    const directExecution = executeRenderPassCommands({
        pass: options.pass,
        commands: split.directCommands,
    });
    const entry = {
        key: options.key,
        bundle,
        commandCount: bundleExecution.commandCount,
        drawCalls: bundleExecution.drawCalls,
        indexedDrawCalls: bundleExecution.indexedDrawCalls,
        nonIndexedDrawCalls: bundleExecution.nonIndexedDrawCalls,
    };
    options.cache.entries.set(options.key, entry);
    const execution = combineRenderPassCommandExecutionReports(bundleExecution, directExecution, options.commands.length);
    return {
        execution,
        renderBundle: {
            valid: true,
            status: "created",
            key: options.key,
            commandCount: bundleExecution.commandCount,
            encodedCommands: bundleExecution.executedCommands,
            executedBundles: 1,
            drawCalls: bundleExecution.drawCalls,
            indexedDrawCalls: bundleExecution.indexedDrawCalls,
            nonIndexedDrawCalls: bundleExecution.nonIndexedDrawCalls,
            cacheSize: options.cache.entries.size,
            diagnostics: [],
        },
    };
}
function fallbackAfterBundleFailure(options, code, message) {
    const execution = executeRenderPassCommands({
        pass: options.pass,
        commands: options.commands,
    });
    return {
        execution,
        renderBundle: reportFromExecution({
            execution,
            status: "failed",
            key: options.key,
            encodedCommands: execution.executedCommands,
            executedBundles: 0,
            cacheSize: options.cache.entries.size,
            diagnostics: [{ code, message }],
        }),
    };
}
function splitRenderBundleCommands(commands, bundledCommandCount) {
    if (bundledCommandCount === undefined ||
        bundledCommandCount >= commands.length) {
        return {
            bundleCommands: commands,
            directCommands: [],
        };
    }
    const clampedCount = Math.max(0, bundledCommandCount);
    return {
        bundleCommands: commands.slice(0, clampedCount),
        directCommands: commands.slice(clampedCount),
    };
}
function combineRenderPassCommandExecutionReports(bundled, direct, commandCount) {
    const executedCommands = bundled.executedCommands + direct.executedCommands;
    return {
        valid: bundled.valid && direct.valid,
        commandCount,
        executedCommands,
        skippedCommands: commandCount - executedCommands,
        drawCalls: bundled.drawCalls + direct.drawCalls,
        indexedDrawCalls: bundled.indexedDrawCalls + direct.indexedDrawCalls,
        nonIndexedDrawCalls: bundled.nonIndexedDrawCalls + direct.nonIndexedDrawCalls,
        diagnostics: [...bundled.diagnostics, ...direct.diagnostics],
    };
}
function reportFromExecution(options) {
    return {
        valid: options.execution.valid,
        status: options.status,
        key: options.key,
        commandCount: options.execution.commandCount,
        encodedCommands: options.encodedCommands,
        executedBundles: options.executedBundles,
        drawCalls: options.execution.drawCalls,
        indexedDrawCalls: options.execution.indexedDrawCalls,
        nonIndexedDrawCalls: options.execution.nonIndexedDrawCalls,
        cacheSize: options.cacheSize,
        diagnostics: options.diagnostics,
    };
}
function executionReportFromCacheEntry(entry) {
    return {
        valid: true,
        commandCount: entry.commandCount,
        executedCommands: entry.commandCount,
        skippedCommands: 0,
        drawCalls: entry.drawCalls,
        indexedDrawCalls: entry.indexedDrawCalls,
        nonIndexedDrawCalls: entry.nonIndexedDrawCalls,
        diagnostics: [],
    };
}
function commandKeyPart(command, cache) {
    switch (command.kind) {
        case "setPipeline":
            return [
                "p",
                command.pipelineKey,
                resourceIdentity(command.pipeline, cache),
            ];
        case "setBindGroup":
            return [
                "bg",
                command.index,
                command.resourceKey,
                resourceIdentity(command.bindGroup, cache),
            ];
        case "setVertexBuffer":
            return [
                "vb",
                command.slot,
                command.resourceKey,
                resourceIdentity(command.buffer, cache),
            ];
        case "setIndexBuffer":
            return [
                "ib",
                command.resourceKey,
                command.format,
                resourceIdentity(command.buffer, cache),
            ];
        case "beginOcclusionQuery":
            return ["oq-begin", command.queryIndex];
        case "endOcclusionQuery":
            return ["oq-end", command.queryIndex];
        case "draw":
            return [
                "d",
                command.vertexCount,
                command.instanceCount,
                command.firstVertex,
                command.firstInstance,
            ];
        case "drawIndexed":
            return [
                "di",
                command.indexCount,
                command.instanceCount,
                command.firstIndex,
                command.baseVertex,
                command.firstInstance,
            ];
        case "drawIndirect":
            return [
                "d-indirect",
                command.resourceKey,
                resourceIdentity(command.buffer, cache),
                command.offset,
            ];
        case "drawIndexedIndirect":
            return [
                "di-indirect",
                command.resourceKey,
                resourceIdentity(command.buffer, cache),
                command.offset,
            ];
    }
}
function resourceIdentity(value, cache) {
    if ((typeof value !== "object" && typeof value !== "function") ||
        value === null) {
        return `${typeof value}:${String(value)}`;
    }
    const cached = cache.objectIds.get(value);
    if (cached !== undefined) {
        return `object:${cached}`;
    }
    const id = cache.nextObjectId;
    cache.nextObjectId += 1;
    cache.objectIds.set(value, id);
    return `object:${id}`;
}
function hashString(value) {
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
}
function messageFromCause(cause) {
    if (cause instanceof Error) {
        return cause.message;
    }
    return String(cause);
}
//# sourceMappingURL=render-bundle.js.map