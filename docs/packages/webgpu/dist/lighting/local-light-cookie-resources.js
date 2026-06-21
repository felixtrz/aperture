import { assetHandleKey } from "@aperture-engine/simulation";
import { prepareAppSamplerResource, prepareAppTextureResource, } from "../app/app-texture-sampler-resources.js";
import { collectCookieArrayCandidates, collectCookieAtlasCandidates, collectShadowAlignedCookieAtlasCandidates, } from "./local-light-cookie-candidates.js";
import { prepareCookieAtlasMatrixResource, prepareCookieMatrixArrayResource, prepareCookieMatrixResource, } from "./local-light-cookie-matrices.js";
import { prepareDefaultCookieSamplerResource } from "./local-light-cookie-sampler.js";
import { prepareCookieTextureArrayResource, prepareCookieTextureAtlasResource, } from "./local-light-cookie-textures.js";
export function prepareLocalLightClusterCookieResources(options) {
    const diagnostics = [];
    const textureSamplerDiagnostics = [];
    const arrayCandidates = collectCookieArrayCandidates(options);
    const baseAtlasCandidates = collectCookieAtlasCandidates(options);
    const shadowAlignedAtlasCandidates = collectShadowAlignedCookieAtlasCandidates(baseAtlasCandidates, options.shadowReceiverResources);
    const atlasCandidates = shadowAlignedAtlasCandidates.length > 1
        ? shadowAlignedAtlasCandidates
        : baseAtlasCandidates;
    if (atlasCandidates.length > 1 &&
        atlasCandidates.length > arrayCandidates.length) {
        const matrixResource = prepareCookieAtlasMatrixResource({
            device: options.device,
            candidates: atlasCandidates,
            snapshot: options.snapshot,
            ...(options.matrixCache === undefined
                ? {}
                : { cache: options.matrixCache }),
            diagnostics,
        });
        if (matrixResource === null) {
            return {
                valid: diagnostics.length === 0,
                resources: null,
                diagnostics,
            };
        }
        const texture = prepareCookieTextureAtlasResource({
            ...options,
            candidates: atlasCandidates,
            diagnostics,
        });
        if (texture === null) {
            return { valid: false, resources: null, diagnostics };
        }
        const firstCandidate = atlasCandidates[0];
        if (firstCandidate === undefined) {
            return { valid: false, resources: null, diagnostics };
        }
        const sampler = firstCandidate.light.cookieSampler === undefined ||
            firstCandidate.light.cookieSampler === null
            ? prepareDefaultCookieSamplerResource({
                ...options,
                diagnostics,
            })
            : prepareAppSamplerResource({
                assets: options.assets,
                device: options.device,
                cache: options.cache,
                handle: firstCandidate.light.cookieSampler,
                reuse: options.reuse,
                diagnostics: textureSamplerDiagnostics,
            });
        diagnostics.push(...textureSamplerDiagnostics.splice(0));
        if (sampler === null) {
            return { valid: false, resources: null, diagnostics };
        }
        return {
            valid: diagnostics.length === 0,
            resources: {
                matrixResource,
                textureResource: texture.resource,
                samplerResource: sampler.resource,
                textureViewDimension: "2d",
                textureLayout: "atlas",
                shadowMatrixCompatible: atlasCandidates.every((candidate) => candidate.shadowMatrixCompatible === true),
                atlasUpdate: texture.atlasUpdate,
                textureKey: texture.cacheKey,
                samplerKey: sampler.cacheKey,
                supportedResources: atlasCandidates.map((candidate) => ({
                    lightId: candidate.light.lightId,
                    textureKey: texture.cacheKey,
                    samplerKey: sampler.cacheKey,
                    textureViewDimension: "2d",
                    matrixBaseIndex: candidate.matrixBaseIndex,
                })),
            },
            diagnostics,
        };
    }
    if (arrayCandidates.length > 1) {
        const matrixResource = prepareCookieMatrixArrayResource({
            device: options.device,
            candidates: arrayCandidates,
            snapshot: options.snapshot,
            ...(options.matrixCache === undefined
                ? {}
                : { cache: options.matrixCache }),
            diagnostics,
        });
        if (matrixResource === null) {
            return {
                valid: diagnostics.length === 0,
                resources: null,
                diagnostics,
            };
        }
        const texture = prepareCookieTextureArrayResource({
            ...options,
            candidates: arrayCandidates,
            diagnostics,
        });
        if (texture === null) {
            return { valid: false, resources: null, diagnostics };
        }
        const firstCandidate = arrayCandidates[0];
        if (firstCandidate === undefined) {
            return { valid: false, resources: null, diagnostics };
        }
        const sampler = firstCandidate.light.cookieSampler === undefined ||
            firstCandidate.light.cookieSampler === null
            ? prepareDefaultCookieSamplerResource({
                ...options,
                diagnostics,
            })
            : prepareAppSamplerResource({
                assets: options.assets,
                device: options.device,
                cache: options.cache,
                handle: firstCandidate.light.cookieSampler,
                reuse: options.reuse,
                diagnostics: textureSamplerDiagnostics,
            });
        diagnostics.push(...textureSamplerDiagnostics.splice(0));
        if (sampler === null) {
            return { valid: false, resources: null, diagnostics };
        }
        return {
            valid: diagnostics.length === 0,
            resources: {
                matrixResource,
                textureResource: texture.resource,
                samplerResource: sampler.resource,
                textureViewDimension: "2d-array",
                textureLayout: "array",
                shadowMatrixCompatible: false,
                textureKey: texture.cacheKey,
                samplerKey: sampler.cacheKey,
                supportedResources: arrayCandidates.map((candidate) => ({
                    lightId: candidate.light.lightId,
                    textureKey: texture.cacheKey,
                    samplerKey: sampler.cacheKey,
                    textureViewDimension: "2d-array",
                    matrixBaseIndex: candidate.layerBaseIndex,
                })),
            },
            diagnostics,
        };
    }
    for (const light of options.snapshot.lights) {
        if ((light.kind !== "point" && light.kind !== "spot") ||
            light.cookieTexture === undefined ||
            light.cookieTexture === null) {
            continue;
        }
        const textureViewDimension = cookieTextureViewDimensionForLight(light);
        const matrixResource = prepareCookieMatrixResource({
            device: options.device,
            snapshot: options.snapshot,
            light,
            ...(options.matrixCache === undefined
                ? {}
                : { cache: options.matrixCache }),
            diagnostics,
        });
        if (matrixResource === null) {
            return {
                valid: diagnostics.length === 0,
                resources: null,
                diagnostics,
            };
        }
        const textureEntry = options.assets.get(light.cookieTexture);
        const textureKey = assetHandleKey(light.cookieTexture);
        const textureDiagnostic = validateCookieTextureAsset(textureKey, textureEntry?.status === "ready" ? textureEntry.asset : null, textureViewDimension);
        if (textureDiagnostic !== null) {
            diagnostics.push({
                code: textureDiagnostic.code,
                resourceKey: textureKey,
                message: textureDiagnostic.message,
            });
            return { valid: false, resources: null, diagnostics };
        }
        const texture = prepareAppTextureResource({
            assets: options.assets,
            device: options.device,
            cache: options.cache,
            handle: light.cookieTexture,
            reuse: options.reuse,
            diagnostics: textureSamplerDiagnostics,
            ...(textureViewDimension === "cube"
                ? {
                    viewDescriptor: { dimension: "cube" },
                    viewDescriptorKey: "cube",
                }
                : {}),
        });
        diagnostics.push(...textureSamplerDiagnostics.splice(0));
        if (texture === null) {
            return { valid: false, resources: null, diagnostics };
        }
        const sampler = light.cookieSampler === undefined || light.cookieSampler === null
            ? prepareDefaultCookieSamplerResource({
                ...options,
                diagnostics,
            })
            : prepareAppSamplerResource({
                assets: options.assets,
                device: options.device,
                cache: options.cache,
                handle: light.cookieSampler,
                reuse: options.reuse,
                diagnostics: textureSamplerDiagnostics,
            });
        diagnostics.push(...textureSamplerDiagnostics.splice(0));
        if (sampler === null) {
            return { valid: false, resources: null, diagnostics };
        }
        return {
            valid: diagnostics.length === 0,
            resources: {
                matrixResource,
                textureResource: texture.resource,
                samplerResource: sampler.resource,
                textureViewDimension,
                textureLayout: "single",
                shadowMatrixCompatible: false,
                textureKey: texture.cacheKey,
                samplerKey: sampler.cacheKey,
                supportedResources: [
                    {
                        lightId: light.lightId,
                        textureKey: texture.cacheKey,
                        samplerKey: sampler.cacheKey,
                        textureViewDimension,
                        matrixBaseIndex: 0,
                    },
                ],
            },
            diagnostics,
        };
    }
    return { valid: diagnostics.length === 0, resources: null, diagnostics };
}
function cookieTextureViewDimensionForLight(light) {
    return light.kind === "point" ? "cube" : "2d";
}
function validateCookieTextureAsset(textureKey, texture, dimension) {
    if (texture === null || texture === undefined) {
        return null;
    }
    if (dimension === "2d" && texture.dimension !== "2d") {
        return {
            code: "localLightClusterCookie.textureNot2d",
            message: `Clustered spot-light cookie '${textureKey}' must be a 2D texture.`,
        };
    }
    if (dimension === "cube" &&
        (texture.dimension !== "cube" || texture.depthOrLayers !== 6)) {
        return {
            code: "localLightClusterCookie.textureNotCube",
            message: `Clustered point-light cookie '${textureKey}' must be a cube texture with six layers.`,
        };
    }
    return null;
}
//# sourceMappingURL=local-light-cookie-resources.js.map