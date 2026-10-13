import { createLightShaderResourceReadinessReport, lightShaderResourceReadinessReportToJsonValue, } from "./light-shader-metadata.js";
export function createDirectLightReadinessReport(input) {
    const resources = input.resources ?? null;
    const metadata = input.metadata ?? { valid: true, diagnostics: [] };
    const shaderReadiness = createLightShaderResourceReadinessReport({
        lightGpuBufferResourceKey: resources?.lightGpuBufferResourceKey ?? null,
        layoutKey: resources?.lightBindGroupLayoutKey ?? null,
        bindGroupResourceKey: resources?.lightBindGroupResourceKey ?? null,
        metadata,
    });
    return directLightReadinessReportFromShaderReadiness({
        lightCounts: countDirectLightKinds(input.snapshot.lights),
        resources,
        metadata,
        shaderReadiness,
    });
}
export function directLightReadinessResourceStateFromStandardFrameResources(resources) {
    return {
        lightGpuBufferResourceKey: resources?.lightGpuBuffers.resource?.resourceKey ?? null,
        lightBindGroupLayoutKey: resources?.lightBindGroup.layoutKey ?? null,
        lightBindGroupResourceKey: resources?.lightBindGroup.resourceKey ?? null,
    };
}
export function directLightReadinessReportToJsonValue(report) {
    return {
        ready: report.ready,
        lightCounts: { ...report.lightCounts },
        sections: { ...report.sections },
        resources: { ...report.resources },
        shaderMetadata: {
            valid: report.shaderMetadata.valid,
            diagnostics: report.shaderMetadata.diagnostics.map((diagnostic) => ({
                ...diagnostic,
            })),
        },
        diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    };
}
export function directLightReadinessReportToJson(report) {
    return JSON.stringify(directLightReadinessReportToJsonValue(report));
}
function directLightReadinessReportFromShaderReadiness(input) {
    const shaderReadiness = lightShaderResourceReadinessReportToJsonValue(input.shaderReadiness);
    return {
        ready: shaderReadiness.ready,
        lightCounts: input.lightCounts,
        sections: {
            lightGpuBuffers: shaderReadiness.sections.lightGpuBuffers,
            lightBindGroupLayout: shaderReadiness.sections.layout,
            lightBindGroup: shaderReadiness.sections.bindGroup,
            shaderMetadata: shaderReadiness.sections.metadata,
        },
        resources: {
            lightGpuBufferResourceKey: input.resources?.lightGpuBufferResourceKey ?? null,
            lightBindGroupLayoutKey: input.resources?.lightBindGroupLayoutKey ?? null,
            lightBindGroupResourceKey: input.resources?.lightBindGroupResourceKey ?? null,
        },
        shaderMetadata: {
            valid: input.metadata.valid,
            diagnostics: input.metadata.diagnostics.map((diagnostic) => ({
                ...diagnostic,
            })),
        },
        diagnostics: shaderReadiness.diagnostics,
    };
}
function countDirectLightKinds(lights) {
    const counts = {
        total: lights.length,
        direct: 0,
        ambient: 0,
        directional: 0,
        point: 0,
        spot: 0,
        rectArea: 0,
        environment: 0,
        areaShapes: {
            rect: 0,
            disk: 0,
            sphere: 0,
        },
    };
    for (const light of lights) {
        incrementLightKindCount(counts, light.kind);
        if (isDirectLightKind(light.kind)) {
            counts.direct += 1;
        }
        if (light.kind === "rect-area") {
            incrementAreaLightShapeCount(counts.areaShapes, light.shape);
        }
    }
    return counts;
}
function isDirectLightKind(kind) {
    return (kind === "directional" ||
        kind === "point" ||
        kind === "spot" ||
        kind === "rect-area");
}
function incrementLightKindCount(counts, kind) {
    switch (kind) {
        case "ambient":
            counts.ambient += 1;
            return;
        case "directional":
            counts.directional += 1;
            return;
        case "point":
            counts.point += 1;
            return;
        case "spot":
            counts.spot += 1;
            return;
        case "rect-area":
            counts.rectArea += 1;
            return;
        case "environment":
            counts.environment += 1;
            return;
    }
}
function incrementAreaLightShapeCount(counts, shape) {
    switch (shape) {
        case "disk":
            counts.disk += 1;
            return;
        case "sphere":
            counts.sphere += 1;
            return;
        case "rect":
        case undefined:
            counts.rect += 1;
            return;
    }
}
//# sourceMappingURL=direct-light-readiness.js.map