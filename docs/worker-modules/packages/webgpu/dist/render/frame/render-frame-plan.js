import { createRenderWorldDrawPackageScratch, writeRenderWorldDrawPackages, } from "/aperture/worker-modules/packages/render/dist/index.js";
import { createDrawCommandDescriptorScratch, writeDrawCommandDescriptors, } from "../draw/draw-command.js";
import { createRenderPassCommandScratch, writeRenderPassCommands, } from "../passes/render-pass-commands.js";
import { createRenderPassDrawListScratch, writeRenderPassDrawList, } from "../passes/render-pass-draw-list.js";
import { RENDER_FRAME_PHASES, } from "./render-frame-phases.js";
import { createResolveRenderPassResourcesScratch, writeResolveRenderPassResources, } from "../passes/render-pass-resources.js";
import { createInjectedRenderFrameSnapshotResourceBindingPlanScratch, writeInjectedRenderFrameSnapshotResourceBindings, } from "./renderer-frame-summary.js";
export function planRenderFrameFromSnapshot(input) {
    const scratch = createRenderFramePlanScratch(input.summaryScratch);
    return writeRenderFramePlanFromSnapshot({ ...input, scratch });
}
export function createRenderFramePlanScratch(summaryScratch = createRenderFramePlanSummaryScratch()) {
    return {
        summaryScratch,
        bindingScratch: createInjectedRenderFrameSnapshotResourceBindingPlanScratch(),
        drawPackageScratch: createRenderWorldDrawPackageScratch(),
        drawCommandScratch: createDrawCommandDescriptorScratch(),
        drawListScratch: createRenderPassDrawListScratch(),
        resourcesScratch: createResolveRenderPassResourcesScratch(),
        commandScratch: createRenderPassCommandScratch(),
        result: {
            apply: null,
            bindingPlan: null,
            bindingResults: [],
            readiness: null,
            packages: null,
            drawCommands: null,
            drawList: null,
            resources: null,
            commandPlan: null,
            summary: summaryScratch.summary,
        },
    };
}
export function writeRenderFramePlanFromSnapshot(input) {
    const apply = input.renderWorld.applySnapshot(input.snapshot, {
        ...(input.snapshotChangeSet === undefined
            ? {}
            : { changeSet: input.snapshotChangeSet }),
    });
    const bindingPlan = writeInjectedRenderFrameSnapshotResourceBindings({
        snapshot: input.snapshot,
        resolveMeshResourceKey: input.resolveMeshResourceKey,
        resolveMaterialResourceKey: input.resolveMaterialResourceKey,
    }, input.scratch.bindingScratch);
    const bindingResults = bindingPlan.bindings.map((binding) => input.renderWorld.updateResourceBindings(binding.renderId, binding.update));
    const readiness = input.renderWorld.createDrawReadinessReport();
    const packages = writeRenderWorldDrawPackages(readiness, input.transforms, input.scratch.drawPackageScratch);
    const drawOrderTransformPacking = input.drawOrderTransformPacking?.({
        packages,
        transforms: input.transforms,
        ...(input.pipelineKeysByRenderId === undefined
            ? {}
            : { pipelineKeysByRenderId: input.pipelineKeysByRenderId }),
        pipelines: input.pipelines,
        bindGroups: input.bindGroups,
    });
    const bindGroups = drawOrderTransformPacking?.bindGroups ?? input.bindGroups;
    const drawCommands = writeDrawCommandDescriptors(packages.packages, input.meshResources, input.scratch.drawCommandScratch, {
        ...(input.instanceTintResources === undefined
            ? {}
            : { instanceTintResources: input.instanceTintResources }),
        ...(input.pipelineKeysByRenderId === undefined
            ? {}
            : { pipelineKeysByRenderId: input.pipelineKeysByRenderId }),
        ...(drawOrderTransformPacking?.worldTransformResourceKeyByRenderId ===
            undefined
            ? {}
            : {
                worldTransformResourceKeyByRenderId: drawOrderTransformPacking.worldTransformResourceKeyByRenderId,
            }),
    });
    const drawList = writeRenderPassDrawList({
        drawCommands: drawCommands.descriptors,
        pipelines: input.pipelines,
        bindGroups,
        ...(input.requiredBindGroupGroups === undefined
            ? {}
            : { requiredBindGroupGroups: input.requiredBindGroupGroups }),
    }, input.scratch.drawListScratch);
    const resources = writeResolveRenderPassResources({
        drawList: drawList.draws,
        pipelines: input.pipelines,
        bindGroups,
        meshResources: input.meshResources,
        ...(input.instanceTintResources === undefined
            ? {}
            : { instanceTintResources: input.instanceTintResources }),
    }, input.scratch.resourcesScratch);
    const commandPlan = writeRenderPassCommands({ draws: resources.draws }, input.scratch.commandScratch);
    const summary = summarizeRenderFramePlan({
        apply,
        bindingPlan,
        bindingResults,
        readiness,
        packages,
        drawCommands,
        drawList,
        resources,
        commandPlan,
    }, input.scratch.summaryScratch);
    const result = input.scratch
        .result;
    result.apply = apply;
    result.bindingPlan = bindingPlan;
    result.bindingResults = bindingResults;
    result.readiness = readiness;
    result.packages = packages;
    result.drawCommands = drawCommands;
    result.drawList = drawList;
    result.resources = resources;
    result.commandPlan = commandPlan;
    result.summary = summary;
    return input.scratch.result;
}
export function createRenderFrameQueueDiagnosticsSummary(input) {
    const byCode = {};
    let total = 0;
    total += summarizeDiagnosticCodes(input.readiness.diagnostics, byCode);
    total += summarizeDiagnosticCodes(input.packages.diagnostics, byCode);
    return {
        ready: input.readiness.blocked.length === 0 && total === 0,
        readyDrawCount: input.readiness.ready.length,
        blockedDrawCount: input.readiness.blocked.length,
        packageCount: input.packages.summary.packageCount,
        packagePoolSize: input.packages.summary.packagePoolSize,
        packageSlotsReused: input.packages.summary.packageSlotsReused,
        packageSlotsCreated: input.packages.summary.packageSlotsCreated,
        missingPackedTransformCount: input.packages.summary.missingPackedTransformCount,
        ...(input.summary === undefined ? {} : { draw: input.summary.counts.draw }),
        stateSort: input.packages.summary.stateSort,
        diagnostics: {
            total,
            byCode,
        },
    };
}
export function createRenderFramePlanSummaryScratch() {
    const applyDiagnostics = [];
    const prepareDiagnostics = [];
    const queueDiagnostics = [];
    const resolveDiagnostics = [];
    const commandDiagnostics = [];
    const submitDiagnostics = [];
    const diagnostics = [];
    const counts = {
        apply: {
            active: 0,
            created: 0,
            updated: 0,
            unchanged: 0,
            removed: 0,
        },
        binding: {
            planned: 0,
            applied: 0,
            ready: 0,
            blocked: 0,
        },
        draw: {
            packages: 0,
            descriptors: 0,
            drawList: 0,
            resolved: 0,
        },
        command: {
            commands: 0,
            drawCount: 0,
            indexedDrawCount: 0,
            nonIndexedDrawCount: 0,
        },
    };
    const queueCounts = {
        ready: 0,
        blocked: 0,
        packages: 0,
    };
    const submitCounts = {
        submitted: 0,
        plannedCommands: 0,
        plannedDraws: 0,
    };
    const phases = {
        apply: {
            phase: "apply",
            ready: true,
            counts: counts.apply,
            diagnostics: applyDiagnostics,
        },
        prepare: {
            phase: "prepare",
            ready: true,
            counts: counts.binding,
            diagnostics: prepareDiagnostics,
        },
        queue: {
            phase: "queue",
            ready: true,
            counts: queueCounts,
            diagnostics: queueDiagnostics,
        },
        resolve: {
            phase: "resolve",
            ready: true,
            counts: counts.draw,
            diagnostics: resolveDiagnostics,
        },
        command: {
            phase: "command",
            ready: true,
            counts: counts.command,
            diagnostics: commandDiagnostics,
        },
        submit: {
            phase: "submit",
            ready: true,
            counts: submitCounts,
            diagnostics: submitDiagnostics,
        },
    };
    const summary = {
        ready: true,
        phaseOrder: RENDER_FRAME_PHASES,
        phases,
        counts,
        diagnostics,
    };
    return {
        applyDiagnostics,
        prepareDiagnostics,
        queueDiagnostics,
        resolveDiagnostics,
        commandDiagnostics,
        submitDiagnostics,
        diagnostics,
        counts,
        queueCounts,
        submitCounts,
        phases,
        summary,
    };
}
function summarizeRenderFramePlan(result, scratch = createRenderFramePlanSummaryScratch()) {
    resetRenderFramePlanSummaryScratch(scratch);
    pushRenderDiagnostics(scratch.applyDiagnostics, "apply", "applySnapshot", result.apply.diagnostics);
    pushRenderDiagnostics(scratch.prepareDiagnostics, "prepare", "resourceBindings", result.bindingPlan.diagnostics);
    for (const binding of result.bindingResults) {
        if (!binding.ok) {
            pushRenderDiagnostics(scratch.prepareDiagnostics, "prepare", "resourceBindingUpdate", binding.diagnostics);
        }
    }
    pushRenderDiagnostics(scratch.queueDiagnostics, "queue", "drawReadiness", result.readiness.diagnostics);
    pushRenderDiagnostics(scratch.queueDiagnostics, "queue", "drawPackages", result.packages.diagnostics);
    pushDrawDiagnostics(scratch.resolveDiagnostics, "resolve", "descriptors", result.drawCommands.diagnostics);
    pushDrawDiagnostics(scratch.resolveDiagnostics, "resolve", "draw-list", result.drawList.diagnostics);
    pushDrawDiagnostics(scratch.resolveDiagnostics, "resolve", "resources", result.resources.diagnostics);
    pushDrawDiagnostics(scratch.commandDiagnostics, "command", "commands", result.commandPlan.diagnostics);
    appendDiagnostics(scratch.diagnostics, scratch.applyDiagnostics);
    appendDiagnostics(scratch.diagnostics, scratch.prepareDiagnostics);
    appendDiagnostics(scratch.diagnostics, scratch.queueDiagnostics);
    appendDiagnostics(scratch.diagnostics, scratch.resolveDiagnostics);
    appendDiagnostics(scratch.diagnostics, scratch.commandDiagnostics);
    appendDiagnostics(scratch.diagnostics, scratch.submitDiagnostics);
    const counts = scratch.counts;
    const queueCounts = scratch.queueCounts;
    const submitCounts = scratch.submitCounts;
    const phases = scratch.phases;
    const summary = scratch.summary;
    const appliedBindings = countAppliedBindings(result.bindingResults);
    counts.apply.active = result.apply.active;
    counts.apply.created = result.apply.created;
    counts.apply.updated = result.apply.updated;
    counts.apply.unchanged = result.apply.unchanged;
    counts.apply.removed = result.apply.removed;
    counts.binding.planned = result.bindingPlan.bindings.length;
    counts.binding.applied = appliedBindings;
    counts.binding.ready = result.readiness.ready.length;
    counts.binding.blocked = result.readiness.blocked.length;
    counts.draw.packages = result.packages.packages.length;
    counts.draw.descriptors = result.drawCommands.descriptors.length;
    counts.draw.drawList = result.drawList.draws.length;
    counts.draw.resolved = result.resources.draws.length;
    counts.command.commands = result.commandPlan.commands.length;
    counts.command.drawCount = result.commandPlan.drawCount;
    counts.command.indexedDrawCount = result.commandPlan.indexedDrawCount;
    counts.command.nonIndexedDrawCount = result.commandPlan.nonIndexedDrawCount;
    queueCounts.ready = result.readiness.ready.length;
    queueCounts.blocked = result.readiness.blocked.length;
    queueCounts.packages = result.packages.packages.length;
    submitCounts.submitted = 0;
    submitCounts.plannedCommands = result.commandPlan.commands.length;
    submitCounts.plannedDraws = result.commandPlan.drawCount;
    phases.apply.ready = scratch.applyDiagnostics.length === 0;
    phases.prepare.ready = scratch.prepareDiagnostics.length === 0;
    phases.queue.ready = scratch.queueDiagnostics.length === 0;
    phases.resolve.ready =
        scratch.resolveDiagnostics.length === 0 &&
            result.drawList.valid &&
            result.resources.valid;
    phases.command.ready =
        scratch.commandDiagnostics.length === 0 && result.commandPlan.valid;
    phases.submit.ready =
        scratch.submitDiagnostics.length === 0 && result.commandPlan.valid;
    summary.ready =
        scratch.diagnostics.length === 0 &&
            result.drawList.valid &&
            result.resources.valid &&
            result.commandPlan.valid;
    return scratch.summary;
}
function resetRenderFramePlanSummaryScratch(scratch) {
    scratch.applyDiagnostics.length = 0;
    scratch.prepareDiagnostics.length = 0;
    scratch.queueDiagnostics.length = 0;
    scratch.resolveDiagnostics.length = 0;
    scratch.commandDiagnostics.length = 0;
    scratch.submitDiagnostics.length = 0;
    scratch.diagnostics.length = 0;
}
function countAppliedBindings(bindings) {
    let applied = 0;
    for (const binding of bindings) {
        if (binding.ok) {
            applied += 1;
        }
    }
    return applied;
}
function appendDiagnostics(output, diagnostics) {
    for (const diagnostic of diagnostics) {
        output.push(diagnostic);
    }
}
function summarizeDiagnosticCodes(diagnostics, byCode) {
    for (const diagnostic of diagnostics) {
        byCode[diagnostic.code] = (byCode[diagnostic.code] ?? 0) + 1;
    }
    return diagnostics.length;
}
function pushRenderDiagnostics(output, phase, source, diagnostics) {
    for (const diagnostic of diagnostics) {
        output.push(renderDiagnostic(phase, source, diagnostic));
    }
}
function pushDrawDiagnostics(output, phase, source, diagnostics) {
    for (const diagnostic of diagnostics) {
        output.push(drawDiagnostic(phase, source, diagnostic));
    }
}
function renderDiagnostic(phase, source, diagnostic) {
    return {
        phase,
        source,
        code: diagnostic.code,
        message: diagnostic.message,
        ...(diagnostic.assetKey === undefined
            ? {}
            : { assetKey: diagnostic.assetKey }),
        ...(diagnostic.entity === undefined ? {} : { entity: diagnostic.entity }),
    };
}
function drawDiagnostic(phase, source, diagnostic) {
    return {
        phase,
        source,
        code: diagnostic.code,
        message: diagnostic.message,
        ...("renderId" in diagnostic ? { renderId: diagnostic.renderId } : {}),
        ...("resourceKey" in diagnostic
            ? { resourceKey: diagnostic.resourceKey }
            : {}),
    };
}
//# sourceMappingURL=render-frame-plan.js.map