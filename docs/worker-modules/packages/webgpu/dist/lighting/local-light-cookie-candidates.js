import { assetHandleKey } from "/aperture/worker-modules/packages/simulation/dist/index.js";
import { sourceAssetCacheKey, } from "../app/app-texture-sampler-resources.js";
import { DEFAULT_COOKIE_SAMPLER_CACHE_KEY } from "./local-light-cookie-sampler.js";
export function collectCookieArrayCandidates(options) {
    const candidates = [];
    let base = null;
    let nextLayerBaseIndex = 0;
    for (const light of options.snapshot.lights) {
        if ((light.kind !== "spot" && light.kind !== "point") ||
            light.cookieTexture === undefined ||
            light.cookieTexture === null) {
            continue;
        }
        const textureEntry = options.assets.get(light.cookieTexture);
        if (textureEntry === undefined ||
            textureEntry.status !== "ready" ||
            textureEntry.asset === null ||
            textureEntry.asset.sourceData === undefined) {
            continue;
        }
        if (light.kind === "spot" && textureEntry.asset.dimension !== "2d") {
            continue;
        }
        if (light.kind === "point" &&
            (textureEntry.asset.dimension !== "cube" ||
                textureEntry.asset.depthOrLayers !== 6)) {
            continue;
        }
        const sampler = cookieSamplerCandidate(options, light);
        if (sampler === null) {
            continue;
        }
        const texture = textureEntry.asset;
        const rowsPerImage = texture.sourceData.rowsPerImage ?? texture.height;
        const layerByteLength = rowsPerImage * texture.sourceData.bytesPerRow;
        const layerCount = light.kind === "point" ? 6 : 1;
        if (texture.sourceData.bytes.byteLength < layerByteLength * layerCount) {
            continue;
        }
        const candidateBase = {
            width: texture.width,
            height: texture.height,
            format: texture.format,
            colorSpace: texture.colorSpace,
            semantic: texture.semantic,
            mipLevelCount: texture.mipLevelCount,
            bytesPerRow: texture.sourceData.bytesPerRow,
            rowsPerImage,
            samplerSignature: sampler.signature,
        };
        if (base === null) {
            base = candidateBase;
        }
        else if (!cookieArrayBaseMatches(base, candidateBase)) {
            continue;
        }
        candidates.push({
            light,
            texture,
            textureKey: assetHandleKey(light.cookieTexture),
            textureCacheKey: sourceAssetCacheKey(light.cookieTexture, textureEntry.version),
            samplerSignature: sampler.signature,
            layerByteLength,
            rowsPerImage,
            layerCount,
            layerBaseIndex: nextLayerBaseIndex,
        });
        nextLayerBaseIndex += layerCount;
    }
    return candidates;
}
export function collectCookieAtlasCandidates(options) {
    const pending = [];
    let base = null;
    for (const light of options.snapshot.lights) {
        if (light.kind !== "spot" ||
            light.cookieTexture === undefined ||
            light.cookieTexture === null) {
            continue;
        }
        const textureEntry = options.assets.get(light.cookieTexture);
        if (textureEntry === undefined ||
            textureEntry.status !== "ready" ||
            textureEntry.asset === null ||
            textureEntry.asset.sourceData === undefined ||
            textureEntry.asset.dimension !== "2d" ||
            textureEntry.asset.width <= 0 ||
            textureEntry.asset.height <= 0) {
            continue;
        }
        const sampler = cookieSamplerCandidate(options, light);
        if (sampler === null) {
            continue;
        }
        const texture = textureEntry.asset;
        const rowsPerImage = texture.sourceData.rowsPerImage ?? texture.height;
        const layerByteLength = rowsPerImage * texture.sourceData.bytesPerRow;
        if (texture.sourceData.bytes.byteLength < layerByteLength) {
            continue;
        }
        const candidateBase = {
            format: texture.format,
            colorSpace: texture.colorSpace,
            semantic: texture.semantic,
            mipLevelCount: texture.mipLevelCount,
            samplerSignature: sampler.signature,
        };
        if (base === null) {
            base = candidateBase;
        }
        else if (!cookieAtlasBaseMatches(base, candidateBase)) {
            continue;
        }
        pending.push({
            light,
            texture,
            textureKey: assetHandleKey(light.cookieTexture),
            textureCacheKey: sourceAssetCacheKey(light.cookieTexture, textureEntry.version),
            samplerSignature: sampler.signature,
            rowsPerImage,
            layerByteLength,
        });
    }
    if (pending.length <= 1) {
        return [];
    }
    const atlasWidth = pending.reduce((width, candidate) => width + candidate.texture.width, 0);
    const atlasHeight = pending.reduce((height, candidate) => Math.max(height, candidate.texture.height), 1);
    const candidates = [];
    let originX = 0;
    for (const candidate of pending) {
        candidates.push({
            ...candidate,
            originX,
            originY: 0,
            atlasWidth,
            atlasHeight,
            atlasTileWidth: candidate.texture.width,
            atlasTileHeight: candidate.texture.height,
            matrixBaseIndex: candidates.length,
        });
        originX += candidate.texture.width;
    }
    return candidates;
}
export function collectShadowAlignedCookieAtlasCandidates(candidates, shadowReceiverResources) {
    if (candidates.length <= 1 || shadowReceiverResources === undefined) {
        return [];
    }
    const spotResources = shadowReceiverResources.shadowKind !== undefined &&
        shadowReceiverResources.shadowKind.startsWith("multi")
        ? shadowReceiverResources.spotShadowReceiverResources
        : shadowReceiverResources.shadowKind === "spot" ||
            shadowReceiverResources.shadowKind === "spot-array"
            ? shadowReceiverResources
            : undefined;
    if (spotResources === undefined ||
        spotResources.matrixBufferResource.resource === null ||
        spotResources.samplerResource.resource === null) {
        return [];
    }
    const spotDepthResources = spotResources.depthTextureResources.resources;
    const aligned = [];
    let atlasWidth = null;
    let atlasHeight = null;
    for (const candidate of candidates) {
        const shadowResource = spotDepthResources.find((resource) => resource.lightId === candidate.light.lightId &&
            resource.viewDimension === "2d" &&
            resource.allocation.resource !== null &&
            resource.atlasRegion !== undefined);
        const shadowTextureSize = shadowResource?.allocation.resource?.descriptor.size;
        if (shadowResource === undefined ||
            shadowResource.atlasRegion === undefined ||
            shadowTextureSize === undefined) {
            return [];
        }
        const shadowAtlasWidth = shadowTextureSize[0];
        const shadowAtlasHeight = shadowTextureSize[1];
        if (atlasWidth !== null &&
            (atlasWidth !== shadowAtlasWidth || atlasHeight !== shadowAtlasHeight)) {
            return [];
        }
        atlasWidth = shadowAtlasWidth;
        atlasHeight = shadowAtlasHeight;
        aligned.push({
            ...candidate,
            originX: shadowResource.atlasRegion.originX,
            originY: shadowResource.atlasRegion.originY,
            atlasWidth: shadowAtlasWidth,
            atlasHeight: shadowAtlasHeight,
            atlasTileWidth: shadowResource.atlasRegion.width,
            atlasTileHeight: shadowResource.atlasRegion.height,
            matrixBaseIndex: aligned.length,
            shadowMatrixCompatible: true,
        });
    }
    return aligned;
}
function cookieSamplerCandidate(options, light) {
    if (light.cookieSampler === undefined || light.cookieSampler === null) {
        return { signature: DEFAULT_COOKIE_SAMPLER_CACHE_KEY };
    }
    const entry = options.assets.get(light.cookieSampler);
    if (entry === undefined || entry.status !== "ready" || entry.asset === null) {
        return null;
    }
    return { signature: samplerAssetSignature(entry.asset) };
}
function samplerAssetSignature(sampler) {
    return [
        sampler.addressModeU,
        sampler.addressModeV,
        sampler.addressModeW,
        sampler.magFilter,
        sampler.minFilter,
        sampler.mipmapFilter,
        sampler.lodMinClamp,
        sampler.lodMaxClamp,
        sampler.maxAnisotropy,
    ].join("|");
}
function cookieArrayBaseMatches(base, candidate) {
    return (candidate.width === base.width &&
        candidate.height === base.height &&
        candidate.format === base.format &&
        candidate.colorSpace === base.colorSpace &&
        candidate.semantic === base.semantic &&
        candidate.mipLevelCount === base.mipLevelCount &&
        candidate.bytesPerRow === base.bytesPerRow &&
        candidate.rowsPerImage === base.rowsPerImage &&
        candidate.samplerSignature === base.samplerSignature);
}
function cookieAtlasBaseMatches(base, candidate) {
    return (candidate.format === base.format &&
        candidate.colorSpace === base.colorSpace &&
        candidate.semantic === base.semantic &&
        candidate.mipLevelCount === base.mipLevelCount &&
        candidate.samplerSignature === base.samplerSignature);
}
//# sourceMappingURL=local-light-cookie-candidates.js.map