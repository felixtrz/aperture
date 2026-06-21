import { bindGroupResourceKey } from "../resources/core/resource-keys.js";
export const SHADOW_CASTER_MATRIX_BIND_GROUP = 0;
export const SHADOW_CASTER_MATRIX_BIND_GROUP_LAYOUT_KEY = "shadow-caster/group-0:directional-shadow-matrices@0";
export function createShadowCasterMatrixBindGroupResourceReport(options) {
    if (options.matrixBufferResource.status === "not-required") {
        return report({
            status: "not-required",
            matrixBufferCount: 0,
            createdBindGroupCount: 0,
            reusedBindGroupCount: 0,
            resource: null,
            diagnostics: [],
        });
    }
    const matrixResource = options.matrixBufferResource.resource;
    if (matrixResource === null) {
        return report({
            status: "missing",
            matrixBufferCount: 0,
            createdBindGroupCount: 0,
            reusedBindGroupCount: 0,
            resource: null,
            diagnostics: [
                {
                    code: "shadowCasterMatrixBindGroupResource.missingMatrixBufferResource",
                    severity: "warning",
                    message: "Shadow caster matrix bind-group creation requires a live shadow matrix buffer resource.",
                },
            ],
        });
    }
    const passMatrixResources = options.passMatrixResources ?? [];
    const worldTransformResource = options.worldTransformResource ?? null;
    if (passMatrixResources.length > 0 && worldTransformResource !== null) {
        return createPassMatrixWorldTransformBindGroups(options, passMatrixResources, worldTransformResource, matrixResource.resourceKey);
    }
    const diagnostics = [];
    if (passMatrixResources.length === 0) {
        diagnostics.push({
            code: "shadowCasterMatrixBindGroupResource.missingPassMatrixResource",
            severity: "warning",
            resourceKey: matrixResource.resourceKey,
            message: "Shadow caster matrix bind-group creation requires at least one pass matrix buffer.",
        });
    }
    if (worldTransformResource === null) {
        diagnostics.push({
            code: "shadowCasterMatrixBindGroupResource.missingWorldTransformResource",
            severity: "warning",
            resourceKey: matrixResource.resourceKey,
            message: "Shadow caster matrix bind-group creation requires a world-transform buffer.",
        });
    }
    return report({
        status: "missing",
        matrixBufferCount: passMatrixResources.length,
        createdBindGroupCount: 0,
        reusedBindGroupCount: 0,
        resources: [],
        diagnostics,
    });
}
export function createShadowCasterMatrixBindGroupLayoutDescriptor() {
    return {
        label: SHADOW_CASTER_MATRIX_BIND_GROUP_LAYOUT_KEY,
        entries: [
            {
                binding: 0,
                visibility: 1,
                buffer: { type: "uniform" },
            },
            {
                binding: 1,
                visibility: 1,
                buffer: { type: "read-only-storage" },
            },
        ],
    };
}
export function shadowCasterMatrixBindGroupResourceKey(matrixResourceKey) {
    return bindGroupResourceKey(`shadow-caster/group-${SHADOW_CASTER_MATRIX_BIND_GROUP}/${matrixResourceKey}`);
}
function shadowCasterPassMatrixBindGroupResourceKey(matrixResourceKey, passKey, worldTransformResourceKey) {
    return bindGroupResourceKey([
        `shadow-caster/group-${SHADOW_CASTER_MATRIX_BIND_GROUP}`,
        matrixResourceKey,
        `pass:${encodeURIComponent(passKey)}`,
        `world:${encodeURIComponent(worldTransformResourceKey)}`,
    ].join("/"));
}
function createPassMatrixWorldTransformBindGroups(options, passMatrixResources, worldTransformResource, matrixBufferResourceKey) {
    if (options.layout === undefined &&
        options.device.createBindGroupLayout === undefined) {
        return report({
            status: "missing",
            matrixBufferCount: 1,
            createdBindGroupCount: 0,
            reusedBindGroupCount: 0,
            resources: [],
            diagnostics: [
                {
                    code: "shadowCasterMatrixBindGroupResource.createBindGroupLayoutUnavailable",
                    severity: "warning",
                    resourceKey: matrixBufferResourceKey,
                    message: "WebGPU device cannot create the shadow caster matrix bind-group layout.",
                },
            ],
        });
    }
    if (options.device.createBindGroup === undefined) {
        return report({
            status: "missing",
            matrixBufferCount: 1,
            createdBindGroupCount: 0,
            reusedBindGroupCount: 0,
            resources: [],
            diagnostics: [
                {
                    code: "shadowCasterMatrixBindGroupResource.createBindGroupUnavailable",
                    severity: "warning",
                    resourceKey: matrixBufferResourceKey,
                    message: "WebGPU device cannot create the shadow caster matrix bind group.",
                },
            ],
        });
    }
    try {
        const layout = options.layout ??
            options.device.createBindGroupLayout?.(createShadowCasterMatrixBindGroupLayoutDescriptor());
        const resources = [];
        let createdBindGroupCount = 0;
        let reusedBindGroupCount = 0;
        for (const passMatrix of passMatrixResources) {
            const resourceKey = shadowCasterPassMatrixBindGroupResourceKey(passMatrix.matrixResourceKey, passMatrix.passKey, worldTransformResource.resourceKey);
            const cached = options.cache?.get(resourceKey);
            if (cached !== undefined) {
                resources.push(cached);
                reusedBindGroupCount += 1;
                continue;
            }
            const bindGroup = options.device.createBindGroup({
                label: resourceKey,
                layout,
                entries: [
                    {
                        binding: 0,
                        resource: { buffer: passMatrix.buffer },
                    },
                    {
                        binding: 1,
                        resource: { buffer: worldTransformResource.buffer },
                    },
                ],
            });
            const resource = {
                group: SHADOW_CASTER_MATRIX_BIND_GROUP,
                matrixResourceKey: passMatrix.matrixResourceKey,
                passKey: passMatrix.passKey,
                worldTransformResourceKey: worldTransformResource.resourceKey,
                resourceKey,
                layoutKey: SHADOW_CASTER_MATRIX_BIND_GROUP_LAYOUT_KEY,
                layout,
                bindGroup,
                entryResourceKeys: [
                    passMatrix.matrixResourceKey,
                    worldTransformResource.resourceKey,
                ],
            };
            options.cache?.set(resourceKey, resource);
            resources.push(resource);
            createdBindGroupCount += 1;
        }
        return report({
            status: resources.length === 0 ? "missing" : "available",
            matrixBufferCount: 1,
            createdBindGroupCount,
            reusedBindGroupCount,
            resources,
            diagnostics: deferredDiagnostics(),
        });
    }
    catch (error) {
        return report({
            status: "missing",
            matrixBufferCount: 1,
            createdBindGroupCount: 0,
            reusedBindGroupCount: 0,
            resources: [],
            diagnostics: [
                {
                    code: "shadowCasterMatrixBindGroupResource.creationFailed",
                    severity: "warning",
                    resourceKey: matrixBufferResourceKey,
                    message: error instanceof Error
                        ? error.message
                        : "WebGPU shadow caster matrix bind-group creation failed.",
                },
            ],
        });
    }
}
export function shadowCasterMatrixBindGroupResourceReportToJsonValue(value) {
    return {
        ready: value.ready,
        status: value.status,
        matrixBufferCount: value.matrixBufferCount,
        createdBindGroupCount: value.createdBindGroupCount,
        reusedBindGroupCount: value.reusedBindGroupCount,
        sections: { ...value.sections },
        resource: value.resource === null
            ? null
            : {
                group: value.resource.group,
                matrixResourceKey: value.resource.matrixResourceKey,
                ...(value.resource.passKey === undefined
                    ? {}
                    : { passKey: value.resource.passKey }),
                ...(value.resource.worldTransformResourceKey === undefined
                    ? {}
                    : {
                        worldTransformResourceKey: value.resource.worldTransformResourceKey,
                    }),
                resourceKey: value.resource.resourceKey,
                layoutKey: value.resource.layoutKey,
                entryResourceKeys: [...value.resource.entryResourceKeys],
            },
        resources: value.resources.map((resource) => ({
            group: resource.group,
            matrixResourceKey: resource.matrixResourceKey,
            ...(resource.passKey === undefined ? {} : { passKey: resource.passKey }),
            ...(resource.worldTransformResourceKey === undefined
                ? {}
                : { worldTransformResourceKey: resource.worldTransformResourceKey }),
            resourceKey: resource.resourceKey,
            layoutKey: resource.layoutKey,
            entryResourceKeys: [...resource.entryResourceKeys],
        })),
        diagnostics: value.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    };
}
export function shadowCasterMatrixBindGroupResourceReportToJson(value) {
    return JSON.stringify(shadowCasterMatrixBindGroupResourceReportToJsonValue(value));
}
function report(input) {
    const available = input.status === "available";
    const resources = input.resources ??
        (input.resource === undefined || input.resource === null
            ? []
            : [input.resource]);
    const resource = input.resource ?? resources[0] ?? null;
    return {
        ready: input.status === "available" || input.status === "not-required",
        status: input.status,
        matrixBufferCount: input.matrixBufferCount,
        createdBindGroupCount: input.createdBindGroupCount,
        reusedBindGroupCount: input.reusedBindGroupCount,
        sections: {
            matrixBufferResource: input.matrixBufferCount > 0 || input.status === "not-required",
            bindGroupLayout: available,
            bindGroupResource: available,
            passSubmission: false,
            shaderSampling: false,
        },
        resource,
        resources,
        diagnostics: input.diagnostics,
    };
}
function deferredDiagnostics() {
    return [
        {
            code: "shadowCasterMatrixBindGroupResource.passSubmissionDeferred",
            severity: "warning",
            message: "Shadow caster matrix bind group is available, but shadow pass submission is deferred.",
        },
        {
            code: "shadowCasterMatrixBindGroupResource.shaderSamplingDeferred",
            severity: "warning",
            message: "Shadow caster matrix bind group is available, but StandardMaterial shadow sampling remains deferred.",
        },
    ];
}
//# sourceMappingURL=shadow-caster-matrix-bind-group-resource.js.map