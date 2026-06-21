import { createMaterialQueuePhaseSummary, renderQueueSortPolicyForPhase, } from "/aperture/worker-modules/packages/render/dist/index.js";
import { createDirectLightReadinessReport, directLightReadinessResourceStateFromStandardFrameResources, } from "../lighting/direct-light-readiness.js";
import { createStandardAreaLightLtcResources, } from "../materials/standard/standard-area-light-ltc-resource.js";
import { createQueuedMaterialFrameResourceSetSummary } from "../render/queues/queued-material-frame-resource-set-summary.js";
import { createRenderFrameQueueDiagnosticsSummary } from "../render/frame/render-frame-plan.js";
import { collectWebGpuAppMaterialQueueRouteReport, createWebGpuAppDiagnosticsSummary, } from "./app-diagnostics-summary.js";
export function snapshotUsesTransmission(snapshot) {
    return snapshot.meshDraws.some((draw) => draw.batchKey.pipelineKey.split("|").includes("transmission"));
}
export function queuedBuiltInResourceSetHasStandardMaterial(resourceSet) {
    return resourceSet.items.some((item) => item.adapter.kind === "standard");
}
export function createQueuedBuiltInAppDiagnosticsSummary(input) {
    const hasStandardRoute = input.resourceSet.items.some((item) => item.queueItem.materialFamily === "standard");
    return createWebGpuAppDiagnosticsSummary({
        materialQueue: createMaterialQueuePhaseSummary(input.resourceSet.items.map((item) => item.queueItem)),
        routedResourceSet: createQueuedMaterialFrameResourceSetSummary(input.resourceSet.items.map((item) => ({
            materialFamily: item.queueItem.materialFamily,
            pipelineKey: item.draw.batchKey.pipelineKey,
            renderPhase: item.queueItem.renderPhase,
        })), input.resources === null
            ? {}
            : { byFamily: input.resources.byFamilySummary }),
        renderQueueSortPhases: createQueuedBuiltInAppSortPhaseSummary(input.resourceSet.items),
        ...(input.framePlan === undefined
            ? {}
            : {
                renderFrameQueue: createRenderFrameQueueDiagnosticsSummary(input.framePlan),
            }),
        builtInAppResourceAdapters: input.adapterValidation,
        ...(hasStandardRoute
            ? {
                directLighting: createDirectLightReadinessReport({
                    snapshot: input.snapshot,
                    resources: input.resources === null
                        ? null
                        : directLightReadinessResourceStateFromStandardFrameResources(input.resources.standard[0] ?? null),
                }),
            }
            : {}),
    });
}
export function collectInstanceTintResources(resources) {
    const result = [];
    const seen = new Set();
    for (const standard of resources.standard) {
        const instanceTints = standard.instanceTints;
        if (instanceTints === undefined || seen.has(instanceTints.resourceKey)) {
            continue;
        }
        seen.add(instanceTints.resourceKey);
        result.push(instanceTints);
    }
    return result;
}
export function createQueuedBuiltInRouteFailureDiagnosticsSummary(diagnostics, adapterValidation) {
    const materialQueueRoute = collectWebGpuAppMaterialQueueRouteReport(diagnostics);
    return materialQueueRoute === null
        ? undefined
        : createWebGpuAppDiagnosticsSummary({
            materialQueueRoute,
            builtInAppResourceAdapters: adapterValidation,
        });
}
export function resolveStandardAreaLightLtcResources(options) {
    if (!options.required) {
        return { valid: true, resources: null, diagnostics: [] };
    }
    const result = createStandardAreaLightLtcResources({
        device: options.app.initialization.device,
        textureCache: options.cache.textures,
        samplerCache: options.cache.samplers,
    });
    return {
        valid: result.valid,
        resources: result.resources,
        diagnostics: result.diagnostics,
    };
}
function createQueuedBuiltInAppSortPhaseSummary(items) {
    let opaque = 0;
    let transparent = 0;
    for (const item of items) {
        if (item.queueItem.renderPhase === "transparent") {
            transparent += 1;
        }
        else {
            opaque += 1;
        }
    }
    const phases = [];
    if (opaque > 0) {
        phases.push({
            phase: "opaque",
            recordCount: opaque,
            sortPolicy: renderQueueSortPolicyForPhase("opaque"),
        });
    }
    if (transparent > 0) {
        phases.push({
            phase: "transparent",
            recordCount: transparent,
            sortPolicy: renderQueueSortPolicyForPhase("transparent"),
        });
    }
    return phases;
}
//# sourceMappingURL=queued-built-in-support.js.map