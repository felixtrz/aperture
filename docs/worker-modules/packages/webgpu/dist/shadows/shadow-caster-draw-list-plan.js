import { assetHandleKey } from "/aperture/worker-modules/packages/simulation/dist/index.js";
import { parseMaterialPipelineRenderStateTokens, } from "../materials/core/material-render-state.js";
// three.js shadowSide parity: regular shadow-map casters render the opposite
// side of single-sided materials by default (FrontSide -> BackSide,
// BackSide -> FrontSide). This keeps the stored depth on the far surface of a
// closed caster and avoids lit-face acne without forcing a global rasterizer
// bias. Double-sided materials remain two-sided.
function casterCullModeForForward(forwardCullMode) {
    if (forwardCullMode === "none") {
        return "none";
    }
    if (forwardCullMode === "front") {
        return "back";
    }
    // forward "back" (single-sided) or unknown -> render BACK faces.
    return "front";
}
export function isDepthOnlyShadowCasterDrawSupported(draw) {
    const tokens = parseMaterialPipelineRenderStateTokens(draw.batchKey.pipelineKey);
    return areDepthOnlyShadowCasterTokensSupported(tokens);
}
function areDepthOnlyShadowCasterTokensSupported(tokens) {
    // The current caster pass writes depth only; it does not sample material
    // alpha. Alpha-blended visual helpers and alpha-tested cutouts would cast as
    // solid geometry until a caster material path can evaluate cutoff state.
    return tokens.alphaMode !== "blend" && tokens.alphaMode !== "alpha-test";
}
function shadowCasterRenderStateDecision(pipelineKey, cache) {
    const cached = cache.get(pipelineKey);
    if (cached !== undefined) {
        return cached;
    }
    const tokens = parseMaterialPipelineRenderStateTokens(pipelineKey);
    const decision = {
        supported: areDepthOnlyShadowCasterTokensSupported(tokens),
        alphaMode: tokens.alphaMode,
        casterCullMode: casterCullModeForForward(tokens.cullMode),
    };
    cache.set(pipelineKey, decision);
    return decision;
}
function cachedAssetHandleKey(cache, handle) {
    const cached = cache.get(handle);
    if (cached !== undefined) {
        return cached;
    }
    const key = assetHandleKey(handle);
    cache.set(handle, key);
    return key;
}
export function createShadowCasterDrawListPlanReport(input) {
    const commandEncoding = input.commandEncoding ?? "deferred";
    if (input.shadowRequests.length === 0) {
        return {
            ready: true,
            status: "not-required",
            requestCount: 0,
            meshDrawCount: input.meshDraws.length,
            listCount: 0,
            includedDrawCount: 0,
            skippedDrawCount: 0,
            sections: {
                shadowRequests: true,
                passPlans: true,
                casterFiltering: true,
                commandEncoding: true,
            },
            lists: [],
            diagnostics: [],
        };
    }
    const diagnostics = [];
    const requestsByKey = new Map(input.shadowRequests.map((request) => [
        `${request.shadowId}:${request.lightId}`,
        request,
    ]));
    const plannedRequestKeys = new Set(input.shadowPassPlan.passes.map((pass) => `${pass.shadowId}:${pass.lightId}`));
    const renderStateByPipelineKey = new Map();
    const meshKeys = new Map();
    const materialKeys = new Map();
    const lists = [];
    for (const request of input.shadowRequests) {
        if (plannedRequestKeys.has(`${request.shadowId}:${request.lightId}`)) {
            continue;
        }
        diagnostics.push({
            code: "shadowCasterDrawList.missingPassPlan",
            severity: "warning",
            shadowId: request.shadowId,
            lightId: request.lightId,
            message: `Shadow request '${request.shadowId}' has no planned shadow pass for caster draw-list planning.`,
        });
    }
    for (const pass of input.shadowPassPlan.passes) {
        const request = requestsByKey.get(`${pass.shadowId}:${pass.lightId}`);
        if (request === undefined) {
            diagnostics.push({
                code: "shadowCasterDrawList.missingPassPlan",
                severity: "warning",
                shadowId: pass.shadowId,
                lightId: pass.lightId,
                message: `Shadow pass '${pass.passKey}' has no extracted shadow request for caster draw-list planning.`,
            });
            continue;
        }
        const included = [];
        for (const draw of input.meshDraws) {
            if (draw.castsShadow === false ||
                (draw.layerMask & request.casterLayerMask) === 0) {
                continue;
            }
            const renderState = shadowCasterRenderStateDecision(draw.batchKey.pipelineKey, renderStateByPipelineKey);
            if (!renderState.supported) {
                const alphaMode = renderState.alphaMode;
                const alphaTest = alphaMode === "alpha-test";
                diagnostics.push({
                    code: alphaTest
                        ? "shadowCasterDrawList.unsupportedAlphaTestCaster"
                        : "shadowCasterDrawList.unsupportedAlphaBlendCaster",
                    severity: "warning",
                    shadowId: request.shadowId,
                    lightId: request.lightId,
                    message: alphaTest
                        ? `Shadow request '${request.shadowId}' skipped alpha-tested render object '${draw.renderId}' because the depth-only shadow caster pass cannot evaluate material cutoff alpha.`
                        : `Shadow request '${request.shadowId}' skipped alpha-blended render object '${draw.renderId}' because the depth-only shadow caster pass cannot evaluate material alpha.`,
                });
                continue;
            }
            included.push({
                renderId: draw.renderId,
                meshKey: cachedAssetHandleKey(meshKeys, draw.mesh),
                materialKey: cachedAssetHandleKey(materialKeys, draw.material),
                meshLayoutKey: draw.batchKey.meshLayoutKey,
                casterCullMode: renderState.casterCullMode,
                submesh: draw.submesh,
                ...(draw.vertexStart === undefined
                    ? {}
                    : { vertexStart: draw.vertexStart }),
                ...(draw.vertexCount === undefined
                    ? {}
                    : { vertexCount: draw.vertexCount }),
                ...(draw.indexStart === undefined
                    ? {}
                    : { indexStart: draw.indexStart }),
                ...(draw.indexCount === undefined
                    ? {}
                    : { indexCount: draw.indexCount }),
                layerMask: draw.layerMask,
                boundsIndex: draw.boundsIndex,
                worldTransformOffset: draw.worldTransformOffset,
            });
        }
        included.sort(compareShadowCasterDrawRecords);
        const skippedDrawCount = input.meshDraws.length - included.length;
        if (included.length === 0) {
            diagnostics.push({
                code: "shadowCasterDrawList.noCasters",
                severity: "warning",
                shadowId: request.shadowId,
                lightId: request.lightId,
                message: `Shadow request '${request.shadowId}' has no mesh draws matching caster layer mask '${request.casterLayerMask}'.`,
            });
        }
        lists.push({
            shadowId: request.shadowId,
            lightId: request.lightId,
            passKey: pass.passKey,
            casterLayerMask: request.casterLayerMask,
            receiverLayerMask: request.receiverLayerMask,
            includedDrawCount: included.length,
            skippedDrawCount,
            commandEncoding,
            draws: included,
        });
    }
    if (lists.some((list) => list.includedDrawCount > 0) &&
        commandEncoding === "deferred") {
        const first = lists.find((list) => list.includedDrawCount > 0);
        diagnostics.push({
            code: "shadowCasterDrawList.commandEncodingDeferred",
            severity: "warning",
            shadowId: first?.shadowId ?? 0,
            lightId: first?.lightId ?? 0,
            message: "Shadow caster draw lists are planned, but shadow command encoding is not implemented yet.",
        });
    }
    const hasMissingPass = diagnostics.some((diagnostic) => diagnostic.code === "shadowCasterDrawList.missingPassPlan");
    const status = hasMissingPass
        ? "missing"
        : commandEncoding === "ready"
            ? "ready"
            : "deferred";
    const includedDrawCount = lists.reduce((sum, list) => sum + list.includedDrawCount, 0);
    const skippedDrawCount = lists.reduce((sum, list) => sum + list.skippedDrawCount, 0);
    return {
        ready: status === "ready",
        status,
        requestCount: input.shadowRequests.length,
        meshDrawCount: input.meshDraws.length,
        listCount: lists.length,
        includedDrawCount,
        skippedDrawCount,
        sections: {
            shadowRequests: true,
            passPlans: !hasMissingPass,
            casterFiltering: true,
            commandEncoding: status === "ready",
        },
        lists,
        diagnostics,
    };
}
function compareShadowCasterDrawRecords(a, b) {
    return (compareStrings(a.meshKey, b.meshKey) ||
        compareStrings(a.materialKey, b.materialKey) ||
        compareStrings(a.meshLayoutKey, b.meshLayoutKey) ||
        compareStrings(a.casterCullMode, b.casterCullMode) ||
        compareNumbers(a.submesh, b.submesh) ||
        compareOptionalNumbers(a.vertexStart, b.vertexStart) ||
        compareOptionalNumbers(a.vertexCount, b.vertexCount) ||
        compareOptionalNumbers(a.indexStart, b.indexStart) ||
        compareOptionalNumbers(a.indexCount, b.indexCount) ||
        compareNumbers(a.layerMask, b.layerMask) ||
        a.renderId - b.renderId);
}
function compareStrings(a, b) {
    if (a < b)
        return -1;
    if (a > b)
        return 1;
    return 0;
}
function compareNumbers(a, b) {
    return a - b;
}
function compareOptionalNumbers(a, b) {
    return (a ?? -1) - (b ?? -1);
}
export function shadowCasterDrawListPlanReportToJsonValue(report) {
    return {
        ready: report.ready,
        status: report.status,
        requestCount: report.requestCount,
        meshDrawCount: report.meshDrawCount,
        listCount: report.listCount,
        includedDrawCount: report.includedDrawCount,
        skippedDrawCount: report.skippedDrawCount,
        sections: { ...report.sections },
        lists: report.lists.map((list) => ({
            ...list,
            draws: list.draws.map((draw) => ({ ...draw })),
        })),
        diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    };
}
export function shadowCasterDrawListPlanReportToJson(report) {
    return JSON.stringify(shadowCasterDrawListPlanReportToJsonValue(report));
}
//# sourceMappingURL=shadow-caster-draw-list-plan.js.map