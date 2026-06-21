import { summarizeDiagnostics, } from "@aperture-engine/simulation";
import { executeRenderPassCommands, } from "./render-pass-command-executor.js";
import { planRenderPassCommands, } from "./render-pass-commands.js";
import { resolveRenderPassResources, } from "./render-pass-resources.js";
export function createRenderPassAssemblySmokeReport(input) {
    const drawList = evaluateSection({
        section: "drawList",
        report: input.drawList,
        missingCode: "renderPassAssembly.missingDrawList",
        notReadyCode: "renderPassAssembly.drawListNotReady",
        missingMessage: "Render pass assembly smoke report is missing draw list planning output.",
        notReadyMessage: "Render pass draw list planning is not ready.",
    });
    const resources = evaluateSection({
        section: "resources",
        report: input.resources,
        missingCode: "renderPassAssembly.missingResolvedResources",
        notReadyCode: "renderPassAssembly.resourcesNotReady",
        missingMessage: "Render pass assembly smoke report is missing resolved resource output.",
        notReadyMessage: "Render pass resource resolution is not ready.",
    });
    const commands = evaluateSection({
        section: "commands",
        report: input.commands,
        missingCode: "renderPassAssembly.missingCommandPlan",
        notReadyCode: "renderPassAssembly.commandPlanNotReady",
        missingMessage: "Render pass assembly smoke report is missing command planning output.",
        notReadyMessage: "Render pass command planning is not ready.",
    });
    const execution = evaluateSection({
        section: "execution",
        report: input.execution,
        missingCode: "renderPassAssembly.missingExecutionReport",
        notReadyCode: "renderPassAssembly.executionFailed",
        missingMessage: "Render pass assembly smoke report is missing command execution output.",
        notReadyMessage: "Render pass command execution failed.",
    });
    const sections = {
        drawList: drawList.status,
        resources: resources.status,
        commands: commands.status,
        execution: execution.status,
    };
    return {
        ready: Object.values(sections).every((section) => section.ready),
        sections,
        diagnostics: [
            ...drawList.diagnostics,
            ...(input.drawList?.diagnostics ?? []),
            ...resources.diagnostics,
            ...(input.resources?.diagnostics ?? []),
            ...commands.diagnostics,
            ...(input.commands?.diagnostics ?? []),
            ...execution.diagnostics,
            ...(input.execution?.diagnostics ?? []),
        ],
        summary: {
            drawList: input.drawList === null
                ? null
                : { valid: input.drawList.valid, draws: input.drawList.draws },
            resources: input.resources === null
                ? null
                : {
                    valid: input.resources.valid,
                    draws: input.resources.draws.map(resolvedDrawToSummary),
                },
            commands: input.commands === null
                ? null
                : {
                    valid: input.commands.valid,
                    drawCount: input.commands.drawCount,
                    commandCount: input.commands.commands.length,
                    indexedDrawCount: input.commands.indexedDrawCount,
                    nonIndexedDrawCount: input.commands.nonIndexedDrawCount,
                },
            execution: input.execution === null
                ? null
                : {
                    valid: input.execution.valid,
                    commandCount: input.execution.commandCount,
                    executedCommands: input.execution.executedCommands,
                    skippedCommands: input.execution.skippedCommands,
                    drawCalls: input.execution.drawCalls,
                },
        },
    };
}
export function renderPassAssemblySmokeReportToJsonValue(report) {
    const diagnostics = summarizeDiagnostics(report.diagnostics);
    return {
        ready: report.ready,
        sections: {
            drawList: sectionToJsonValue(report.sections.drawList),
            resources: sectionToJsonValue(report.sections.resources),
            commands: sectionToJsonValue(report.sections.commands),
            execution: sectionToJsonValue(report.sections.execution),
        },
        summary: {
            drawList: report.summary.drawList === null
                ? null
                : {
                    valid: report.summary.drawList.valid,
                    drawCount: report.summary.drawList.draws.length,
                    renderIds: report.summary.drawList.draws.map((draw) => draw.renderId),
                },
            resources: report.summary.resources === null
                ? null
                : {
                    valid: report.summary.resources.valid,
                    drawCount: report.summary.resources.draws.length,
                    draws: report.summary.resources.draws.map((draw) => ({
                        renderId: draw.renderId,
                        pipelineKey: draw.pipelineKey,
                        bindGroupKeys: [...draw.bindGroupKeys],
                        vertexBufferKeys: [...draw.vertexBufferKeys],
                        vertexCount: draw.vertexCount,
                        indexBufferKey: draw.indexBufferKey,
                        indexCount: draw.indexCount,
                        instanceCount: draw.instanceCount,
                        transformPackedOffset: draw.transformPackedOffset,
                    })),
                },
            commands: report.summary.commands === null
                ? null
                : {
                    valid: report.summary.commands.valid,
                    drawCount: report.summary.commands.drawCount,
                    commandCount: report.summary.commands.commandCount,
                    indexedDrawCount: report.summary.commands.indexedDrawCount,
                    nonIndexedDrawCount: report.summary.commands.nonIndexedDrawCount,
                },
            execution: report.summary.execution === null
                ? null
                : {
                    valid: report.summary.execution.valid,
                    commandCount: report.summary.execution.commandCount,
                    executedCommands: report.summary.execution.executedCommands,
                    skippedCommands: report.summary.execution.skippedCommands,
                    drawCalls: report.summary.execution.drawCalls,
                },
        },
        diagnostics: {
            total: diagnostics.total,
            bySeverity: {
                info: diagnostics.bySeverity.info,
                warning: diagnostics.bySeverity.warning,
                error: diagnostics.bySeverity.error,
            },
            byCode: { ...diagnostics.byCode },
        },
    };
}
export function renderPassAssemblySmokeReportToJson(report) {
    return JSON.stringify(renderPassAssemblySmokeReportToJsonValue(report));
}
export function summarizeRenderPassAssemblyDiagnosticsBySection(report) {
    const diagnostics = summarizeDiagnostics(report.diagnostics);
    return {
        ready: diagnostics.total === 0,
        sections: {
            drawList: summarizeSectionDiagnostics("drawList", report),
            resources: summarizeSectionDiagnostics("resources", report),
            commands: summarizeSectionDiagnostics("commands", report),
            execution: summarizeSectionDiagnostics("execution", report),
        },
        diagnostics,
    };
}
export function runInjectedRenderPassAssembly(input) {
    const resources = resolveRenderPassResources({
        drawList: input.drawList,
        pipelines: input.pipelines,
        bindGroups: input.bindGroups,
        meshResources: input.meshResources,
    });
    const commands = planRenderPassCommands({ draws: resources.draws });
    const execution = executeRenderPassCommands({
        pass: input.pass,
        commands: commands.commands,
    });
    const assembly = createRenderPassAssemblySmokeReport({
        drawList: {
            valid: input.drawListValid ?? true,
            draws: input.drawList,
            diagnostics: input.drawListDiagnostics ?? [],
        },
        resources,
        commands,
        execution,
    });
    return {
        resources,
        commands,
        execution,
        assembly,
    };
}
function summarizeSectionDiagnostics(section, report) {
    return {
        section,
        diagnostics: summarizeDiagnostics(report.diagnostics.filter((diagnostic) => diagnosticSection(diagnostic) === section)),
    };
}
function diagnosticSection(diagnostic) {
    if (isRenderPassAssemblySection(diagnostic.section)) {
        return diagnostic.section;
    }
    if (diagnostic.code.startsWith("renderPassDrawList.") ||
        diagnostic.code.startsWith("drawCommand.")) {
        return "drawList";
    }
    if (diagnostic.code.startsWith("renderPassResource.") ||
        diagnostic.code.startsWith("unlitBindGroupResource.")) {
        return "resources";
    }
    if (diagnostic.code.startsWith("renderPassCommand.")) {
        return "commands";
    }
    return "execution";
}
function isRenderPassAssemblySection(section) {
    return (section === "drawList" ||
        section === "resources" ||
        section === "commands" ||
        section === "execution");
}
function sectionToJsonValue(section) {
    return {
        present: section.present,
        ready: section.ready,
        diagnosticCodes: [...section.diagnosticCodes],
    };
}
function resolvedDrawToSummary(draw) {
    return {
        renderId: draw.renderId,
        pipelineKey: draw.pipelineKey,
        bindGroupKeys: draw.bindGroups.map((bindGroup) => bindGroup.resourceKey),
        vertexBufferKeys: draw.vertexBuffers.map((vertexBuffer) => vertexBuffer.resourceKey),
        vertexCount: draw.vertexCount,
        indexBufferKey: draw.indexBuffer?.resourceKey ?? null,
        indexCount: draw.indexCount,
        instanceCount: draw.instanceCount,
        transformPackedOffset: draw.transformPackedOffset,
    };
}
function evaluateSection(input) {
    if (input.report === null) {
        return sectionResult(input.section, false, [
            {
                code: input.missingCode,
                message: input.missingMessage,
                section: input.section,
                severity: "error",
            },
        ]);
    }
    if (!input.report.valid) {
        return sectionResult(input.section, true, [
            {
                code: input.notReadyCode,
                message: input.notReadyMessage,
                section: input.section,
                severity: "warning",
            },
        ]);
    }
    return sectionResult(input.section, true, []);
}
function sectionResult(section, present, diagnostics) {
    return {
        status: {
            section,
            present,
            ready: present && diagnostics.length === 0,
            diagnosticCodes: diagnostics.map((diagnostic) => diagnostic.code),
        },
        diagnostics,
    };
}
//# sourceMappingURL=render-pass-assembly-smoke.js.map