import { summarizeDiagnostics } from "@aperture-engine/simulation";
import { packSnapshotTransforms, planRenderWorldDrawPackages, } from "@aperture-engine/render";
import { createDrawCommandDescriptors, } from "../draw/draw-command.js";
import { frameExecutionReportToJsonValue, runInjectedFrameExecution, summarizeFrameExecutionDiagnosticsBySection, } from "./frame-execution-report.js";
import { createMvpFrameReadinessReport, } from "../../diagnostics/mvp-frame-readiness.js";
import { planRenderPassDrawList, } from "../passes/render-pass-draw-list.js";
import { renderPassAssemblySmokeReportToJsonValue, runInjectedRenderPassAssembly, summarizeRenderPassAssemblyDiagnosticsBySection, } from "../passes/render-pass-assembly-smoke.js";
export function createRendererFrameSummaryReport(input) {
    const renderer = evaluateSection({
        section: "rendererAssembly",
        report: input.renderer,
        missingCode: "rendererFrameSummary.missingRendererAssembly",
        missingMessage: "Renderer frame summary is missing renderer assembly report.",
    });
    const renderPass = evaluateSection({
        section: "renderPassAssembly",
        report: input.renderPass,
        missingCode: "rendererFrameSummary.missingRenderPassAssembly",
        missingMessage: "Renderer frame summary is missing render pass assembly report.",
    });
    const submission = evaluateSection({
        section: "frameSubmission",
        report: input.submission,
        missingCode: "rendererFrameSummary.missingFrameSubmission",
        missingMessage: "Renderer frame summary is missing frame submission report.",
    });
    const boundary = evaluateSection({
        section: "frameBoundary",
        report: input.boundary,
        missingCode: "rendererFrameSummary.missingFrameBoundary",
        missingMessage: "Renderer frame summary is missing frame boundary validation report.",
    });
    const mvp = evaluateSection({
        section: "mvpFrameReadiness",
        report: input.mvp,
        missingCode: "rendererFrameSummary.missingMvpFrameReadiness",
        missingMessage: "Renderer frame summary is missing MVP frame readiness report.",
    });
    const commandSubmission = evaluateSection({
        section: "commandSubmissionMetrics",
        report: input.commandSubmission,
        missingCode: "rendererFrameSummary.missingCommandSubmissionMetrics",
        missingMessage: "Renderer frame summary is missing command submission metrics report.",
    });
    const sections = {
        rendererAssembly: renderer.status,
        renderPassAssembly: renderPass.status,
        frameSubmission: submission.status,
        frameBoundary: boundary.status,
        mvpFrameReadiness: mvp.status,
        commandSubmissionMetrics: commandSubmission.status,
    };
    const diagnostics = [
        ...renderer.diagnostics,
        ...renderPass.diagnostics,
        ...submission.diagnostics,
        ...boundary.diagnostics,
        ...mvp.diagnostics,
        ...commandSubmission.diagnostics,
    ];
    return {
        ready: Object.values(sections).every((section) => section.ready),
        sections,
        counts: {
            plannedDraws: countPlannedDraws(input),
            drawCalls: countDrawCalls(input),
            commands: countCommands(input),
            executedCommands: countExecutedCommands(input),
            skippedCommands: countSkippedCommands(input),
            commandBuffers: countCommandBuffers(input),
            submittedCommandBuffers: countSubmittedCommandBuffers(input),
            skippedSubmissions: countSkippedSubmissions(input),
            diagnostics: diagnostics.length,
        },
        diagnostics,
        diagnosticSummary: summarizeDiagnostics(diagnostics),
    };
}
export function createRendererFrameSummaryFromExecutionReport(input) {
    const mvp = input.renderer === null ||
        input.renderPass === null ||
        input.execution === null
        ? null
        : createMvpFrameReadinessReport({
            renderer: input.renderer,
            renderPass: input.renderPass,
            submission: input.execution.reports.submissionSmoke,
            boundary: input.execution.reports.boundaryValidation,
        });
    return createRendererFrameSummaryReport({
        renderer: input.renderer,
        renderPass: input.renderPass,
        submission: input.execution?.reports.submissionSmoke ?? null,
        boundary: input.execution?.reports.boundaryValidation ?? null,
        mvp,
        commandSubmission: input.execution?.reports.commandSubmissionMetrics ?? null,
    });
}
export function runInjectedRendererFrameSummary(input) {
    const execution = runInjectedFrameExecution(input.frameExecution);
    const summary = createRendererFrameSummaryFromExecutionReport({
        renderer: input.renderer,
        renderPass: input.renderPass,
        execution: execution.execution,
    });
    return {
        assembly: execution.assembly,
        execution: execution.execution,
        summary,
        json: rendererFrameSummaryReportToJsonValue(summary),
    };
}
export function runInjectedRenderFrame(input) {
    const renderPass = runInjectedRenderPassAssembly(input.renderPass);
    const frame = runInjectedRendererFrameSummary({
        renderer: input.renderer,
        renderPass: renderPass.assembly,
        frameExecution: {
            ...input.frameExecution,
            commands: renderPass.commands.commands,
        },
    });
    return {
        renderPass,
        assembly: frame.assembly,
        execution: frame.execution,
        summary: frame.summary,
        json: frame.json,
    };
}
export function runInjectedRenderFrameFromDrawCommands(input) {
    const drawList = planRenderPassDrawList({
        drawCommands: input.drawCommands,
        pipelines: input.pipelines,
        bindGroups: input.bindGroups,
        ...(input.requiredBindGroupGroups === undefined
            ? {}
            : { requiredBindGroupGroups: input.requiredBindGroupGroups }),
    });
    const frame = runInjectedRenderFrame({
        renderer: input.renderer,
        renderPass: {
            drawList: drawList.draws,
            drawListValid: drawList.valid,
            drawListDiagnostics: drawList.diagnostics,
            pipelines: input.pipelines,
            bindGroups: input.bindGroups,
            meshResources: input.meshResources,
            pass: input.pass,
        },
        frameExecution: input.frameExecution,
    });
    return {
        drawList,
        frame,
    };
}
export function runInjectedRenderFrameFromDrawPackages(input) {
    const descriptors = createDrawCommandDescriptors(input.packages, input.meshResources);
    const frame = runInjectedRenderFrameFromDrawCommands({
        renderer: input.renderer,
        drawCommands: descriptors.descriptors,
        pipelines: input.pipelines,
        bindGroups: input.bindGroups,
        meshResources: input.meshResources,
        ...(input.requiredBindGroupGroups === undefined
            ? {}
            : { requiredBindGroupGroups: input.requiredBindGroupGroups }),
        pass: input.pass,
        frameExecution: input.frameExecution,
    });
    return {
        descriptors,
        frame,
    };
}
export function runInjectedRenderFrameFromRenderWorldPackages(input) {
    const packages = planRenderWorldDrawPackages(input.readiness, input.transforms);
    const frame = runInjectedRenderFrameFromDrawPackages({
        renderer: input.renderer,
        packages: packages.packages,
        meshResources: input.meshResources,
        pipelines: input.pipelines,
        bindGroups: input.bindGroups,
        ...(input.requiredBindGroupGroups === undefined
            ? {}
            : { requiredBindGroupGroups: input.requiredBindGroupGroups }),
        pass: input.pass,
        frameExecution: input.frameExecution,
    });
    return {
        packages,
        frame,
    };
}
export function runInjectedRenderFrameFromSnapshot(input) {
    const apply = input.renderWorld.applySnapshot(input.snapshot);
    const bindings = input.bindings.map((binding) => ({
        renderId: binding.renderId,
        result: input.renderWorld.updateResourceBindings(binding.renderId, binding.update),
    }));
    const transforms = packSnapshotTransforms(input.snapshot);
    const readiness = input.renderWorld.createDrawReadinessReport();
    const frame = runInjectedRenderFrameFromRenderWorldPackages({
        renderer: input.renderer,
        readiness,
        transforms,
        meshResources: input.meshResources,
        pipelines: input.pipelines,
        bindGroups: input.bindGroups,
        ...(input.requiredBindGroupGroups === undefined
            ? {}
            : { requiredBindGroupGroups: input.requiredBindGroupGroups }),
        pass: input.pass,
        frameExecution: input.frameExecution,
    });
    return {
        apply,
        bindings,
        transforms,
        readiness,
        frame,
    };
}
export function planInjectedRenderFrameSnapshotResourceBindings(input) {
    const scratch = createInjectedRenderFrameSnapshotResourceBindingPlanScratch();
    return writeInjectedRenderFrameSnapshotResourceBindings(input, scratch);
}
export function createInjectedRenderFrameSnapshotResourceBindingPlanScratch(capacity = 0) {
    const bindings = [];
    const diagnostics = [];
    const bindingPool = [];
    for (let index = 0; index < capacity; index += 1) {
        bindingPool.push(createEmptySnapshotResourceBinding());
    }
    return {
        bindings,
        diagnostics,
        bindingPool,
        seenRenderIds: new Set(),
        plan: { bindings, diagnostics },
    };
}
export function writeInjectedRenderFrameSnapshotResourceBindings(input, scratch) {
    scratch.bindings.length = 0;
    scratch.diagnostics.length = 0;
    scratch.seenRenderIds.clear();
    for (const draw of input.snapshot.meshDraws) {
        if (scratch.seenRenderIds.has(draw.renderId)) {
            scratch.diagnostics.push({
                code: "renderFrameSnapshotBinding.duplicateRenderId",
                message: `Duplicate render id ${draw.renderId} while planning snapshot resource bindings.`,
                severity: "error",
                entity: draw.entity,
            });
            continue;
        }
        scratch.seenRenderIds.add(draw.renderId);
        const meshResourceKey = input.resolveMeshResourceKey(draw);
        const materialResourceKey = input.resolveMaterialResourceKey(draw);
        if (meshResourceKey == null) {
            scratch.diagnostics.push({
                code: "renderFrameSnapshotBinding.missingMeshResource",
                message: `No mesh resource binding was resolved for render id ${draw.renderId}.`,
                severity: "warning",
                entity: draw.entity,
                assetKey: draw.mesh.id,
            });
        }
        if (materialResourceKey == null) {
            scratch.diagnostics.push({
                code: "renderFrameSnapshotBinding.missingMaterialResource",
                message: `No material resource binding was resolved for render id ${draw.renderId}.`,
                severity: "warning",
                entity: draw.entity,
                assetKey: draw.material.id,
            });
        }
        const binding = snapshotResourceBindingAt(scratch, scratch.bindings.length);
        binding.renderId = draw.renderId;
        const update = binding.update;
        if (meshResourceKey == null) {
            delete update.meshResourceKey;
        }
        else {
            update.meshResourceKey = meshResourceKey;
        }
        if (materialResourceKey == null) {
            delete update.materialResourceKey;
        }
        else {
            update.materialResourceKey = materialResourceKey;
        }
        scratch.bindings.push(binding);
    }
    scratch.bindings.sort((a, b) => a.renderId - b.renderId);
    return scratch.plan;
}
function snapshotResourceBindingAt(scratch, index) {
    const existing = scratch.bindingPool[index];
    if (existing !== undefined) {
        return existing;
    }
    const binding = createEmptySnapshotResourceBinding();
    scratch.bindingPool.push(binding);
    return binding;
}
function createEmptySnapshotResourceBinding() {
    return {
        renderId: 0,
        update: {},
    };
}
export function injectedRenderFrameSnapshotRunnerReportToJsonValue(report) {
    const applyDiagnostics = summarizeDiagnostics(report.apply.diagnostics);
    const bindingDiagnostics = summarizeDiagnostics(collectSnapshotBindingDiagnostics(report.bindings));
    const transformDiagnostics = summarizeDiagnostics(report.transforms.diagnostics);
    const readinessDiagnostics = summarizeDiagnostics(report.readiness.diagnostics);
    const frame = injectedRenderFrameRenderWorldPackageRunnerReportToJsonValue(report.frame);
    return {
        ready: applyDiagnostics.total === 0 &&
            bindingDiagnostics.total === 0 &&
            transformDiagnostics.total === 0 &&
            readinessDiagnostics.total === 0 &&
            frame.ready,
        apply: {
            valid: applyDiagnostics.total === 0,
            created: report.apply.created,
            updated: report.apply.updated,
            unchanged: report.apply.unchanged,
            removed: report.apply.removed,
            active: report.apply.active,
            diagnostics: cloneDiagnosticSummary(applyDiagnostics),
        },
        bindings: {
            valid: bindingDiagnostics.total === 0,
            attemptedCount: report.bindings.length,
            succeededCount: report.bindings.filter((binding) => binding.result.ok)
                .length,
            failedCount: report.bindings.filter((binding) => !binding.result.ok)
                .length,
            renderIds: report.bindings.map((binding) => binding.renderId),
            failedRenderIds: report.bindings
                .filter((binding) => !binding.result.ok)
                .map((binding) => binding.renderId),
            diagnostics: cloneDiagnosticSummary(bindingDiagnostics),
        },
        transforms: {
            valid: transformDiagnostics.total === 0,
            floatCount: report.transforms.data.length,
            matrixCount: report.transforms.data.length / 16,
            offsetCount: report.transforms.offsets.length,
            renderIds: report.transforms.offsets.map((offset) => offset.renderId),
            diagnostics: cloneDiagnosticSummary(transformDiagnostics),
        },
        readiness: {
            valid: readinessDiagnostics.total === 0,
            readyDrawCount: report.readiness.ready.length,
            blockedDrawCount: report.readiness.blocked.length,
            readyRenderIds: report.readiness.ready.map((draw) => draw.renderId),
            blockedRenderIds: report.readiness.blocked.map((draw) => draw.renderId),
            diagnostics: cloneDiagnosticSummary(readinessDiagnostics),
        },
        frame,
    };
}
export function injectedRenderFrameSnapshotRunnerReportToJson(report) {
    return JSON.stringify(injectedRenderFrameSnapshotRunnerReportToJsonValue(report));
}
export function summarizeInjectedRenderFrameSnapshotDiagnosticsByPhase(report) {
    const applyDiagnostics = summarizeDiagnostics(report.apply.diagnostics);
    const bindingDiagnostics = summarizeDiagnostics(collectSnapshotBindingDiagnostics(report.bindings));
    const transformDiagnostics = summarizeDiagnostics(report.transforms.diagnostics);
    const readinessDiagnostics = summarizeDiagnostics(report.readiness.diagnostics);
    const frame = summarizeInjectedRenderFrameRenderWorldPackageDiagnosticsByPhase(report.frame);
    return {
        ready: applyDiagnostics.total === 0 &&
            bindingDiagnostics.total === 0 &&
            transformDiagnostics.total === 0 &&
            readinessDiagnostics.total === 0 &&
            frame.ready,
        phases: {
            apply: {
                diagnostics: cloneDiagnosticSummary(applyDiagnostics),
            },
            bindings: {
                diagnostics: cloneDiagnosticSummary(bindingDiagnostics),
            },
            transforms: {
                diagnostics: cloneDiagnosticSummary(transformDiagnostics),
            },
            readiness: {
                diagnostics: cloneDiagnosticSummary(readinessDiagnostics),
            },
            frame,
        },
        diagnostics: mergeDiagnosticSummaries(applyDiagnostics, bindingDiagnostics, transformDiagnostics, readinessDiagnostics, frame.diagnostics),
    };
}
export function injectedRenderFrameRenderWorldPackageRunnerReportToJsonValue(report) {
    const packageDiagnostics = summarizeDiagnostics(report.packages.diagnostics);
    const frame = injectedRenderFrameDrawPackageRunnerReportToJsonValue(report.frame);
    return {
        ready: packageDiagnostics.total === 0 && frame.ready,
        packages: {
            valid: packageDiagnostics.total === 0,
            packageCount: report.packages.packages.length,
            renderIds: report.packages.packages.map((drawPackage) => drawPackage.renderId),
            diagnostics: cloneDiagnosticSummary(packageDiagnostics),
        },
        frame,
    };
}
export function injectedRenderFrameRenderWorldPackageRunnerReportToJson(report) {
    return JSON.stringify(injectedRenderFrameRenderWorldPackageRunnerReportToJsonValue(report));
}
export function summarizeInjectedRenderFrameRenderWorldPackageDiagnosticsByPhase(report) {
    const packageDiagnostics = summarizeDiagnostics(report.packages.diagnostics);
    const frame = summarizeInjectedRenderFrameDrawPackageDiagnosticsByPhase(report.frame);
    return {
        ready: packageDiagnostics.total === 0 && frame.ready,
        phases: {
            packages: {
                diagnostics: cloneDiagnosticSummary(packageDiagnostics),
            },
            frame,
        },
        diagnostics: mergeDiagnosticSummaries(packageDiagnostics, frame.diagnostics),
    };
}
export function injectedRenderFrameDrawPackageRunnerReportToJsonValue(report) {
    const descriptorDiagnostics = summarizeDiagnostics(report.descriptors.diagnostics);
    const frame = injectedRenderFrameDrawCommandRunnerReportToJsonValue(report.frame);
    return {
        ready: descriptorDiagnostics.total === 0 && frame.ready,
        descriptors: {
            valid: descriptorDiagnostics.total === 0,
            descriptorCount: report.descriptors.descriptors.length,
            renderIds: report.descriptors.descriptors.map((descriptor) => descriptor.renderId),
            diagnostics: cloneDiagnosticSummary(descriptorDiagnostics),
        },
        frame,
    };
}
export function injectedRenderFrameDrawPackageRunnerReportToJson(report) {
    return JSON.stringify(injectedRenderFrameDrawPackageRunnerReportToJsonValue(report));
}
export function summarizeInjectedRenderFrameDrawPackageDiagnosticsByPhase(report) {
    const descriptorDiagnostics = summarizeDiagnostics(report.descriptors.diagnostics);
    const frame = summarizeInjectedRenderFrameDrawCommandDiagnosticsByPhase(report.frame);
    return {
        ready: descriptorDiagnostics.total === 0 && frame.ready,
        phases: {
            descriptors: {
                diagnostics: cloneDiagnosticSummary(descriptorDiagnostics),
            },
            frame,
        },
        diagnostics: mergeDiagnosticSummaries(descriptorDiagnostics, frame.diagnostics),
    };
}
export function injectedRenderFrameDrawCommandRunnerReportToJsonValue(report) {
    const drawListDiagnostics = summarizeDiagnostics(report.drawList.diagnostics);
    const frame = injectedRenderFrameRunnerReportToJsonValue(report.frame);
    return {
        ready: report.drawList.valid && frame.ready,
        drawList: {
            valid: report.drawList.valid,
            drawCount: report.drawList.draws.length,
            renderIds: report.drawList.draws.map((draw) => draw.renderId),
            diagnostics: {
                total: drawListDiagnostics.total,
                bySeverity: {
                    info: drawListDiagnostics.bySeverity.info,
                    warning: drawListDiagnostics.bySeverity.warning,
                    error: drawListDiagnostics.bySeverity.error,
                },
                byCode: { ...drawListDiagnostics.byCode },
            },
        },
        frame,
    };
}
export function injectedRenderFrameDrawCommandRunnerReportToJson(report) {
    return JSON.stringify(injectedRenderFrameDrawCommandRunnerReportToJsonValue(report));
}
export function summarizeInjectedRenderFrameDrawCommandDiagnosticsByPhase(report) {
    const drawListDiagnostics = summarizeDiagnostics(report.drawList.diagnostics);
    const frame = summarizeInjectedRenderFrameDiagnosticsByPhase(report.frame);
    return {
        ready: drawListDiagnostics.total === 0 && frame.ready,
        phases: {
            drawList: {
                diagnostics: cloneDiagnosticSummary(drawListDiagnostics),
            },
            frame,
        },
        diagnostics: mergeDiagnosticSummaries(drawListDiagnostics, frame.diagnostics),
    };
}
export function injectedRenderFrameRunnerReportToJsonValue(report) {
    return {
        ready: report.assembly.valid &&
            report.renderPass.assembly.ready &&
            report.execution.ready &&
            report.summary.ready,
        boundary: {
            valid: report.assembly.valid,
        },
        renderPass: renderPassAssemblySmokeReportToJsonValue(report.renderPass.assembly),
        frameExecution: frameExecutionReportToJsonValue(report.execution),
        summary: rendererFrameSummaryReportToJsonValue(report.summary),
    };
}
export function injectedRenderFrameRunnerReportToJson(report) {
    return JSON.stringify(injectedRenderFrameRunnerReportToJsonValue(report));
}
export function summarizeInjectedRenderFrameDiagnosticsByPhase(report) {
    const renderPass = summarizeRenderPassAssemblyDiagnosticsBySection(report.renderPass.assembly);
    const frameExecution = summarizeFrameExecutionDiagnosticsBySection(report.execution);
    const rendererFrameSummary = summarizeRendererFrameSummaryDiagnosticsBySection(report.summary);
    return {
        ready: rendererFrameSummary.sections.rendererAssembly.diagnostics.total === 0 &&
            renderPass.ready &&
            frameExecution.ready &&
            rendererFrameSummary.ready,
        phases: {
            rendererAssembly: rendererFrameSummary.sections.rendererAssembly,
            renderPassAssembly: renderPass,
            frameExecution,
            rendererFrameSummary,
        },
        diagnostics: {
            total: report.summary.diagnosticSummary.total,
            bySeverity: {
                info: report.summary.diagnosticSummary.bySeverity.info,
                warning: report.summary.diagnosticSummary.bySeverity.warning,
                error: report.summary.diagnosticSummary.bySeverity.error,
            },
            byCode: { ...report.summary.diagnosticSummary.byCode },
        },
    };
}
export function rendererFrameSummaryReportToJsonValue(report) {
    return {
        ready: report.ready,
        sections: {
            rendererAssembly: sectionToJsonValue(report.sections.rendererAssembly),
            renderPassAssembly: sectionToJsonValue(report.sections.renderPassAssembly),
            frameSubmission: sectionToJsonValue(report.sections.frameSubmission),
            frameBoundary: sectionToJsonValue(report.sections.frameBoundary),
            mvpFrameReadiness: sectionToJsonValue(report.sections.mvpFrameReadiness),
            commandSubmissionMetrics: sectionToJsonValue(report.sections.commandSubmissionMetrics),
        },
        counts: {
            plannedDraws: report.counts.plannedDraws,
            drawCalls: report.counts.drawCalls,
            commands: report.counts.commands,
            executedCommands: report.counts.executedCommands,
            skippedCommands: report.counts.skippedCommands,
            commandBuffers: report.counts.commandBuffers,
            submittedCommandBuffers: report.counts.submittedCommandBuffers,
            skippedSubmissions: report.counts.skippedSubmissions,
            diagnostics: report.counts.diagnostics,
        },
        diagnostics: {
            total: report.diagnosticSummary.total,
            bySeverity: {
                info: report.diagnosticSummary.bySeverity.info,
                warning: report.diagnosticSummary.bySeverity.warning,
                error: report.diagnosticSummary.bySeverity.error,
            },
            byCode: { ...report.diagnosticSummary.byCode },
        },
    };
}
export function rendererFrameSummaryReportToJson(report) {
    return JSON.stringify(rendererFrameSummaryReportToJsonValue(report));
}
export function summarizeRendererFrameSummaryDiagnosticsBySection(report) {
    const diagnostics = summarizeDiagnostics(report.diagnostics);
    return {
        ready: diagnostics.total === 0,
        sections: {
            rendererAssembly: summarizeSectionDiagnostics("rendererAssembly", report),
            renderPassAssembly: summarizeSectionDiagnostics("renderPassAssembly", report),
            frameSubmission: summarizeSectionDiagnostics("frameSubmission", report),
            frameBoundary: summarizeSectionDiagnostics("frameBoundary", report),
            mvpFrameReadiness: summarizeSectionDiagnostics("mvpFrameReadiness", report),
            commandSubmissionMetrics: summarizeSectionDiagnostics("commandSubmissionMetrics", report),
        },
        diagnostics,
    };
}
function evaluateSection(input) {
    if (input.report === null) {
        return {
            status: {
                section: input.section,
                present: false,
                ready: false,
                diagnosticCount: 1,
            },
            diagnostics: [
                {
                    section: input.section,
                    code: input.missingCode,
                    message: input.missingMessage,
                    severity: "error",
                },
            ],
        };
    }
    const diagnostics = copySourceDiagnostics(input.section, input.report.diagnostics);
    return {
        status: {
            section: input.section,
            present: true,
            ready: input.report.ready,
            diagnosticCount: diagnostics.length,
        },
        diagnostics,
    };
}
function sectionToJsonValue(section) {
    return {
        present: section.present,
        ready: section.ready,
        diagnosticCount: section.diagnosticCount,
    };
}
function summarizeSectionDiagnostics(section, report) {
    return {
        section,
        diagnostics: summarizeDiagnostics(report.diagnostics.filter((diagnostic) => diagnostic.section === section)),
    };
}
function collectSnapshotBindingDiagnostics(bindings) {
    return bindings.flatMap((binding) => binding.result.ok ? [] : binding.result.diagnostics);
}
function cloneDiagnosticSummary(summary) {
    return {
        total: summary.total,
        bySeverity: {
            info: summary.bySeverity.info,
            warning: summary.bySeverity.warning,
            error: summary.bySeverity.error,
        },
        byCode: { ...summary.byCode },
    };
}
function mergeDiagnosticSummaries(...summaries) {
    const bySeverity = {
        info: 0,
        warning: 0,
        error: 0,
    };
    const byCode = {};
    let total = 0;
    for (const summary of summaries) {
        total += summary.total;
        bySeverity.info += summary.bySeverity.info;
        bySeverity.warning += summary.bySeverity.warning;
        bySeverity.error += summary.bySeverity.error;
        for (const [code, count] of Object.entries(summary.byCode)) {
            byCode[code] = (byCode[code] ?? 0) + count;
        }
    }
    return { total, bySeverity, byCode };
}
function copySourceDiagnostics(section, diagnostics) {
    return diagnostics.map((diagnostic) => ({
        section,
        code: diagnostic.code,
        message: diagnostic.message ?? diagnostic.code,
        severity: diagnostic.severity ?? "warning",
        ...(diagnostic.section === undefined
            ? {}
            : { sourceSection: diagnostic.section }),
    }));
}
function countPlannedDraws(input) {
    return (input.renderPass?.summary.commands?.drawCount ??
        input.renderer?.summary.frame?.draws ??
        0);
}
function countDrawCalls(input) {
    return (input.commandSubmission?.counts.drawCalls ??
        input.submission?.summary.execution?.drawCalls ??
        input.renderPass?.summary.execution?.drawCalls ??
        0);
}
function countCommands(input) {
    return (input.commandSubmission?.counts.commands ??
        input.renderPass?.summary.commands?.commandCount ??
        0);
}
function countExecutedCommands(input) {
    return (input.commandSubmission?.counts.executedCommands ??
        input.submission?.summary.execution?.executedCommands ??
        input.renderPass?.summary.execution?.executedCommands ??
        0);
}
function countSkippedCommands(input) {
    return (input.commandSubmission?.counts.skippedCommands ??
        input.submission?.summary.execution?.skippedCommands ??
        input.renderPass?.summary.execution?.skippedCommands ??
        0);
}
function countCommandBuffers(input) {
    if (input.commandSubmission !== null) {
        return input.commandSubmission.counts.commandBuffers;
    }
    const finish = input.submission?.summary.finish ?? null;
    return finish?.commandBufferKey === null || finish === null ? 0 : 1;
}
function countSubmittedCommandBuffers(input) {
    return (input.commandSubmission?.counts.submittedCommandBuffers ??
        input.submission?.summary.submit?.submitted ??
        0);
}
function countSkippedSubmissions(input) {
    return (input.commandSubmission?.counts.skippedSubmissions ??
        input.submission?.summary.submit?.skipped ??
        0);
}
//# sourceMappingURL=renderer-frame-summary.js.map