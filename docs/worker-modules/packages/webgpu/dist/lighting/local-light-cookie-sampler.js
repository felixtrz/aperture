import { createSamplerAsset } from "/aperture/worker-modules/packages/render/dist/index.js";
import { createSamplerGpuResource, } from "../resources/textures/texture-resources.js";
export const DEFAULT_COOKIE_SAMPLER_CACHE_KEY = "local-light-cookie:default-sampler@1";
const DEFAULT_COOKIE_SAMPLER_RESOURCE_KEY = "local-light-cookie:default-sampler";
export function prepareDefaultCookieSamplerResource(options) {
    const cached = options.cache.samplers.get(DEFAULT_COOKIE_SAMPLER_CACHE_KEY);
    if (cached !== undefined) {
        options.reuse.samplerResourcesReused += 1;
        return { cacheKey: DEFAULT_COOKIE_SAMPLER_CACHE_KEY, resource: cached };
    }
    const result = createSamplerGpuResource({
        device: options.device,
        resourceKey: DEFAULT_COOKIE_SAMPLER_RESOURCE_KEY,
        sampler: defaultCookieSampler(),
    });
    options.diagnostics.push(...result.diagnostics);
    if (!result.valid || result.resource === null) {
        return null;
    }
    options.cache.samplers.set(DEFAULT_COOKIE_SAMPLER_CACHE_KEY, result.resource);
    options.reuse.samplerResourcesCreated += 1;
    return {
        cacheKey: DEFAULT_COOKIE_SAMPLER_CACHE_KEY,
        resource: result.resource,
    };
}
function defaultCookieSampler() {
    return createSamplerAsset({
        label: "Clustered local-light cookie sampler",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge",
        addressModeW: "clamp-to-edge",
        magFilter: "linear",
        minFilter: "linear",
        mipmapFilter: "linear",
    });
}
//# sourceMappingURL=local-light-cookie-sampler.js.map