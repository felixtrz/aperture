export function createSpotShadowViewProjectionPlanReport(input) {
    const computation = input.computation ?? "deferred";
    const spotRequests = input.shadowRequests.filter((request) => request.lightKind === "spot");
    if (spotRequests.length === 0) {
        return {
            ready: true,
            status: "not-required",
            requestCount: 0,
            passCount: input.shadowPassPlan.passCount,
            planCount: 0,
            sections: {
                shadowRequests: true,
                lightPackets: true,
                passPlans: true,
                matrixPlanning: true,
                gpuResources: false,
            },
            plans: [],
            diagnostics: [],
        };
    }
    const diagnostics = [];
    const lightsById = new Map(input.lights.map((light) => [light.lightId, light]));
    const passesByKey = new Map(input.shadowPassPlan.passes.map((pass) => [
        `${pass.shadowId}:${pass.lightId}`,
        pass,
    ]));
    const plans = [];
    for (const request of spotRequests) {
        const light = lightsById.get(request.lightId);
        const pass = passesByKey.get(`${request.shadowId}:${request.lightId}`);
        if (light === undefined) {
            diagnostics.push({
                code: "spotShadowViewProjection.missingLight",
                severity: "warning",
                shadowId: request.shadowId,
                lightId: request.lightId,
                message: `Spot shadow request '${request.shadowId}' references missing light '${request.lightId}'.`,
            });
            continue;
        }
        if (light.kind !== "spot") {
            diagnostics.push({
                code: "spotShadowViewProjection.unsupportedLightKind",
                severity: "warning",
                shadowId: request.shadowId,
                lightId: request.lightId,
                message: `Spot shadow request '${request.shadowId}' references unsupported light kind '${light.kind}'.`,
            });
            continue;
        }
        if (pass === undefined) {
            diagnostics.push({
                code: "spotShadowViewProjection.missingPassPlan",
                severity: "warning",
                shadowId: request.shadowId,
                lightId: request.lightId,
                message: `Spot shadow request '${request.shadowId}' has no matching shadow pass plan.`,
            });
            continue;
        }
        plans.push({
            shadowId: request.shadowId,
            lightId: request.lightId,
            planKey: `spot-shadow-view-projection:${request.shadowId}:light:${request.lightId}`,
            passKey: pass.passKey,
            lightKind: "spot",
            lightTransformOffset: light.worldTransformOffset,
            mapSize: pass.width,
            casterLayerMask: request.casterLayerMask,
            receiverLayerMask: request.receiverLayerMask,
            projection: "perspective-spot",
            // three.js SpotLightShadow: fov = 2 * outerConeAngle * focus (focus = 1),
            // i.e. the FULL vertical cone angle. outerConeAngle is the half-angle.
            fovYRadians: Math.max(light.outerConeAngle * 2, 0.01),
            // Perspective shadow depth precision collapses toward the far plane, so a
            // near plane that is a meaningful fraction of the range keeps usable
            // contrast between occluder and receiver depths (mirrors the point shadow
            // fix; three.js uses a fixed 0.5 near for its default range). range/1000
            // crushed nearly all precision into [0.99, 1.0]. The min() keeps near
            // strictly below far for tiny-range spots (far = range), since
            // makePerspective throws when near >= far.
            near: input.near ?? spotShadowNearPlane(light.range),
            far: light.range,
            viewMatrixKey: `${pass.passKey}:view`,
            projectionMatrixKey: `${pass.passKey}:projection`,
            viewProjectionMatrixKey: `${pass.passKey}:view-projection`,
            computation,
        });
    }
    if (plans.length > 0 && computation === "deferred") {
        diagnostics.push({
            code: "spotShadowViewProjection.matrixDeferred",
            severity: "warning",
            shadowId: plans[0]?.shadowId ?? 0,
            lightId: plans[0]?.lightId ?? 0,
            message: "Spot shadow view/projection keys are planned, but matrix computation is not implemented yet.",
        });
    }
    const hasMissing = diagnostics.some((diagnostic) => diagnostic.code === "spotShadowViewProjection.missingLight" ||
        diagnostic.code === "spotShadowViewProjection.missingPassPlan");
    const hasUnsupported = diagnostics.some((diagnostic) => diagnostic.code === "spotShadowViewProjection.unsupportedLightKind");
    const status = determineStatus({ computation, hasMissing, hasUnsupported });
    return {
        ready: status === "ready",
        status,
        requestCount: spotRequests.length,
        passCount: input.shadowPassPlan.passCount,
        planCount: plans.length,
        sections: {
            shadowRequests: true,
            lightPackets: !hasMissing,
            passPlans: !hasMissing,
            matrixPlanning: status === "ready",
            gpuResources: false,
        },
        plans,
        diagnostics,
    };
}
export function spotShadowViewProjectionPlanReportToJsonValue(report) {
    return {
        ready: report.ready,
        status: report.status,
        requestCount: report.requestCount,
        passCount: report.passCount,
        planCount: report.planCount,
        sections: { ...report.sections },
        plans: report.plans.map((plan) => ({ ...plan })),
        diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    };
}
export function spotShadowViewProjectionPlanReportToJson(report) {
    return JSON.stringify(spotShadowViewProjectionPlanReportToJsonValue(report));
}
/**
 * Perspective near plane for a spot shadow: a range-scaled fraction with a small
 * floor for depth precision, capped at half the range so it stays strictly below
 * the far plane (far = range) even for tiny-range spots — makePerspective throws
 * when near >= far.
 */
function spotShadowNearPlane(range) {
    return Math.min(Math.max(range * 0.02, 0.05), range * 0.5);
}
function determineStatus(input) {
    if (input.hasMissing) {
        return "missing";
    }
    if (input.hasUnsupported) {
        return "unsupported";
    }
    return input.computation;
}
//# sourceMappingURL=spot-shadow-view-projection-plan.js.map