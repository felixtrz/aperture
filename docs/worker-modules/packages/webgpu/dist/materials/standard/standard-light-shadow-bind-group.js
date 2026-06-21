import { readCachedBindGroupResource, writeCachedBindGroupResource, } from "../../gpu/bind-group-resource-cache.js";
import { STANDARD_LIGHT_CASCADED_SHADOW_BIND_GROUP_LAYOUT_KEY, STANDARD_LIGHT_CASCADED_SHADOW_IBL_BIND_GROUP_LAYOUT_KEY, STANDARD_LIGHT_IBL_BIND_GROUP_LAYOUT_KEY, STANDARD_LIGHT_MULTI_SHADOW_BIND_GROUP_LAYOUT_KEY, STANDARD_LIGHT_SHADOW_BIND_GROUP, STANDARD_LIGHT_SHADOW_BIND_GROUP_LAYOUT_KEY, STANDARD_LIGHT_SHADOW_IBL_BIND_GROUP_LAYOUT_KEY, } from "./standard-light-shadow-bind-group-constants.js";
import { appendAreaLightLtcEntries, appendLocalLightClusterEntries, appendLocalLightCookieEntries, appendShadowEntries, } from "./standard-light-shadow-bind-group-entries.js";
import { createStandardLightCascadedShadowBindGroupLayoutDescriptor, createStandardLightShadowBindGroupLayoutDescriptor, } from "./standard-light-shadow-bind-group-layouts.js";
export { STANDARD_LIGHT_CASCADED_SHADOW_BIND_GROUP_LAYOUT_KEY, STANDARD_LIGHT_CASCADED_SHADOW_IBL_BIND_GROUP_LAYOUT_KEY, STANDARD_LIGHT_IBL_BIND_GROUP_LAYOUT_KEY, STANDARD_LIGHT_MULTI_SHADOW_BIND_GROUP_LAYOUT_KEY, STANDARD_LIGHT_POINT_SHADOW_BIND_GROUP_LAYOUT_KEY, STANDARD_LIGHT_SHADOW_BIND_GROUP, STANDARD_LIGHT_SHADOW_BIND_GROUP_LAYOUT_KEY, STANDARD_LIGHT_SHADOW_IBL_BIND_GROUP_LAYOUT_KEY, } from "./standard-light-shadow-bind-group-constants.js";
export { createStandardLightCascadedShadowBindGroupLayoutDescriptor, createStandardLightIblBindGroupLayoutDescriptor, createStandardLightMultiShadowBindGroupLayoutDescriptor, createStandardLightPointShadowBindGroupLayoutDescriptor, createStandardLightShadowBindGroupLayoutDescriptor, } from "./standard-light-shadow-bind-group-layouts.js";
export function createStandardLightShadowBindGroupLayoutResource(createBindGroupLayout, layoutKey = STANDARD_LIGHT_SHADOW_BIND_GROUP_LAYOUT_KEY) {
    const descriptor = layoutKey === STANDARD_LIGHT_CASCADED_SHADOW_BIND_GROUP_LAYOUT_KEY
        ? createStandardLightCascadedShadowBindGroupLayoutDescriptor()
        : createStandardLightShadowBindGroupLayoutDescriptor();
    return {
        group: STANDARD_LIGHT_SHADOW_BIND_GROUP,
        layoutKey,
        layout: createBindGroupLayout(descriptor),
        descriptor,
    };
}
export function createStandardLightShadowBindGroupDescriptorPlan(options) {
    const layoutKey = options.layoutKey ?? STANDARD_LIGHT_SHADOW_BIND_GROUP_LAYOUT_KEY;
    const label = options.label ?? STANDARD_LIGHT_SHADOW_BIND_GROUP_LAYOUT_KEY;
    const diagnostics = [];
    const entries = [];
    if (layoutKey === null || layoutKey.length === 0) {
        diagnostics.push({
            code: "standardLightShadowBindGroup.missingLayoutKey",
            message: "StandardMaterial light/shadow bind-group planning requires a layout key.",
        });
    }
    if (options.lightGpuBufferResource === null) {
        diagnostics.push({
            code: "standardLightShadowBindGroup.missingLightGpuBufferResource",
            message: "StandardMaterial light/shadow bind-group planning requires light GPU buffers.",
        });
    }
    else {
        entries.push({
            binding: 0,
            resourceKey: options.lightGpuBufferResource.floatResourceKey,
            resourceKind: "buffer",
        }, {
            binding: 1,
            resourceKey: options.lightGpuBufferResource.metadataResourceKey,
            resourceKind: "buffer",
        });
    }
    if (options.matrixBufferResource.resource === null) {
        diagnostics.push({
            code: "standardLightShadowBindGroup.missingMatrixBufferResource",
            message: "StandardMaterial light/shadow bind-group planning requires a shadow matrix buffer.",
        });
    }
    else {
        entries.push({
            binding: 2,
            resourceKey: options.matrixBufferResource.resource.resourceKey,
            resourceKind: "buffer",
        });
    }
    const depthResource = options.depthTextureResources.resources.find((resource) => resource.allocation.resource !== null);
    if (depthResource === undefined) {
        diagnostics.push({
            code: "standardLightShadowBindGroup.missingDepthTextureResource",
            message: "StandardMaterial light/shadow bind-group planning requires a shadow depth texture view.",
        });
    }
    else {
        entries.push({
            binding: 3,
            resourceKey: depthResource.textureKey,
            resourceKind: "texture-view",
        });
    }
    if (options.samplerResource.resource === null) {
        diagnostics.push({
            code: "standardLightShadowBindGroup.missingSamplerResource",
            message: "StandardMaterial light/shadow bind-group planning requires a shadow comparison sampler.",
        });
    }
    else {
        entries.push({
            binding: 4,
            resourceKey: options.samplerResource.resource.resourceKey,
            resourceKind: "sampler",
        });
    }
    appendAreaLightLtcEntries(entries, options.areaLightLtcResources ?? null);
    appendLocalLightClusterEntries(entries, options.localLightClusterResources ?? null);
    appendLocalLightCookieEntries(entries, options.localLightCookieResources ?? null, options.reuseShadowMatricesForLocalLightCookies !== true);
    return {
        valid: diagnostics.length === 0,
        group: STANDARD_LIGHT_SHADOW_BIND_GROUP,
        label,
        resourceKey: diagnostics.length === 0 && layoutKey !== null
            ? standardLightShadowBindGroupResourceKey(entries, layoutKey)
            : null,
        layoutKey,
        entries,
        diagnostics,
    };
}
export function createStandardLightMultiShadowBindGroupDescriptorPlan(options) {
    const layoutKey = options.layoutKey ?? STANDARD_LIGHT_MULTI_SHADOW_BIND_GROUP_LAYOUT_KEY;
    const label = options.label ?? STANDARD_LIGHT_MULTI_SHADOW_BIND_GROUP_LAYOUT_KEY;
    const diagnostics = [];
    const entries = [];
    if (layoutKey === null || layoutKey.length === 0) {
        diagnostics.push({
            code: "standardLightShadowBindGroup.missingLayoutKey",
            message: "StandardMaterial multi-shadow bind-group planning requires a layout key.",
        });
    }
    if (options.lightGpuBufferResource === null) {
        diagnostics.push({
            code: "standardLightShadowBindGroup.missingLightGpuBufferResource",
            message: "StandardMaterial multi-shadow bind-group planning requires light GPU buffers.",
        });
    }
    else {
        entries.push({
            binding: 0,
            resourceKey: options.lightGpuBufferResource.floatResourceKey,
            resourceKind: "buffer",
        }, {
            binding: 1,
            resourceKey: options.lightGpuBufferResource.metadataResourceKey,
            resourceKind: "buffer",
        });
    }
    appendShadowEntries(options.directionalShadowReceiverResources, entries, diagnostics, { matrix: 2, depth: 3, sampler: 4 });
    if (options.localLightClusterResources === undefined ||
        options.localLightClusterResources === null) {
        appendShadowEntries(options.spotShadowReceiverResources, entries, diagnostics, { matrix: 5, depth: 6, sampler: 7 });
    }
    appendShadowEntries(options.pointShadowReceiverResources, entries, diagnostics, { matrix: 8, depth: 9, sampler: 10 });
    appendAreaLightLtcEntries(entries, options.areaLightLtcResources ?? null);
    appendLocalLightClusterEntries(entries, options.localLightClusterResources ?? null);
    appendLocalLightCookieEntries(entries, options.localLightCookieResources ?? null, options.reuseShadowMatricesForLocalLightCookies !== true);
    return {
        valid: diagnostics.length === 0,
        group: STANDARD_LIGHT_SHADOW_BIND_GROUP,
        label,
        resourceKey: diagnostics.length === 0 && layoutKey !== null
            ? standardLightShadowBindGroupResourceKey(entries, layoutKey)
            : null,
        layoutKey,
        entries,
        diagnostics,
    };
}
export function createStandardLightIblBindGroupDescriptorPlan(options) {
    const shadowMap = options.shadowRequired === true;
    const layoutKey = options.layoutKey ??
        (shadowMap
            ? options.cascadedShadowMap === true
                ? STANDARD_LIGHT_CASCADED_SHADOW_IBL_BIND_GROUP_LAYOUT_KEY
                : STANDARD_LIGHT_SHADOW_IBL_BIND_GROUP_LAYOUT_KEY
            : STANDARD_LIGHT_IBL_BIND_GROUP_LAYOUT_KEY);
    const label = options.label ??
        (shadowMap
            ? options.cascadedShadowMap === true
                ? STANDARD_LIGHT_CASCADED_SHADOW_IBL_BIND_GROUP_LAYOUT_KEY
                : STANDARD_LIGHT_SHADOW_IBL_BIND_GROUP_LAYOUT_KEY
            : STANDARD_LIGHT_IBL_BIND_GROUP_LAYOUT_KEY);
    const diagnostics = [];
    const entries = [];
    if (layoutKey === null || layoutKey.length === 0) {
        diagnostics.push({
            code: "standardLightShadowBindGroup.missingLayoutKey",
            message: "StandardMaterial light/IBL bind-group planning requires a layout key.",
        });
    }
    if (options.lightGpuBufferResource === null) {
        diagnostics.push({
            code: "standardLightShadowBindGroup.missingLightGpuBufferResource",
            message: "StandardMaterial light/IBL bind-group planning requires light GPU buffers.",
        });
    }
    else {
        entries.push({
            binding: 0,
            resourceKey: options.lightGpuBufferResource.floatResourceKey,
            resourceKind: "buffer",
        }, {
            binding: 1,
            resourceKey: options.lightGpuBufferResource.metadataResourceKey,
            resourceKind: "buffer",
        });
    }
    if (shadowMap) {
        const shadowResources = options.shadowReceiverResources;
        if (shadowResources === undefined) {
            diagnostics.push({
                code: "standardLightShadowBindGroup.missingMatrixBufferResource",
                message: "StandardMaterial light/shadow/IBL bind-group planning requires a shadow matrix buffer.",
            }, {
                code: "standardLightShadowBindGroup.missingDepthTextureResource",
                message: "StandardMaterial light/shadow/IBL bind-group planning requires a shadow depth texture view.",
            }, {
                code: "standardLightShadowBindGroup.missingSamplerResource",
                message: "StandardMaterial light/shadow/IBL bind-group planning requires a shadow comparison sampler.",
            });
        }
        else {
            appendShadowEntries(shadowResources, entries, diagnostics);
        }
    }
    const diffuseResource = options.diffuseTextureResource.resources.find((resource) => resource.valid && resource.resource !== null)?.resource ?? null;
    if (diffuseResource === null) {
        diagnostics.push({
            code: "standardLightShadowBindGroup.missingDiffuseIblTextureResource",
            message: "StandardMaterial light/IBL bind-group planning requires a diffuse IBL texture view.",
        });
    }
    else {
        entries.push({
            binding: 5,
            resourceKey: diffuseResource.resourceKey,
            resourceKind: "texture-view",
        });
    }
    const samplerResource = options.samplerResource.resources.find((resource) => resource.valid && resource.resource !== null)?.resource ?? null;
    if (samplerResource === null) {
        diagnostics.push({
            code: "standardLightShadowBindGroup.missingIblSamplerResource",
            message: "StandardMaterial light/IBL bind-group planning requires an IBL sampler.",
        });
    }
    else {
        entries.push({
            binding: 6,
            resourceKey: samplerResource.resourceKey,
            resourceKind: "sampler",
        });
    }
    if (options.specularTextureResource !== undefined) {
        const specularResource = options.specularTextureResource.resources.find((resource) => resource.valid && resource.resource !== null)?.resource ?? null;
        if (specularResource === null) {
            diagnostics.push({
                code: "standardLightShadowBindGroup.missingDiffuseIblTextureResource",
                message: "StandardMaterial light/IBL bind-group planning requires a specular IBL proof texture view.",
            });
        }
        else {
            entries.push({
                binding: 7,
                resourceKey: specularResource.resourceKey,
                resourceKind: "texture-view",
            });
        }
    }
    appendAreaLightLtcEntries(entries, options.areaLightLtcResources ?? null);
    appendLocalLightClusterEntries(entries, options.localLightClusterResources ?? null);
    appendLocalLightCookieEntries(entries, options.localLightCookieResources ?? null, options.reuseShadowMatricesForLocalLightCookies !== true);
    return {
        valid: diagnostics.length === 0,
        group: STANDARD_LIGHT_SHADOW_BIND_GROUP,
        label,
        resourceKey: diagnostics.length === 0 && layoutKey !== null
            ? standardLightShadowBindGroupResourceKey(entries, layoutKey)
            : null,
        layoutKey,
        entries,
        diagnostics,
    };
}
export function createStandardLightShadowBindGroupResource(options) {
    if (options.plan === null) {
        return resourceResult("standardLightShadowBindGroupResource.nullDescriptorPlan");
    }
    if (!options.plan.valid || options.plan.resourceKey === null) {
        return resourceResult("standardLightShadowBindGroupResource.invalidDescriptorPlan", options.plan.resourceKey ?? undefined, options.plan.layoutKey ?? undefined);
    }
    if (options.layout === null ||
        options.layout.layoutKey !== options.plan.layoutKey) {
        return resourceResult("standardLightShadowBindGroupResource.missingLayout", options.plan.resourceKey, options.plan.layoutKey ?? undefined);
    }
    if (options.device.createBindGroup === undefined) {
        return resourceResult("standardLightShadowBindGroupResource.missingDeviceSupport", options.plan.resourceKey, options.layout.layoutKey);
    }
    const entries = createCreationEntries(options.plan, options);
    if (entries.length !== options.plan.entries.length) {
        return resourceResult("standardLightShadowBindGroupResource.invalidDescriptorPlan", options.plan.resourceKey, options.plan.layoutKey ?? undefined);
    }
    try {
        const cacheKey = standardLightShadowBindGroupCacheKey(options.layout.layoutKey, options.plan.resourceKey);
        const cached = readCachedBindGroupResource(options.bindGroupCache, cacheKey);
        if (cached !== null) {
            return { valid: true, resource: cached, diagnostics: [] };
        }
        const resource = {
            group: STANDARD_LIGHT_SHADOW_BIND_GROUP,
            resourceKey: options.plan.resourceKey,
            layoutKey: options.layout.layoutKey,
            bindGroup: options.device.createBindGroup({
                label: options.plan.label,
                layout: options.layout.layout,
                entries,
            }),
            entryResourceKeys: options.plan.entries.map((entry) => entry.resourceKey),
        };
        writeCachedBindGroupResource(options.bindGroupCache, cacheKey, resource);
        return { valid: true, resource, diagnostics: [] };
    }
    catch (cause) {
        return {
            valid: false,
            resource: null,
            diagnostics: [
                {
                    code: "standardLightShadowBindGroupResource.creationFailed",
                    resourceKey: options.plan.resourceKey,
                    layoutKey: options.layout.layoutKey,
                    message: `Failed to create StandardMaterial light/shadow bind group '${options.plan.resourceKey}': ${messageFromCause(cause)}`,
                },
            ],
        };
    }
}
function standardLightShadowBindGroupCacheKey(layoutKey, resourceKey) {
    return `${layoutKey}|${resourceKey}`;
}
function standardLightShadowBindGroupResourceKey(entries, layoutKey = STANDARD_LIGHT_SHADOW_BIND_GROUP_LAYOUT_KEY) {
    return `bind-group:${layoutKey}/${entries
        .map((entry) => `${entry.binding}:${entry.resourceKey}`)
        .join("/")}`;
}
function createCreationEntries(plan, resources) {
    const buffers = new Map();
    const textures = new Map();
    const samplers = new Map();
    if (resources.lightGpuBufferResource !== null) {
        buffers.set(resources.lightGpuBufferResource.floatResourceKey, resources.lightGpuBufferResource.floatBuffer);
        buffers.set(resources.lightGpuBufferResource.metadataResourceKey, resources.lightGpuBufferResource.metadataBuffer);
    }
    if (resources.matrixBufferResource.resource !== null) {
        buffers.set(resources.matrixBufferResource.resource.resourceKey, resources.matrixBufferResource.resource.buffer);
    }
    for (const resource of resources.depthTextureResources.resources) {
        if (resource.allocation.resource !== null) {
            textures.set(resource.textureKey, resource.allocation.resource.view);
        }
    }
    if (resources.samplerResource.resource !== null) {
        samplers.set(resources.samplerResource.resource.resourceKey, resources.samplerResource.resource.sampler);
    }
    for (const shadowResources of resources.additionalShadowReceiverResources ??
        []) {
        if (shadowResources.matrixBufferResource.resource !== null) {
            buffers.set(shadowResources.matrixBufferResource.resource.resourceKey, shadowResources.matrixBufferResource.resource.buffer);
        }
        for (const resource of shadowResources.depthTextureResources.resources) {
            if (resource.allocation.resource !== null) {
                textures.set(resource.textureKey, resource.allocation.resource.view);
            }
        }
        if (shadowResources.samplerResource.resource !== null) {
            samplers.set(shadowResources.samplerResource.resource.resourceKey, shadowResources.samplerResource.resource.sampler);
        }
    }
    for (const resource of resources.diffuseTextureResource?.resources ?? []) {
        if (resource.valid && resource.resource !== null) {
            textures.set(resource.resource.resourceKey, resource.resource.view);
        }
    }
    for (const resource of resources.specularTextureResource?.resources ?? []) {
        if (resource.valid && resource.resource !== null) {
            textures.set(resource.resource.resourceKey, resource.resource.view);
        }
    }
    for (const resource of resources.iblSamplerResource?.resources ?? []) {
        if (resource.valid && resource.resource !== null) {
            samplers.set(resource.resource.resourceKey, resource.resource.sampler);
        }
    }
    if (resources.areaLightLtcResources !== undefined &&
        resources.areaLightLtcResources !== null) {
        textures.set(resources.areaLightLtcResources.matrixTexture.resourceKey, resources.areaLightLtcResources.matrixTexture.view);
        textures.set(resources.areaLightLtcResources.fresnelTexture.resourceKey, resources.areaLightLtcResources.fresnelTexture.view);
        samplers.set(resources.areaLightLtcResources.sampler.resourceKey, resources.areaLightLtcResources.sampler.sampler);
    }
    if (resources.localLightClusterResources !== undefined &&
        resources.localLightClusterResources !== null) {
        buffers.set(resources.localLightClusterResources.paramsResourceKey, resources.localLightClusterResources.paramsBuffer);
        buffers.set(resources.localLightClusterResources.cellsResourceKey, resources.localLightClusterResources.cellsBuffer);
        buffers.set(resources.localLightClusterResources.indicesResourceKey, resources.localLightClusterResources.indicesBuffer);
        buffers.set(resources.localLightClusterResources.metadataResourceKey, resources.localLightClusterResources.metadataBuffer);
    }
    if (resources.localLightCookieResources !== undefined &&
        resources.localLightCookieResources !== null) {
        buffers.set(resources.localLightCookieResources.matrixResource.resourceKey, resources.localLightCookieResources.matrixResource.buffer);
        textures.set(resources.localLightCookieResources.textureResource.resourceKey, resources.localLightCookieResources.textureResource.view);
        samplers.set(resources.localLightCookieResources.samplerResource.resourceKey, resources.localLightCookieResources.samplerResource.sampler);
    }
    return plan.entries.flatMap((entry) => {
        if (entry.resourceKind === "texture-view") {
            const texture = textures.get(entry.resourceKey);
            return texture === undefined
                ? []
                : [{ binding: entry.binding, resource: texture }];
        }
        if (entry.resourceKind === "sampler") {
            const sampler = samplers.get(entry.resourceKey);
            return sampler === undefined
                ? []
                : [{ binding: entry.binding, resource: sampler }];
        }
        const buffer = buffers.get(entry.resourceKey);
        return buffer === undefined
            ? []
            : [{ binding: entry.binding, resource: { buffer } }];
    });
}
function resourceResult(code, resourceKey, layoutKey) {
    return {
        valid: false,
        resource: null,
        diagnostics: [
            {
                code,
                ...(resourceKey === undefined ? {} : { resourceKey }),
                ...(layoutKey === undefined ? {} : { layoutKey }),
                message: standardLightShadowResourceMessage(code),
            },
        ],
    };
}
function standardLightShadowResourceMessage(code) {
    switch (code) {
        case "standardLightShadowBindGroupResource.nullDescriptorPlan":
            return "Cannot create a StandardMaterial light/shadow bind group from a null plan.";
        case "standardLightShadowBindGroupResource.invalidDescriptorPlan":
            return "Cannot create a StandardMaterial light/shadow bind group from an invalid descriptor plan.";
        case "standardLightShadowBindGroupResource.missingLayout":
            return "Missing StandardMaterial light/shadow bind-group layout resource.";
        case "standardLightShadowBindGroupResource.missingDeviceSupport":
            return "WebGPU device cannot create StandardMaterial light/shadow bind groups.";
        default:
            return "StandardMaterial light/shadow bind-group resource creation failed.";
    }
}
function messageFromCause(cause) {
    return cause instanceof Error ? cause.message : String(cause);
}
//# sourceMappingURL=standard-light-shadow-bind-group.js.map