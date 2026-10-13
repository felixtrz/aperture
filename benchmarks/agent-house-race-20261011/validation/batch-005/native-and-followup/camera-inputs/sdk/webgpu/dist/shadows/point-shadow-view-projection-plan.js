const FACE_LABELS = ["+x", "-x", "+y", "-y", "+z", "-z"];
export function createPointShadowViewProjectionPlanReport(input) {
    const computation = input.computation ?? "deferred";
    const pointRequests = input.shadowRequests.filter((request) => request.lightKind === "point");
    if (pointRequests.length === 0) {
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
        `${pass.shadowId}:${pass.lightId}:${pass.faceIndex}`,
        pass,
    ]));
    const plans = [];
    for (const request of pointRequests) {
        const light = lightsById.get(request.lightId);
        if (light === undefined) {
            diagnostics.push({
                code: "pointShadowViewProjection.missingLight",
                severity: "warning",
                shadowId: request.shadowId,
                lightId: request.lightId,
                message: `Point shadow request '${request.shadowId}' references missing light '${request.lightId}'.`,
            });
            continue;
        }
        if (light.kind !== "point") {
            diagnostics.push({
                code: "pointShadowViewProjection.unsupportedLightKind",
                severity: "warning",
                shadowId: request.shadowId,
                lightId: request.lightId,
                message: `Point shadow request '${request.shadowId}' references unsupported light kind '${light.kind}'.`,
            });
            continue;
        }
        for (let faceIndex = 0; faceIndex < FACE_LABELS.length; faceIndex += 1) {
            const pass = passesByKey.get(`${request.shadowId}:${request.lightId}:${faceIndex}`);
            if (pass === undefined) {
                diagnostics.push({
                    code: "pointShadowViewProjection.missingPassPlan",
                    severity: "warning",
                    shadowId: request.shadowId,
                    lightId: request.lightId,
                    message: `Point shadow request '${request.shadowId}' has no pass plan for face ${faceIndex}.`,
                });
                continue;
            }
            plans.push({
                shadowId: request.shadowId,
                lightId: request.lightId,
                faceIndex,
                faceLabel: FACE_LABELS[faceIndex] ?? "+x",
                planKey: `point-shadow-view-projection:${request.shadowId}:light:${request.lightId}:face:${faceIndex}`,
                passKey: pass.passKey,
                lightKind: "point",
                lightTransformOffset: light.worldTransformOffset,
                mapSize: pass.width,
                casterLayerMask: request.casterLayerMask,
                receiverLayerMask: request.receiverLayerMask,
                projection: "perspective-cube-face",
                fovYRadians: Math.PI / 2,
                // Perspective shadow depth precision collapses toward the far plane, so
                // a near plane that is a meaningful fraction of the range keeps usable
                // contrast between occluder and receiver depths (three.js uses a fixed
                // 0.5 for its default range; this scales with the light so small and
                // large lights both stay well-conditioned). range/1000 crushed nearly
                // all precision into [0.99, 1.0]. The min() keeps near strictly below
                // far for tiny-range lights (far = range), since makePerspective throws
                // when near >= far.
                near: input.near ?? pointShadowNearPlane(light.range),
                far: light.range,
                viewMatrixKey: `${pass.passKey}:view`,
                projectionMatrixKey: `${pass.passKey}:projection`,
                viewProjectionMatrixKey: `${pass.passKey}:view-projection`,
                computation,
            });
        }
    }
    if (plans.length > 0 && computation === "deferred") {
        diagnostics.push({
            code: "pointShadowViewProjection.matrixDeferred",
            severity: "warning",
            shadowId: plans[0]?.shadowId ?? 0,
            lightId: plans[0]?.lightId ?? 0,
            message: "Point shadow cube-face view/projection keys are planned, but matrix computation is not implemented yet.",
        });
    }
    const hasMissing = diagnostics.some((diagnostic) => diagnostic.code === "pointShadowViewProjection.missingLight" ||
        diagnostic.code === "pointShadowViewProjection.missingPassPlan");
    const hasUnsupported = diagnostics.some((diagnostic) => diagnostic.code === "pointShadowViewProjection.unsupportedLightKind");
    const status = determineStatus({ computation, hasMissing, hasUnsupported });
    return {
        ready: status === "ready",
        status,
        requestCount: pointRequests.length,
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
export function pointShadowViewProjectionPlanReportToJsonValue(report) {
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
export function pointShadowViewProjectionPlanReportToJson(report) {
    return JSON.stringify(pointShadowViewProjectionPlanReportToJsonValue(report));
}
/**
 * Perspective near plane for a point cube face: a range-scaled fraction with a
 * small floor for depth precision, capped at half the range so it stays strictly
 * below the far plane (far = range) even for tiny-range lights — makePerspective
 * throws when near >= far.
 */
function pointShadowNearPlane(range) {
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
//# sourceMappingURL=point-shadow-view-projection-plan.js.map