import { prepareAppSamplerResource, prepareAppTextureResource, } from "./app-texture-sampler-resources.js";
export function prepareCustomWgslAppTextureSamplerBindingResources(options) {
    const diagnostics = [];
    const textureSamplerDiagnostics = [];
    const resources = [];
    const textureKeys = [];
    const samplerKeys = [];
    for (const binding of options.source.bindings) {
        const resourceKey = preparedBindingResourceKey(options.material, binding.binding, diagnostics);
        if (resourceKey === null) {
            continue;
        }
        if (binding.kind === "texture") {
            const texture = prepareAppTextureResource({
                assets: options.assets,
                device: options.device,
                cache: options.cache,
                handle: binding.texture,
                reuse: options.reuse,
                diagnostics: textureSamplerDiagnostics,
            });
            if (texture !== null) {
                resources.push({
                    resourceKey,
                    resource: texture.resource.view,
                });
                textureKeys.push(texture.cacheKey);
            }
        }
        if (binding.kind === "sampler") {
            const sampler = prepareAppSamplerResource({
                assets: options.assets,
                device: options.device,
                cache: options.cache,
                handle: binding.sampler,
                reuse: options.reuse,
                diagnostics: textureSamplerDiagnostics,
            });
            if (sampler !== null) {
                resources.push({
                    resourceKey,
                    resource: sampler.resource.sampler,
                });
                samplerKeys.push(sampler.cacheKey);
            }
        }
    }
    const expectedExternalResourceCount = options.source.bindings.filter((binding) => binding.kind === "texture" || binding.kind === "sampler").length;
    return {
        valid: diagnostics.length === 0 &&
            textureSamplerDiagnostics.length === 0 &&
            resources.length === expectedExternalResourceCount,
        resources,
        textureKeys,
        samplerKeys,
        diagnostics: [...diagnostics, ...textureSamplerDiagnostics],
    };
}
function preparedBindingResourceKey(material, binding, diagnostics) {
    const entry = material.bindGroup.entries.find((candidate) => candidate.binding === binding);
    if (entry === undefined) {
        diagnostics.push({
            code: "webGpuApp.customWgslBindingNotPrepared",
            binding,
            message: `Custom WGSL binding ${binding} was not present in the prepared material bind group.`,
        });
        return null;
    }
    return entry.resourceKey;
}
//# sourceMappingURL=custom-wgsl-texture-sampler-resources.js.map