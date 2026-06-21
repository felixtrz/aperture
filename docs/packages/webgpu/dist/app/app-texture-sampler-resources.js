import { assetHandleKey, } from "@aperture-engine/simulation";
import { WEBGPU_TEXTURE_USAGE_FLAGS, createSamplerGpuResource, createTextureGpuResource, } from "../resources/textures/texture-resources.js";
export function prepareUnlitAppTextureSamplerResources(options) {
    const binding = options.material.baseColorTexture;
    if (binding === null) {
        return emptyPreparedAppTextureSamplerResources();
    }
    const diagnostics = [];
    const textures = [];
    const samplers = [];
    const textureKeys = [];
    const samplerKeys = [];
    if (binding.texture !== null) {
        const texture = prepareAppTextureResource({
            assets: options.assets,
            device: options.device,
            cache: options.cache,
            handle: binding.texture,
            reuse: options.reuse,
            diagnostics,
        });
        if (texture !== null) {
            textures.push(texture.resource);
            textureKeys.push(texture.cacheKey);
        }
    }
    if (binding.sampler !== null) {
        const sampler = prepareAppSamplerResource({
            assets: options.assets,
            device: options.device,
            cache: options.cache,
            handle: binding.sampler,
            reuse: options.reuse,
            diagnostics,
        });
        if (sampler !== null) {
            samplers.push(sampler.resource);
            samplerKeys.push(sampler.cacheKey);
        }
    }
    return {
        valid: diagnostics.length === 0 &&
            binding.texture !== null &&
            binding.sampler !== null &&
            textures.length === 1 &&
            samplers.length === 1,
        textures,
        samplers,
        textureKeys,
        samplerKeys,
        diagnostics,
    };
}
export function prepareMatcapAppTextureSamplerResources(options) {
    const binding = options.material.matcapTexture;
    const diagnostics = [];
    const textures = [];
    const samplers = [];
    const textureKeys = [];
    const samplerKeys = [];
    if (binding === null || binding.texture === null) {
        diagnostics.push({
            code: "webGpuApp.textureSourceNotReady",
            resourceKey: "matcapTexture.texture",
            status: "missing",
            message: "Matcap app rendering requires a ready matcap texture source asset.",
        });
    }
    else {
        const texture = prepareAppTextureResource({
            assets: options.assets,
            device: options.device,
            cache: options.cache,
            handle: binding.texture,
            reuse: options.reuse,
            diagnostics,
        });
        if (texture !== null) {
            textures.push(texture.resource);
            textureKeys.push(texture.cacheKey);
        }
    }
    if (binding === null || binding.sampler === null) {
        diagnostics.push({
            code: "webGpuApp.samplerSourceNotReady",
            resourceKey: "matcapTexture.sampler",
            status: "missing",
            message: "Matcap app rendering requires a ready matcap sampler source asset.",
        });
    }
    else {
        const sampler = prepareAppSamplerResource({
            assets: options.assets,
            device: options.device,
            cache: options.cache,
            handle: binding.sampler,
            reuse: options.reuse,
            diagnostics,
        });
        if (sampler !== null) {
            samplers.push(sampler.resource);
            samplerKeys.push(sampler.cacheKey);
        }
    }
    return {
        valid: diagnostics.length === 0 &&
            textures.length === 1 &&
            samplers.length === 1,
        textures,
        samplers,
        textureKeys,
        samplerKeys,
        diagnostics,
    };
}
export function prepareStandardAppTextureSamplerResources(options) {
    const bindings = [
        options.material.baseColorTexture,
        options.material.metallicRoughnessTexture,
        options.material.clearcoatTexture,
        options.material.clearcoatRoughnessTexture,
        options.material.transmissionTexture,
        options.material.sheenColorTexture,
        options.material.sheenRoughnessTexture,
        options.material.iridescenceTexture,
        options.material.iridescenceThicknessTexture,
        options.material.normalTexture,
        options.material.occlusionTexture,
        options.material.emissiveTexture,
    ].filter((binding) => binding !== null);
    if (bindings.length === 0) {
        return emptyPreparedAppTextureSamplerResources();
    }
    const diagnostics = [];
    const textures = [];
    const samplers = [];
    const textureKeys = [];
    const samplerKeys = [];
    for (const binding of bindings) {
        if (binding.texture !== null) {
            const texture = prepareAppTextureResource({
                assets: options.assets,
                device: options.device,
                cache: options.cache,
                handle: binding.texture,
                reuse: options.reuse,
                diagnostics,
            });
            if (texture !== null) {
                textures.push(texture.resource);
                textureKeys.push(texture.cacheKey);
            }
        }
        if (binding.sampler !== null) {
            const sampler = prepareAppSamplerResource({
                assets: options.assets,
                device: options.device,
                cache: options.cache,
                handle: binding.sampler,
                reuse: options.reuse,
                diagnostics,
            });
            if (sampler !== null) {
                samplers.push(sampler.resource);
                samplerKeys.push(sampler.cacheKey);
            }
        }
    }
    return {
        valid: diagnostics.length === 0 &&
            bindings.every((binding) => binding.texture !== null && binding.sampler !== null) &&
            textures.length === bindings.length &&
            samplers.length === bindings.length,
        textures,
        samplers,
        textureKeys,
        samplerKeys,
        diagnostics,
    };
}
export function emptyPreparedAppTextureSamplerResources() {
    return {
        valid: true,
        textures: [],
        samplers: [],
        textureKeys: [],
        samplerKeys: [],
        diagnostics: [],
    };
}
export function createAppTextureSamplerResourceCacheSummary() {
    return { textureEntries: 0, samplerEntries: 0, totalEntries: 0 };
}
export function writeAppTextureSamplerResourceCacheSummary(summary, cache) {
    summary.textureEntries = cache.textures.size;
    summary.samplerEntries = cache.samplers.size;
    summary.totalEntries = summary.textureEntries + summary.samplerEntries;
    return summary;
}
export function sourceAssetCacheKey(handle, version) {
    return `${assetHandleKey(handle)}@${version}`;
}
export function prepareAppTextureResource(options) {
    const resourceKey = assetHandleKey(options.handle);
    const entry = options.assets.get(options.handle);
    if (entry === undefined || entry.status !== "ready" || entry.asset === null) {
        options.diagnostics.push({
            code: "webGpuApp.textureSourceNotReady",
            resourceKey,
            status: entry?.status ?? "missing",
            message: `Texture source asset '${resourceKey}' is not ready for app rendering.`,
        });
        return null;
    }
    const cacheKey = sourceAssetCacheKey(options.handle, entry.version) +
        (options.viewDescriptorKey === undefined
            ? ""
            : `:${options.viewDescriptorKey}`);
    const cached = options.cache.textures.get(cacheKey);
    if (cached !== undefined) {
        options.reuse.textureResourcesReused += 1;
        return { cacheKey, resource: cached };
    }
    const upload = textureUploadFromAsset(entry.asset);
    const result = createTextureGpuResource({
        device: options.device,
        resourceKey,
        descriptor: textureDescriptorFromAsset(entry.asset),
        ...(upload === null ? {} : { upload }),
        ...(options.viewDescriptor === undefined
            ? {}
            : { viewDescriptor: options.viewDescriptor }),
    });
    options.diagnostics.push(...result.diagnostics);
    if (!result.valid || result.resource === null) {
        return null;
    }
    options.cache.textures.set(cacheKey, result.resource);
    options.reuse.textureResourcesCreated += 1;
    return { cacheKey, resource: result.resource };
}
export function prepareAppSamplerResource(options) {
    const resourceKey = assetHandleKey(options.handle);
    const entry = options.assets.get(options.handle);
    if (entry === undefined || entry.status !== "ready" || entry.asset === null) {
        options.diagnostics.push({
            code: "webGpuApp.samplerSourceNotReady",
            resourceKey,
            status: entry?.status ?? "missing",
            message: `Sampler source asset '${resourceKey}' is not ready for app rendering.`,
        });
        return null;
    }
    const cacheKey = sourceAssetCacheKey(options.handle, entry.version);
    const cached = options.cache.samplers.get(cacheKey);
    if (cached !== undefined) {
        options.reuse.samplerResourcesReused += 1;
        return { cacheKey, resource: cached };
    }
    const result = createSamplerGpuResource({
        device: options.device,
        resourceKey,
        sampler: entry.asset,
    });
    options.diagnostics.push(...result.diagnostics);
    if (!result.valid || result.resource === null) {
        return null;
    }
    options.cache.samplers.set(cacheKey, result.resource);
    options.reuse.samplerResourcesCreated += 1;
    return { cacheKey, resource: result.resource };
}
function textureDescriptorFromAsset(texture) {
    return {
        label: texture.label,
        size: [texture.width, texture.height, texture.depthOrLayers],
        format: texture.format,
        colorSpace: texture.colorSpace,
        semantic: texture.semantic,
        mipLevelCount: texture.mipLevelCount,
        usage: textureUsageFlags(texture.usage),
    };
}
function textureUploadFromAsset(texture) {
    if (texture.sourceData === undefined) {
        return null;
    }
    return {
        data: texture.sourceData.bytes,
        bytesPerRow: texture.sourceData.bytesPerRow,
        ...(texture.sourceData.rowsPerImage === undefined
            ? {}
            : { rowsPerImage: texture.sourceData.rowsPerImage }),
        ...(texture.sourceData.mipLevels === undefined
            ? {}
            : {
                mipLevels: texture.sourceData.mipLevels.map((level) => ({
                    data: level.bytes,
                    bytesPerRow: level.bytesPerRow,
                    ...(level.rowsPerImage === undefined
                        ? {}
                        : { rowsPerImage: level.rowsPerImage }),
                    width: level.width,
                    height: level.height,
                })),
            }),
    };
}
function textureUsageFlags(usages) {
    let flags = 0;
    for (const usage of usages) {
        switch (usage) {
            case "sampled":
                flags |= WEBGPU_TEXTURE_USAGE_FLAGS.TEXTURE_BINDING;
                break;
            case "copy-dst":
                flags |= WEBGPU_TEXTURE_USAGE_FLAGS.COPY_DST;
                break;
            case "render-attachment":
                flags |= WEBGPU_TEXTURE_USAGE_FLAGS.RENDER_ATTACHMENT;
                break;
        }
    }
    return flags === 0 ? WEBGPU_TEXTURE_USAGE_FLAGS.TEXTURE_BINDING : flags;
}
//# sourceMappingURL=app-texture-sampler-resources.js.map