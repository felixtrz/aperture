import { createTextureGpuResource, WEBGPU_TEXTURE_USAGE_FLAGS, } from "../resources/textures/texture-resources.js";
export function createShadowDepthTextureResourceReport(options) {
    const diagnostics = [];
    if (!options.textures.ready) {
        diagnostics.push({
            code: "shadowDepthTextureResource.missingTextureDescriptors",
            severity: "warning",
            message: "Shadow depth texture allocation requires valid shadow texture descriptors.",
        });
        return report({
            status: "missing",
            textureDescriptorCount: options.textures.textureCount,
            textureDescriptorsAvailable: false,
            resources: [],
            diagnostics,
        });
    }
    if (options.textures.textureCount === 0) {
        return report({
            status: "not-required",
            textureDescriptorCount: 0,
            textureDescriptorsAvailable: true,
            resources: [],
            diagnostics,
        });
    }
    const allocationsByTextureKey = new Map();
    let reusedTextureCount = 0;
    const resources = options.textures.textures.map((texture) => {
        let allocation = allocationsByTextureKey.get(texture.textureKey);
        if (allocation === undefined) {
            const cached = reuseShadowDepthTextureAllocation(texture, options.cache);
            if (cached === null) {
                allocation = createShadowDepthTextureAllocation(options.device, texture);
                rememberShadowDepthTextureAllocation(texture, allocation, options.cache);
            }
            else {
                allocation = cached;
                reusedTextureCount += 1;
            }
        }
        allocationsByTextureKey.set(texture.textureKey, allocation);
        return createShadowDepthTextureResource(texture, allocation);
    });
    for (const resource of resources) {
        diagnostics.push(...resource.allocation.diagnostics.map((diagnostic) => ({
            ...diagnostic,
            severity: "warning",
        })));
        if (resource.allocation.valid &&
            resource.attachmentViews.length !== shadowAttachmentLayerCount(resource)) {
            diagnostics.push({
                code: "shadowDepthTextureResource.faceViewCreationFailed",
                severity: "warning",
                resourceKey: resource.resourceKey,
                faceIndex: resource.attachmentViews.length,
                message: `Shadow depth texture '${resource.resourceKey}' could not create all ${shadowAttachmentLayerCount(resource)} render attachment view(s).`,
            });
        }
    }
    return report({
        status: resources.every((resource) => resource.allocation.valid &&
            resource.attachmentViews.length ===
                shadowAttachmentLayerCount(resource))
            ? "available"
            : "missing",
        textureDescriptorCount: options.textures.textureCount,
        textureDescriptorsAvailable: true,
        resources,
        reusedTextureCount,
        diagnostics,
    });
}
export function shadowDepthTextureResourceReportToJsonValue(report) {
    return {
        ready: report.ready,
        status: report.status,
        textureDescriptorCount: report.textureDescriptorCount,
        createdTextureCount: report.createdTextureCount,
        reusedTextureCount: report.reusedTextureCount,
        sections: { ...report.sections },
        resources: report.resources.map((resource) => ({
            valid: resource.allocation.valid,
            shadowId: resource.shadowId,
            lightId: resource.lightId,
            resourceKey: resource.resourceKey,
            textureKey: resource.textureKey,
            viewKey: resource.viewKey,
            layerCount: shadowLayerCount(resource),
            ...(resource.layerBaseIndex === undefined || resource.layerBaseIndex === 0
                ? {}
                : { layerBaseIndex: resource.layerBaseIndex }),
            ...(resource.atlasRegion === undefined
                ? {}
                : { atlasRegion: { ...resource.atlasRegion } }),
            filterRadiusTexels: shadowFilterRadiusTexels(resource),
            faceCount: resource.faceCount,
            viewDimension: resource.viewDimension,
            attachmentViewKeys: resource.attachmentViews.map((view) => view.viewKey),
            descriptor: resource.allocation.resource === null
                ? null
                : {
                    ...resource.allocation.resource.descriptor,
                    size: [...resource.allocation.resource.descriptor.size],
                },
        })),
        diagnostics: report.diagnostics.map((diagnostic) => ({
            code: diagnostic.code,
            severity: "severity" in diagnostic ? diagnostic.severity : "warning",
            message: diagnostic.message,
            ...("resourceKey" in diagnostic && diagnostic.resourceKey !== undefined
                ? { resourceKey: diagnostic.resourceKey }
                : {}),
        })),
    };
}
export function shadowDepthTextureResourceReportToJson(report) {
    return JSON.stringify(shadowDepthTextureResourceReportToJsonValue(report));
}
export function resolveShadowDepthTextureAttachmentView(report, attachment) {
    const resource = report.resources.find((candidate) => candidate.shadowId === attachment.shadowId &&
        candidate.lightId === attachment.lightId);
    const attachmentView = resource?.attachmentViews.find((view) => view.viewKey === attachment.viewKey);
    return attachmentView?.view ?? null;
}
function createShadowDepthTextureAllocation(device, texture) {
    return createTextureGpuResource({
        device,
        resourceKey: texture.textureKey,
        descriptor: {
            label: `${texture.resourceKey}:depth`,
            size: [texture.width, texture.height, shadowTextureLayerCount(texture)],
            format: texture.depthFormat,
            usage: WEBGPU_TEXTURE_USAGE_FLAGS.RENDER_ATTACHMENT |
                WEBGPU_TEXTURE_USAGE_FLAGS.TEXTURE_BINDING,
            mipLevelCount: 1,
        },
        viewDescriptor: texture.viewDimension === "cube"
            ? { dimension: "cube" }
            : texture.viewDimension === "2d-array"
                ? {
                    dimension: "2d-array",
                    arrayLayerCount: shadowTextureLayerCount(texture),
                }
                : undefined,
    });
}
function reuseShadowDepthTextureAllocation(texture, cache) {
    const cached = cache?.get(texture.textureKey);
    if (cached === undefined) {
        return null;
    }
    return cached.descriptorKey === shadowDepthTextureDescriptorKey(texture)
        ? cached.allocation
        : null;
}
function rememberShadowDepthTextureAllocation(texture, allocation, cache) {
    if (cache === undefined ||
        !allocation.valid ||
        allocation.resource === null) {
        return;
    }
    cache.set(texture.textureKey, {
        descriptorKey: shadowDepthTextureDescriptorKey(texture),
        allocation,
    });
}
function shadowDepthTextureDescriptorKey(texture) {
    return [
        texture.textureKey,
        texture.width,
        texture.height,
        shadowTextureLayerCount(texture),
        texture.depthFormat,
        texture.viewDimension,
        texture.faceCount,
        texture.layerCount ?? texture.faceCount,
    ].join(":");
}
function createShadowDepthTextureResource(texture, allocation) {
    return {
        shadowId: texture.shadowId,
        lightId: texture.lightId,
        resourceKey: texture.resourceKey,
        textureKey: texture.textureKey,
        viewKey: texture.viewKey,
        layerCount: shadowTextureLayerCount(texture),
        layerBaseIndex: texture.layerBaseIndex ?? 0,
        attachmentLayerCount: texture.attachmentViewKeys.length,
        ...(texture.atlasRegion === undefined
            ? {}
            : { atlasRegion: { ...texture.atlasRegion } }),
        filterRadiusTexels: texture.filterRadiusTexels ?? shadowTextureDefaultFilterRadius(texture),
        faceCount: texture.faceCount,
        viewDimension: texture.viewDimension,
        attachmentViews: createAttachmentViews(texture, allocation),
        allocation,
    };
}
function createAttachmentViews(texture, allocation) {
    const resource = allocation.resource;
    if (resource === null) {
        return [];
    }
    if (shadowTextureLayerCount(texture) === 1) {
        return [{ faceIndex: 0, viewKey: texture.viewKey, view: resource.view }];
    }
    const textureLike = resource.texture;
    const createView = textureLike.createView;
    if (createView === undefined) {
        return [];
    }
    return texture.attachmentViewKeys.flatMap((viewKey, faceIndex) => {
        const baseArrayLayer = (texture.layerBaseIndex ?? 0) + faceIndex;
        try {
            return [
                {
                    faceIndex,
                    viewKey,
                    view: createView.call(textureLike, {
                        dimension: "2d",
                        baseArrayLayer,
                        arrayLayerCount: 1,
                        mipLevelCount: 1,
                    }),
                },
            ];
        }
        catch {
            return [];
        }
    });
}
function shadowFilterRadiusTexels(resource) {
    return (resource.filterRadiusTexels ?? (resource.viewDimension === "cube" ? 0 : 1));
}
function shadowTextureDefaultFilterRadius(texture) {
    return texture.viewDimension === "cube" ? 0 : 1;
}
function shadowTextureLayerCount(texture) {
    return texture.layerCount ?? texture.faceCount;
}
function shadowLayerCount(resource) {
    return resource.layerCount ?? resource.faceCount;
}
function shadowAttachmentLayerCount(resource) {
    return resource.attachmentLayerCount ?? shadowLayerCount(resource);
}
function report(input) {
    const allocatedTextureCount = new Set(input.resources
        .filter((resource) => resource.allocation.valid)
        .map((resource) => resource.textureKey)).size;
    const reusedTextureCount = input.reusedTextureCount ?? 0;
    const createdTextureCount = Math.max(0, allocatedTextureCount - reusedTextureCount);
    return {
        ready: input.status === "available" || input.status === "not-required",
        status: input.status,
        textureDescriptorCount: input.textureDescriptorCount,
        createdTextureCount,
        reusedTextureCount,
        sections: {
            textureDescriptors: input.textureDescriptorsAvailable,
            depthTextureResource: input.status === "available",
            gpuAllocation: input.status === "available",
            matrixUpload: false,
            passSubmission: false,
            shaderSampling: false,
        },
        resources: input.resources,
        diagnostics: input.diagnostics,
    };
}
//# sourceMappingURL=shadow-depth-texture-resource.js.map