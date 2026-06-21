import { readCachedBindGroupResource, writeCachedBindGroupResource, } from "../gpu/bind-group-resource-cache.js";
import { DEFAULT_LIGHT_BIND_GROUP, } from "./light-bind-group-layout.js";
import { STANDARD_AREA_LIGHT_LTC_FRESNEL_BINDING, STANDARD_AREA_LIGHT_LTC_MATRIX_BINDING, STANDARD_AREA_LIGHT_LTC_SAMPLER_BINDING, } from "../materials/standard/standard-area-light-ltc-resource.js";
import { LOCAL_LIGHT_CLUSTER_COOKIE_MATRIX_BINDING, LOCAL_LIGHT_CLUSTER_COOKIE_SAMPLER_BINDING, LOCAL_LIGHT_CLUSTER_COOKIE_TEXTURE_BINDING, } from "./local-light-clusters.js";
export const STANDARD_TRANSMISSION_SCENE_COLOR_TEXTURE_BINDING = 14;
export const STANDARD_TRANSMISSION_SCENE_COLOR_SAMPLER_BINDING = 15;
export function lightBindGroupResourceKey(lightBufferResourceKey, group = DEFAULT_LIGHT_BIND_GROUP, pipelineKey = null) {
    const base = `bind-group:lights/group-${group}/${lightBufferResourceKey}`;
    return pipelineKey === null ? base : `${base}|pipeline:${pipelineKey}`;
}
export function createLightBindGroupDescriptorPlan(options) {
    const group = options.group ?? DEFAULT_LIGHT_BIND_GROUP;
    const label = options.label ?? `lights/group-${group}`;
    const diagnostics = [];
    if (options.layoutKey === null || options.layoutKey.length === 0) {
        diagnostics.push({
            code: "lightBindGroup.missingLayoutKey",
            message: "Light bind group planning requires a layout resource key.",
        });
    }
    if (options.lightGpuBufferResource === null) {
        diagnostics.push({
            code: "lightBindGroup.missingLightGpuBufferResource",
            message: "Light bind group planning requires a light GPU buffer resource.",
        });
    }
    const entries = options.lightGpuBufferResource === null
        ? []
        : [
            {
                binding: 0,
                resourceKey: options.lightGpuBufferResource.floatResourceKey,
                resource: { buffer: options.lightGpuBufferResource.floatBuffer },
            },
            {
                binding: 1,
                resourceKey: options.lightGpuBufferResource.metadataResourceKey,
                resource: {
                    buffer: options.lightGpuBufferResource.metadataBuffer,
                },
            },
        ];
    appendAreaLightLtcEntries(entries, options.areaLightLtcResources ?? null);
    appendTransmissionSceneColorEntries(entries, options.transmissionSceneColorResources ?? null);
    appendLocalLightClusterEntries(entries, options.localLightClusterResources ?? null);
    appendLocalLightCookieEntries(entries, options.localLightCookieResources ?? null);
    const pipelineKey = options.pipelineKey === undefined || options.pipelineKey === null
        ? null
        : options.pipelineKey;
    return {
        valid: diagnostics.length === 0,
        group,
        label,
        resourceKey: options.lightGpuBufferResource === null
            ? null
            : lightBindGroupResourceKey(options.lightGpuBufferResource.resourceKey, group, pipelineKey),
        layoutKey: options.layoutKey,
        ...(pipelineKey === null ? {} : { pipelineKey }),
        entries,
        diagnostics,
    };
}
export function lightBindGroupDescriptorPlanToJsonValue(plan) {
    return {
        valid: plan.valid,
        group: plan.group,
        label: plan.label,
        resourceKey: plan.resourceKey,
        layoutKey: plan.layoutKey,
        ...(plan.pipelineKey === undefined
            ? {}
            : { pipelineKey: plan.pipelineKey }),
        entries: plan.entries.map((entry) => ({
            binding: entry.binding,
            resourceKey: entry.resourceKey,
            resourceKind: lightBindGroupEntryResourceKind(entry),
        })),
        diagnostics: plan.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    };
}
export function lightBindGroupDescriptorPlanToJson(plan) {
    return JSON.stringify(lightBindGroupDescriptorPlanToJsonValue(plan));
}
export function createLightBindGroupResource(options) {
    if (options.plan === null) {
        return {
            valid: false,
            resource: null,
            diagnostics: [
                {
                    code: "lightBindGroupResource.nullDescriptorPlan",
                    message: "Cannot create a light bind group from a null plan.",
                },
            ],
        };
    }
    if (!options.plan.valid || options.plan.resourceKey === null) {
        return {
            valid: false,
            resource: null,
            diagnostics: [
                {
                    code: "lightBindGroupResource.invalidDescriptorPlan",
                    message: "Cannot create a light bind group from an invalid descriptor plan.",
                    ...(options.plan.resourceKey === null
                        ? {}
                        : { resourceKey: options.plan.resourceKey }),
                    ...(options.plan.layoutKey === null
                        ? {}
                        : { layoutKey: options.plan.layoutKey }),
                },
            ],
        };
    }
    if (options.layout === null ||
        options.layout.layoutKey !== options.plan.layoutKey) {
        return {
            valid: false,
            resource: null,
            diagnostics: [
                {
                    code: "lightBindGroupResource.missingLayout",
                    resourceKey: options.plan.resourceKey,
                    ...(options.plan.layoutKey === null
                        ? {}
                        : { layoutKey: options.plan.layoutKey }),
                    message: `Missing light bind group layout resource '${options.plan.layoutKey ?? "null"}'.`,
                },
            ],
        };
    }
    if (options.device.createBindGroup === undefined) {
        return {
            valid: false,
            resource: null,
            diagnostics: [
                {
                    code: "lightBindGroupResource.missingDeviceSupport",
                    resourceKey: options.plan.resourceKey,
                    layoutKey: options.layout.layoutKey,
                    message: "WebGPU device cannot create light bind groups.",
                },
            ],
        };
    }
    const descriptor = {
        label: options.plan.label,
        layout: options.layout.layout,
        entries: options.plan.entries.map((entry) => ({
            binding: entry.binding,
            resource: lightBindGroupCreationResource(entry),
        })),
    };
    const cacheKey = lightBindGroupCacheKey(options.layout.layoutKey, options.plan.resourceKey, options.plan.entries);
    const cached = readCachedBindGroupResource(options.bindGroupCache, cacheKey);
    if (cached !== null) {
        return { valid: true, resource: cached, diagnostics: [] };
    }
    try {
        const resource = {
            group: options.plan.group,
            resourceKey: options.plan.resourceKey,
            layoutKey: options.layout.layoutKey,
            bindGroup: options.device.createBindGroup(descriptor),
            entryResourceKeys: [
                ...options.plan.entries.map((entry) => entry.resourceKey),
                ...(options.plan.pipelineKey === undefined
                    ? []
                    : [options.plan.pipelineKey]),
            ],
        };
        writeCachedBindGroupResource(options.bindGroupCache, cacheKey, resource);
        return {
            valid: true,
            resource,
            diagnostics: [],
        };
    }
    catch (cause) {
        return {
            valid: false,
            resource: null,
            diagnostics: [
                {
                    code: "lightBindGroupResource.creationFailed",
                    resourceKey: options.plan.resourceKey,
                    layoutKey: options.layout.layoutKey,
                    message: `Failed to create light bind group '${options.plan.resourceKey}': ${messageFromCause(cause)}`,
                },
            ],
        };
    }
}
export function createLightBindGroupResourceResultToJsonValue(result) {
    return {
        valid: result.valid,
        resource: result.resource === null
            ? null
            : {
                group: result.resource.group,
                resourceKey: result.resource.resourceKey,
                layoutKey: result.resource.layoutKey,
                entryResourceKeys: [...result.resource.entryResourceKeys],
            },
        counts: {
            bindGroups: result.resource === null ? 0 : 1,
            entries: result.resource?.entryResourceKeys.length ?? 0,
            diagnostics: result.diagnostics.length,
        },
        diagnostics: result.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    };
}
export function createLightBindGroupResourceResultToJson(result) {
    return JSON.stringify(createLightBindGroupResourceResultToJsonValue(result));
}
function lightBindGroupCacheKey(layoutKey, resourceKey, entries) {
    return `${layoutKey}|${resourceKey}|${entries
        .map((entry) => `${entry.binding}:${entry.resourceKey}`)
        .join("/")}`;
}
function appendAreaLightLtcEntries(entries, resources) {
    if (resources === null) {
        return;
    }
    entries.push({
        binding: STANDARD_AREA_LIGHT_LTC_MATRIX_BINDING,
        resourceKey: resources.matrixTexture.resourceKey,
        resource: { textureView: resources.matrixTexture.view },
    }, {
        binding: STANDARD_AREA_LIGHT_LTC_FRESNEL_BINDING,
        resourceKey: resources.fresnelTexture.resourceKey,
        resource: { textureView: resources.fresnelTexture.view },
    }, {
        binding: STANDARD_AREA_LIGHT_LTC_SAMPLER_BINDING,
        resourceKey: resources.sampler.resourceKey,
        resource: { sampler: resources.sampler.sampler },
    });
}
function appendTransmissionSceneColorEntries(entries, resources) {
    if (resources === null) {
        return;
    }
    entries.push({
        binding: STANDARD_TRANSMISSION_SCENE_COLOR_TEXTURE_BINDING,
        resourceKey: resources.texture.resourceKey,
        resource: { textureView: resources.texture.view },
    }, {
        binding: STANDARD_TRANSMISSION_SCENE_COLOR_SAMPLER_BINDING,
        resourceKey: resources.sampler.resourceKey,
        resource: { sampler: resources.sampler.sampler },
    });
}
function appendLocalLightClusterEntries(entries, resources) {
    if (resources === null) {
        return;
    }
    entries.push({
        binding: 16,
        resourceKey: resources.paramsResourceKey,
        resource: { buffer: resources.paramsBuffer },
    }, {
        binding: 17,
        resourceKey: resources.cellsResourceKey,
        resource: { buffer: resources.cellsBuffer },
    }, {
        binding: 18,
        resourceKey: resources.indicesResourceKey,
        resource: { buffer: resources.indicesBuffer },
    }, {
        binding: 19,
        resourceKey: resources.metadataResourceKey,
        resource: { buffer: resources.metadataBuffer },
    });
}
function appendLocalLightCookieEntries(entries, resources) {
    if (resources === null) {
        return;
    }
    entries.push({
        binding: LOCAL_LIGHT_CLUSTER_COOKIE_TEXTURE_BINDING,
        resourceKey: resources.textureResource.resourceKey,
        resource: { textureView: resources.textureResource.view },
    }, {
        binding: LOCAL_LIGHT_CLUSTER_COOKIE_SAMPLER_BINDING,
        resourceKey: resources.samplerResource.resourceKey,
        resource: { sampler: resources.samplerResource.sampler },
    }, {
        binding: LOCAL_LIGHT_CLUSTER_COOKIE_MATRIX_BINDING,
        resourceKey: resources.matrixResource.resourceKey,
        resource: { buffer: resources.matrixResource.buffer },
    });
}
function lightBindGroupEntryResourceKind(entry) {
    if ("buffer" in entry.resource) {
        return "buffer";
    }
    if ("textureView" in entry.resource) {
        return "texture-view";
    }
    return "sampler";
}
function lightBindGroupCreationResource(entry) {
    if ("textureView" in entry.resource) {
        return entry.resource.textureView;
    }
    if ("sampler" in entry.resource) {
        return entry.resource.sampler;
    }
    return entry.resource;
}
function messageFromCause(cause) {
    return cause instanceof Error ? cause.message : String(cause);
}
//# sourceMappingURL=light-bind-group.js.map