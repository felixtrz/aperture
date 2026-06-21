import { isRenderPassDrawCommand } from "./view-commands.js";
export function createWebGpuAppOcclusionCullingReport() {
    return {
        queryCandidateDraws: 0,
        queriedDraws: 0,
        skippedFromQuery: 0,
        skippedRenderIds: [],
        forcedProbeDraws: 0,
        forcedProbeRenderIds: [],
        fallbackReason: null,
    };
}
export function appendWebGpuAppOcclusionCullingPlan(report, plan) {
    report.queryCandidateDraws += plan.candidateDraws;
    report.skippedFromQuery += plan.skippedRenderIds.length;
    report.skippedRenderIds.push(...plan.skippedRenderIds);
    report.forcedProbeDraws += plan.forcedProbeRenderIds.length;
    report.forcedProbeRenderIds.push(...plan.forcedProbeRenderIds);
    if (plan.fallbackReason !== null) {
        recordWebGpuAppOcclusionCullingFallback(report, plan.fallbackReason);
    }
}
export function recordWebGpuAppOcclusionCullingFallback(report, fallbackReason) {
    if (report.fallbackReason === null ||
        fallbackReason === "unsupported" ||
        report.fallbackReason !== "unsupported") {
        report.fallbackReason = fallbackReason;
    }
}
export function collectOcclusionQueryRenderIds(commands) {
    const renderIds = [];
    for (const command of commands) {
        if (command.kind === "beginOcclusionQuery") {
            renderIds.push(command.renderId);
        }
    }
    return renderIds;
}
export function commandsWithoutSkippedOcclusionDraws(commands, skippedRenderIds, target) {
    if (skippedRenderIds.length === 0) {
        return commands;
    }
    const skipped = new Set(skippedRenderIds);
    target.length = 0;
    for (const command of commands) {
        if (skipped.has(command.renderId) &&
            (isRenderPassOcclusionQueryCommand(command) ||
                isRenderPassDrawCommand(command))) {
            continue;
        }
        target.push(command);
    }
    return target;
}
export function commandsWithoutOcclusionQueryCommands(commands, target) {
    if (!commands.some(isRenderPassOcclusionQueryCommand)) {
        return commands;
    }
    if (target === undefined) {
        return commands.filter((command) => !isRenderPassOcclusionQueryCommand(command));
    }
    target.length = 0;
    for (const command of commands) {
        if (!isRenderPassOcclusionQueryCommand(command)) {
            target.push(command);
        }
    }
    return target;
}
export function normalizeOcclusionQueryCommands(commands) {
    const renderIds = [];
    let queryIndex = 0;
    let activeQueryIndex = -1;
    for (const command of commands) {
        if (command.kind === "beginOcclusionQuery") {
            command.queryIndex = queryIndex;
            activeQueryIndex = queryIndex;
            renderIds.push(command.renderId);
            queryIndex += 1;
            continue;
        }
        if (command.kind === "endOcclusionQuery") {
            command.queryIndex =
                activeQueryIndex >= 0 ? activeQueryIndex : Math.max(0, queryIndex - 1);
            activeQueryIndex = -1;
        }
    }
    return renderIds;
}
function isRenderPassOcclusionQueryCommand(command) {
    return (command.kind === "beginOcclusionQuery" ||
        command.kind === "endOcclusionQuery");
}
//# sourceMappingURL=occlusion-culling.js.map