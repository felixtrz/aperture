import { executeRenderPassCommands, } from "../render/passes/render-pass-command-executor.js";
import { writeGpuTimestampQuery, } from "../gpu/gpu-timing.js";
import { beginPlannedRenderPass, endPlannedRenderPass, } from "../render/passes/render-pass-lifecycle.js";
export function createShadowPassEncoderAssemblyReport(options) {
    if (options.attachments.passCount === 0) {
        return report({
            status: "not-required",
            attachments: options.attachments,
            frameResources: options.frameResources,
            commandEncoding: options.commandEncoding,
            records: [],
            diagnostics: [],
        });
    }
    const diagnostics = [];
    const commandRecords = new Map(options.commands.map((record) => [record.passKey, record.commands]));
    const records = [];
    const gpuTimingRecords = [];
    if (options.attachments.attachmentCount === 0) {
        diagnostics.push({
            code: "shadowPassEncoderAssembly.missingAttachmentDescriptors",
            severity: "warning",
            message: "Shadow pass encoder assembly requires depth attachment descriptors.",
        });
    }
    if (!options.frameResources.ready) {
        diagnostics.push({
            code: "shadowPassEncoderAssembly.frameResourcesNotReady",
            severity: "warning",
            message: "Shadow pass encoder assembly requires ready caster frame resources.",
        });
    }
    if (options.commandEncoding.records.length === 0) {
        diagnostics.push({
            code: "shadowPassEncoderAssembly.missingCommandRecords",
            severity: "warning",
            message: "Shadow pass encoder assembly requires shadow pass command records.",
        });
    }
    if (options.encoder === undefined && options.deferEncoding !== true) {
        diagnostics.push({
            code: "shadowPassEncoderAssembly.missingCommandEncoder",
            severity: "warning",
            message: "Shadow pass encoder assembly requires an injected command encoder.",
        });
    }
    for (const attachment of options.attachments.attachments) {
        const commands = commandRecords.get(attachment.passKey) ?? [];
        const depthView = options.resolveDepthView?.(attachment) ?? attachment.viewKey;
        if (commands.length === 0) {
            diagnostics.push({
                code: "shadowPassEncoderAssembly.missingCommandRecords",
                severity: "warning",
                passKey: attachment.passKey,
                shadowId: attachment.shadowId,
                lightId: attachment.lightId,
                message: `Shadow pass '${attachment.passKey}' has no executable caster command records.`,
            });
        }
        if (depthView === null) {
            diagnostics.push({
                code: "shadowPassEncoderAssembly.missingDepthView",
                severity: "warning",
                passKey: attachment.passKey,
                shadowId: attachment.shadowId,
                lightId: attachment.lightId,
                message: `Shadow pass '${attachment.passKey}' has no live depth view for encoder assembly.`,
            });
        }
        const assembled = options.deferEncoding === true ||
            options.encoder === undefined ||
            depthView === null
            ? null
            : assemblePass(options.encoder, attachment, depthView, commands, createShadowPassGpuTimingRecordOptions(options.gpuTiming, records.length));
        diagnostics.push(...(assembled?.diagnostics ?? []));
        if (assembled?.gpuTiming !== undefined) {
            gpuTimingRecords.push(assembled.gpuTiming);
        }
        records.push({
            passKey: attachment.passKey,
            shadowId: attachment.shadowId,
            lightId: attachment.lightId,
            depthTextureKey: attachment.textureKey,
            depthViewKey: attachment.viewKey,
            commandCount: commands.length,
            executedCommands: assembled?.execution.executedCommands ?? 0,
            drawCalls: assembled?.execution.drawCalls ??
                (options.deferEncoding === true ? countDrawCommands(commands) : 0),
            indexedDrawCalls: assembled?.execution.indexedDrawCalls ??
                (options.deferEncoding === true
                    ? countIndexedDrawCommands(commands)
                    : 0),
            begun: assembled?.begun ?? false,
            ended: assembled?.ended ?? false,
        });
    }
    if (records.length > 0 && records.every((record) => record.ended)) {
        diagnostics.push({
            code: "shadowPassEncoderAssembly.commandBufferSubmissionDeferred",
            severity: "warning",
            message: "Shadow pass encoders are assembled, but command-buffer finish and queue submission are deferred.",
        });
    }
    const hasBlockingDiagnostics = diagnostics.some((diagnostic) => diagnostic.code !==
        "shadowPassEncoderAssembly.commandBufferSubmissionDeferred");
    return report({
        status: hasBlockingDiagnostics
            ? "missing"
            : options.deferEncoding === true
                ? "ready"
                : records.some((record) => record.ended)
                    ? "ready"
                    : "deferred",
        attachments: options.attachments,
        frameResources: options.frameResources,
        commandEncoding: options.commandEncoding,
        records,
        ...(options.gpuTiming === undefined
            ? {}
            : {
                gpuTiming: createShadowPassGpuTimingCommandReport(gpuTimingRecords, options.gpuTiming.resources.queryCount),
            }),
        diagnostics,
    });
}
export function shadowPassEncoderAssemblyReportToJsonValue(value) {
    return {
        ready: value.ready,
        status: value.status,
        counts: { ...value.counts },
        sections: { ...value.sections },
        records: value.records.map((record) => ({ ...record })),
        ...(value.gpuTiming === undefined
            ? {}
            : {
                gpuTiming: {
                    queryCount: value.gpuTiming.queryCount,
                    records: value.gpuTiming.records.map((record) => ({ ...record })),
                    diagnostics: value.gpuTiming.diagnostics.map((diagnostic) => ({
                        ...diagnostic,
                    })),
                },
            }),
        diagnostics: value.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    };
}
export function shadowPassEncoderAssemblyReportToJson(value) {
    return JSON.stringify(shadowPassEncoderAssemblyReportToJsonValue(value));
}
function countDrawCommands(commands) {
    return commands.filter((command) => command.kind === "draw" ||
        command.kind === "drawIndexed" ||
        command.kind === "drawIndirect" ||
        command.kind === "drawIndexedIndirect").length;
}
function countIndexedDrawCommands(commands) {
    return commands.filter((command) => command.kind === "drawIndexed" || command.kind === "drawIndexedIndirect").length;
}
function assemblePass(encoder, attachment, depthView, commands, gpuTiming) {
    const plan = {
        colorAttachments: [],
        depthStencilAttachment: {
            view: depthView,
            depthClearValue: attachment.depthClearValue,
            depthLoadOp: attachment.depthLoadOp,
            depthStoreOp: attachment.depthStoreOp,
        },
    };
    const writeStart = gpuTiming === null
        ? null
        : writeGpuTimestampQuery(encoder, gpuTiming.resources, gpuTiming.startQuery);
    const begin = beginPlannedRenderPass({ encoder, plan });
    if (begin.pass === null) {
        return {
            begun: false,
            ended: false,
            execution: emptyExecution(),
            ...(gpuTiming === null
                ? {}
                : {
                    gpuTiming: createShadowPassGpuTimingRecord(attachment.passKey, gpuTiming, writeStart, null),
                }),
            diagnostics: begin.diagnostics.map((diagnostic) => ({
                code: "shadowPassEncoderAssembly.beginFailed",
                severity: "warning",
                passKey: attachment.passKey,
                shadowId: attachment.shadowId,
                lightId: attachment.lightId,
                message: diagnostic.message,
            })),
        };
    }
    const execution = executeRenderPassCommands({
        pass: begin.pass,
        commands,
    });
    const end = endPlannedRenderPass(begin.pass);
    const writeEnd = gpuTiming === null
        ? null
        : writeGpuTimestampQuery(encoder, gpuTiming.resources, gpuTiming.endQuery);
    const diagnostics = [
        ...execution.diagnostics.map((diagnostic) => ({
            code: "shadowPassEncoderAssembly.commandExecutionFailed",
            severity: "warning",
            passKey: attachment.passKey,
            shadowId: attachment.shadowId,
            lightId: attachment.lightId,
            message: diagnostic.message,
        })),
        ...end.diagnostics.map((diagnostic) => ({
            code: "shadowPassEncoderAssembly.endFailed",
            severity: "warning",
            passKey: attachment.passKey,
            shadowId: attachment.shadowId,
            lightId: attachment.lightId,
            message: diagnostic.message,
        })),
    ];
    return {
        begun: begin.valid,
        ended: end.ended,
        execution,
        ...(gpuTiming === null
            ? {}
            : {
                gpuTiming: createShadowPassGpuTimingRecord(attachment.passKey, gpuTiming, writeStart, writeEnd),
            }),
        diagnostics,
    };
}
function emptyExecution() {
    return {
        valid: false,
        commandCount: 0,
        executedCommands: 0,
        skippedCommands: 0,
        drawCalls: 0,
        indexedDrawCalls: 0,
        nonIndexedDrawCalls: 0,
        diagnostics: [],
    };
}
function report(input) {
    const commandCount = input.records.reduce((sum, record) => sum + record.commandCount, 0);
    const executedCommands = input.records.reduce((sum, record) => sum + record.executedCommands, 0);
    const drawCalls = input.records.reduce((sum, record) => sum + record.drawCalls, 0);
    return {
        ready: input.status === "ready" || input.status === "not-required",
        status: input.status,
        counts: {
            passes: input.attachments.passCount,
            attachments: input.attachments.attachmentCount,
            frameResourceDraws: input.frameResources.counts.readyDraws,
            commandRecords: input.commandEncoding.records.length,
            assembledPasses: input.records.filter((record) => record.ended).length,
            commandCount,
            executedCommands,
            drawCalls,
        },
        sections: {
            attachmentDescriptors: input.attachments.attachmentCount > 0,
            frameResources: input.frameResources.ready,
            commandRecords: input.commandEncoding.records.length > 0,
            passBegin: input.records.some((record) => record.begun),
            commandExecution: executedCommands === commandCount && commandCount > 0,
            passEnd: input.records.some((record) => record.ended),
            commandBufferFinish: false,
            queueSubmission: false,
            shaderSampling: input.status === "ready",
        },
        records: input.records,
        ...(input.gpuTiming === undefined ? {} : { gpuTiming: input.gpuTiming }),
        diagnostics: input.diagnostics,
    };
}
function createShadowPassGpuTimingRecordOptions(options, passIndex) {
    if (options === undefined) {
        return null;
    }
    const startQuery = (options.startQuery ?? 0) + passIndex * 2;
    return {
        resources: options.resources,
        startQuery,
        endQuery: startQuery + 1,
    };
}
function createShadowPassGpuTimingRecord(passKey, options, writeStart, writeEnd) {
    return {
        passKey,
        startQuery: options.startQuery,
        endQuery: options.endQuery,
        writeStart,
        writeEnd,
        diagnostics: [
            ...(writeStart?.diagnostics ?? []),
            ...(writeEnd?.diagnostics ?? []),
        ],
    };
}
function createShadowPassGpuTimingCommandReport(records, queryCount) {
    return {
        queryCount,
        records,
        diagnostics: records.flatMap((record) => record.diagnostics),
    };
}
//# sourceMappingURL=shadow-pass-encoder-assembly-report.js.map