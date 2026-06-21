import { createLightBufferDescriptor, createLightBufferDescriptorPlan, createLightGpuBuffers, } from "./light-packing.js";
import { createLightBindGroupLayoutResource, } from "./light-bind-group-layout.js";
import { createLightBindGroupDescriptorPlan, createLightBindGroupResource, createLightBindGroupResourceResultToJsonValue, lightBindGroupDescriptorPlanToJsonValue, } from "./light-bind-group.js";
import { planEnvironmentResources, } from "./environment-resource-planning.js";
import { createRenderResourceSummaryReport, renderResourceSummaryReportToJson, renderResourceSummaryReportToJsonValue, } from "../resources/core/resource-summary.js";
export function planSnapshotLightingResources(snapshot, options = {}) {
    return {
        lightBuffer: createLightBufferDescriptor(snapshot, options.lightBuffer),
        environments: planEnvironmentResources(snapshot),
    };
}
export function createSnapshotLightGpuBuffers(snapshot, options) {
    const lightBuffer = createLightBufferDescriptor(snapshot, options.lightBuffer);
    const descriptorPlan = createLightBufferDescriptorPlan(lightBuffer, options.descriptorPlan);
    const diagnostics = [
        ...descriptorPlan.diagnostics,
    ];
    if (!descriptorPlan.valid) {
        return {
            valid: false,
            lightBuffer,
            descriptorPlan: null,
            resource: null,
            diagnostics,
        };
    }
    if (descriptorPlan.plan === null) {
        return {
            valid: true,
            lightBuffer,
            descriptorPlan: null,
            resource: null,
            diagnostics,
        };
    }
    const resource = createLightGpuBuffers({
        device: options.device,
        plan: descriptorPlan.plan,
    });
    diagnostics.push(...resource.diagnostics);
    return {
        valid: resource.valid,
        lightBuffer,
        descriptorPlan: descriptorPlan.plan,
        resource: resource.resource,
        diagnostics,
    };
}
export function createSnapshotLightBindGroupResources(snapshot, options) {
    const diagnostics = [];
    const lightGpuBuffers = createSnapshotLightGpuBuffers(snapshot, {
        device: options.device,
        ...(options.lightBuffer === undefined
            ? {}
            : { lightBuffer: options.lightBuffer }),
        ...(options.lightBufferDescriptorPlan === undefined
            ? {}
            : { descriptorPlan: options.lightBufferDescriptorPlan }),
    });
    diagnostics.push(...lightGpuBuffers.diagnostics);
    if (lightGpuBuffers.valid &&
        lightGpuBuffers.lightBuffer.count === 0 &&
        lightGpuBuffers.resource === null) {
        return {
            valid: true,
            lightGpuBuffers,
            layout: null,
            descriptorPlan: null,
            bindGroup: null,
            diagnostics,
        };
    }
    if (!lightGpuBuffers.valid || lightGpuBuffers.resource === null) {
        return {
            valid: false,
            lightGpuBuffers,
            layout: null,
            descriptorPlan: null,
            bindGroup: null,
            diagnostics,
        };
    }
    const layout = createLightBindGroupLayoutResource({
        device: options.device,
        ...options.layout,
    });
    diagnostics.push(...layout.diagnostics);
    if (!layout.valid || layout.resource === null) {
        return {
            valid: false,
            lightGpuBuffers,
            layout,
            descriptorPlan: null,
            bindGroup: null,
            diagnostics,
        };
    }
    const descriptorPlan = createLightBindGroupDescriptorPlan({
        lightGpuBufferResource: lightGpuBuffers.resource,
        layoutKey: layout.resource.layoutKey,
        group: options.bindGroup?.group ?? layout.resource.group,
        ...(options.bindGroup?.label === undefined
            ? {}
            : { label: options.bindGroup.label }),
    });
    diagnostics.push(...descriptorPlan.diagnostics);
    if (!descriptorPlan.valid) {
        return {
            valid: false,
            lightGpuBuffers,
            layout,
            descriptorPlan,
            bindGroup: null,
            diagnostics,
        };
    }
    const bindGroup = createLightBindGroupResource({
        device: options.device,
        plan: descriptorPlan,
        layout: layout.resource,
    });
    diagnostics.push(...bindGroup.diagnostics);
    return {
        valid: bindGroup.valid,
        lightGpuBuffers,
        layout,
        descriptorPlan,
        bindGroup,
        diagnostics,
    };
}
export function createSnapshotLightGpuBuffersResultToJsonValue(result) {
    return {
        valid: result.valid,
        lightBuffer: {
            resourceKey: result.lightBuffer.resourceKey,
            usageIntent: result.lightBuffer.usageIntent,
            count: result.lightBuffer.count,
            byteLength: result.lightBuffer.byteLength,
            floatByteLength: result.lightBuffer.floatByteLength,
            metadataByteLength: result.lightBuffer.metadataByteLength,
        },
        descriptorPlan: result.descriptorPlan === null
            ? { present: false }
            : {
                present: true,
                resourceKey: result.descriptorPlan.resourceKey,
                floatByteLength: result.descriptorPlan.floatDescriptor.size,
                metadataByteLength: result.descriptorPlan.metadataDescriptor.size,
            },
        resource: result.resource === null
            ? null
            : {
                resourceKey: result.resource.resourceKey,
                floatResourceKey: result.resource.floatResourceKey,
                metadataResourceKey: result.resource.metadataResourceKey,
                count: result.resource.count,
            },
        counts: {
            plannedLights: result.lightBuffer.count,
            plannedGpuBuffers: result.descriptorPlan === null ? 0 : 2,
            createdLights: result.resource?.count ?? 0,
            createdGpuBuffers: result.resource === null ? 0 : 2,
            diagnostics: result.diagnostics.length,
        },
        diagnostics: result.diagnostics.map(snapshotLightDiagnosticToJsonValue),
    };
}
export function createSnapshotLightGpuBuffersResultToJson(result) {
    return JSON.stringify(createSnapshotLightGpuBuffersResultToJsonValue(result));
}
export function createSnapshotLightBindGroupResourcesResultToJsonValue(result) {
    return {
        valid: result.valid,
        phases: {
            lightGpuBuffers: result.lightGpuBuffers.valid,
            layout: result.layout?.valid ?? null,
            descriptorPlan: result.descriptorPlan?.valid ?? null,
            bindGroup: result.bindGroup?.valid ?? null,
        },
        lightGpuBuffers: createSnapshotLightGpuBuffersResultToJsonValue(result.lightGpuBuffers),
        layout: snapshotLightBindGroupLayoutResultToJsonValue(result.layout),
        descriptorPlan: result.descriptorPlan === null
            ? null
            : lightBindGroupDescriptorPlanToJsonValue(result.descriptorPlan),
        bindGroup: result.bindGroup === null
            ? null
            : createLightBindGroupResourceResultToJsonValue(result.bindGroup),
        counts: {
            plannedLights: result.lightGpuBuffers.lightBuffer.count,
            lightGpuBuffers: result.lightGpuBuffers.resource === null ? 0 : 1,
            layouts: result.layout?.resource == null ? 0 : 1,
            bindGroups: result.bindGroup?.resource == null ? 0 : 1,
            diagnostics: result.diagnostics.length,
        },
        diagnostics: result.diagnostics.map(snapshotLightBindGroupDiagnosticToJsonValue),
    };
}
export function createSnapshotLightBindGroupResourcesResultToJson(result) {
    return JSON.stringify(createSnapshotLightBindGroupResourcesResultToJsonValue(result));
}
export function snapshotLightingResourcePlanToJsonValue(plan) {
    return {
        lightBuffer: {
            resourceKey: plan.lightBuffer.resourceKey,
            usageIntent: plan.lightBuffer.usageIntent,
            count: plan.lightBuffer.count,
            byteLength: plan.lightBuffer.byteLength,
            floatByteLength: plan.lightBuffer.floatByteLength,
            metadataByteLength: plan.lightBuffer.metadataByteLength,
        },
        environments: {
            environmentCount: plan.environments.environmentCount,
            nullHandleCount: plan.environments.nullHandleCount,
            resourceKeys: plan.environments.requirements.map((requirement) => requirement.resourceKey),
        },
    };
}
export function snapshotLightingResourcePlanToJson(plan) {
    return JSON.stringify(snapshotLightingResourcePlanToJsonValue(plan));
}
export function snapshotLightingResourcePlanToSummaryInput(plan) {
    return {
        lightBuffers: [plan.lightBuffer],
        environmentResources: [plan.environments],
    };
}
export function snapshotLightGpuBuffersToSummaryInput(result) {
    return {
        lightBuffers: [result.lightBuffer],
        lightGpuBufferResources: result.descriptorPlan === null
            ? []
            : [
                {
                    valid: result.valid && result.resource !== null,
                    resource: result.resource,
                    diagnostics: result.diagnostics.filter(isLightGpuBufferDiagnostic),
                },
            ],
    };
}
export function snapshotLightBindGroupResourcesToSummaryInput(result) {
    return {
        lightBuffers: [result.lightGpuBuffers.lightBuffer],
        lightGpuBufferResources: result.lightGpuBuffers.descriptorPlan === null
            ? []
            : [
                {
                    valid: result.lightGpuBuffers.valid &&
                        result.lightGpuBuffers.resource !== null,
                    resource: result.lightGpuBuffers.resource,
                    diagnostics: result.lightGpuBuffers.diagnostics.filter(isLightGpuBufferDiagnostic),
                },
            ],
        lightBindGroupResources: result.bindGroup === null ? [] : [result.bindGroup],
    };
}
export function createSnapshotLightResourceSummaryReport(result) {
    return createRenderResourceSummaryReport({
        meshResources: [],
        materialResources: [],
        viewUniformResources: [],
        shaderResources: [],
        pipelines: [],
        ...snapshotLightBindGroupResourcesToSummaryInput(result),
    });
}
export function snapshotLightResourceSummaryReportToJsonValue(result) {
    return renderResourceSummaryReportToJsonValue(createSnapshotLightResourceSummaryReport(result));
}
export function snapshotLightResourceSummaryReportToJson(result) {
    return renderResourceSummaryReportToJson(createSnapshotLightResourceSummaryReport(result));
}
function snapshotLightDiagnosticToJsonValue(diagnostic) {
    return {
        code: diagnostic.code,
        message: diagnostic.message,
        ...("field" in diagnostic && diagnostic.field === undefined
            ? {}
            : "field" in diagnostic
                ? { field: diagnostic.field }
                : {}),
        ...("reason" in diagnostic && diagnostic.reason === undefined
            ? {}
            : "reason" in diagnostic
                ? { reason: diagnostic.reason }
                : {}),
        ...("resourceKey" in diagnostic && diagnostic.resourceKey === undefined
            ? {}
            : "resourceKey" in diagnostic
                ? { resourceKey: diagnostic.resourceKey }
                : {}),
    };
}
function isLightGpuBufferDiagnostic(diagnostic) {
    return diagnostic.code.startsWith("lightGpuBuffer.");
}
function snapshotLightBindGroupLayoutResultToJsonValue(result) {
    if (result === null) {
        return null;
    }
    return {
        valid: result.valid,
        resource: result.resource === null
            ? null
            : {
                group: result.resource.group,
                layoutKey: result.resource.layoutKey,
            },
        counts: {
            layouts: result.resource === null ? 0 : 1,
            diagnostics: result.diagnostics.length,
        },
        diagnostics: result.diagnostics.map(snapshotLightBindGroupDiagnosticToJsonValue),
    };
}
function snapshotLightBindGroupDiagnosticToJsonValue(diagnostic) {
    return {
        code: diagnostic.code,
        message: diagnostic.message,
        ...("field" in diagnostic && diagnostic.field === undefined
            ? {}
            : "field" in diagnostic
                ? { field: diagnostic.field }
                : {}),
        ...("reason" in diagnostic && diagnostic.reason === undefined
            ? {}
            : "reason" in diagnostic
                ? { reason: diagnostic.reason }
                : {}),
        ...("resourceKey" in diagnostic && diagnostic.resourceKey === undefined
            ? {}
            : "resourceKey" in diagnostic
                ? { resourceKey: diagnostic.resourceKey }
                : {}),
        ...("layoutKey" in diagnostic && diagnostic.layoutKey === undefined
            ? {}
            : "layoutKey" in diagnostic
                ? { layoutKey: diagnostic.layoutKey }
                : {}),
    };
}
//# sourceMappingURL=lighting-resource-plan.js.map