import { prepareAppSamplerResource, prepareAppTextureResource, } from "../app/app-texture-sampler-resources.js";
import { WEBGPU_TEXTURE_USAGE_FLAGS, createTextureGpuResource, } from "../resources/textures/texture-resources.js";
import { prepareDefaultCookieSamplerResource } from "./local-light-cookie-sampler.js";
const cookieAtlasBlitPipelineCache = new WeakMap();
const cookieAtlasSourceKeys = new WeakMap();
const COOKIE_ATLAS_BLIT_WGSL = /* wgsl */ `
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@group(0) @binding(0) var sourceTexture: texture_2d<f32>;
@group(0) @binding(1) var sourceSampler: sampler;

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var positions = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
    vec2f(-1.0, 3.0)
  );
  let position = positions[vertexIndex];
  var output: VertexOutput;
  output.position = vec4f(position, 0.0, 1.0);
  output.uv = position * 0.5 + vec2f(0.5, 0.5);
  output.uv.y = 1.0 - output.uv.y;
  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  return textureSample(sourceTexture, sourceSampler, input.uv);
}
`;
export function prepareCookieTextureArrayResource(options) {
    const first = options.candidates[0];
    if (first === undefined) {
        return null;
    }
    const cacheKey = `local-light-cookie-array:v1:${options.candidates
        .map((candidate) => `${candidate.light.kind}:${candidate.light.lightId}@${candidate.layerBaseIndex}+${candidate.layerCount}:${candidate.textureCacheKey}`)
        .join("|")}`;
    const cached = options.cache.textures.get(cacheKey);
    if (cached !== undefined) {
        options.reuse.textureResourcesReused += 1;
        return { cacheKey, resource: cached };
    }
    const layerByteLength = first.layerByteLength;
    const totalLayerCount = options.candidates.reduce((total, candidate) => total + candidate.layerCount, 0);
    const combinedData = new Uint8Array(layerByteLength * totalLayerCount);
    for (let index = 0; index < options.candidates.length; index += 1) {
        const candidate = options.candidates[index];
        if (candidate === undefined || candidate.texture.sourceData === undefined) {
            options.diagnostics.push({
                code: "localLightClusterCookie.textureArrayMissingSourceData",
                resourceKey: cacheKey,
                message: `Clustered local-light cookie array '${cacheKey}' requires source texture bytes for every layer.`,
            });
            return null;
        }
        if (candidate.layerByteLength !== layerByteLength ||
            candidate.rowsPerImage !== first.rowsPerImage ||
            candidate.texture.sourceData.bytes.byteLength <
                layerByteLength * candidate.layerCount) {
            options.diagnostics.push({
                code: "localLightClusterCookie.textureArrayIncompatible",
                resourceKey: cacheKey,
                message: `Clustered local-light cookie array '${cacheKey}' has incompatible layer layout for texture '${candidate.textureKey}'.`,
            });
            return null;
        }
        combinedData.set(candidate.texture.sourceData.bytes.subarray(0, layerByteLength * candidate.layerCount), candidate.layerBaseIndex * layerByteLength);
    }
    const result = createTextureGpuResource({
        device: options.device,
        resourceKey: cacheKey,
        descriptor: {
            label: cacheKey,
            size: [first.texture.width, first.texture.height, totalLayerCount],
            format: first.texture.format,
            colorSpace: first.texture.colorSpace,
            semantic: first.texture.semantic,
            mipLevelCount: first.texture.mipLevelCount,
            usage: WEBGPU_TEXTURE_USAGE_FLAGS.TEXTURE_BINDING |
                WEBGPU_TEXTURE_USAGE_FLAGS.COPY_DST,
        },
        upload: {
            data: combinedData,
            bytesPerRow: first.texture.sourceData.bytesPerRow,
            rowsPerImage: first.rowsPerImage,
        },
        viewDescriptor: { dimension: "2d-array" },
    });
    options.diagnostics.push(...result.diagnostics);
    if (!result.valid || result.resource === null) {
        return null;
    }
    options.cache.textures.set(cacheKey, result.resource);
    options.reuse.textureResourcesCreated += 1;
    return { cacheKey, resource: result.resource };
}
export function prepareCookieTextureAtlasResource(options) {
    const gpuBlitTexture = prepareCookieTextureAtlasGpuBlitResource(options);
    if (gpuBlitTexture !== null) {
        return gpuBlitTexture;
    }
    return prepareCookieTextureAtlasCpuUploadResource(options);
}
function prepareCookieTextureAtlasGpuBlitResource(options) {
    const first = options.candidates[0];
    if (first === undefined) {
        return null;
    }
    const device = options.device;
    if (!canBlitCookieAtlasOnGpu(device)) {
        return null;
    }
    const cacheKey = `local-light-cookie-atlas-gpu:v1:${first.atlasWidth}x${first.atlasHeight}:format:${first.texture.format}:mips:${first.texture.mipLevelCount}:color:${first.texture.colorSpace}:semantic:${first.texture.semantic}:${options.candidates
        .map((candidate) => `${candidate.light.kind}:${candidate.light.lightId}@${candidate.originX},${candidate.originY}+${candidate.atlasTileWidth}x${candidate.atlasTileHeight}`)
        .join("|")}`;
    const cached = options.cache.textures.get(cacheKey);
    let resource = cached;
    let created = false;
    if (resource === undefined) {
        const result = createTextureGpuResource({
            device,
            resourceKey: cacheKey,
            descriptor: {
                label: cacheKey,
                size: [first.atlasWidth, first.atlasHeight, 1],
                format: first.texture.format,
                colorSpace: first.texture.colorSpace,
                semantic: first.texture.semantic,
                mipLevelCount: first.texture.mipLevelCount,
                usage: WEBGPU_TEXTURE_USAGE_FLAGS.TEXTURE_BINDING |
                    WEBGPU_TEXTURE_USAGE_FLAGS.COPY_DST |
                    WEBGPU_TEXTURE_USAGE_FLAGS.RENDER_ATTACHMENT,
            },
        });
        if (!result.valid || result.resource === null) {
            return null;
        }
        resource = result.resource;
        created = true;
    }
    const previousSourceKeys = getCookieAtlasSourceKeys(resource.texture) ?? new Map();
    const preparedTiles = [];
    const sourceTextureKeys = [];
    const tileKeysToUpdate = [];
    const localDiagnostics = [];
    const localTextureSamplerDiagnostics = [];
    for (const candidate of options.candidates) {
        const sourceKey = candidate.textureCacheKey;
        const tileKey = cookieAtlasTileKey(candidate);
        sourceTextureKeys.push(sourceKey);
        if (!created && previousSourceKeys.get(tileKey) === sourceKey) {
            continue;
        }
        const sourceTexture = prepareAppTextureResource({
            assets: options.assets,
            device: options.device,
            cache: options.cache,
            handle: candidate.light.cookieTexture,
            reuse: options.reuse,
            diagnostics: localTextureSamplerDiagnostics,
        });
        localDiagnostics.push(...localTextureSamplerDiagnostics.splice(0));
        if (sourceTexture === null) {
            return null;
        }
        const sourceSampler = candidate.light.cookieSampler === undefined ||
            candidate.light.cookieSampler === null
            ? prepareDefaultCookieSamplerResource({
                ...options,
                diagnostics: localDiagnostics,
            })
            : prepareAppSamplerResource({
                assets: options.assets,
                device: options.device,
                cache: options.cache,
                handle: candidate.light.cookieSampler,
                reuse: options.reuse,
                diagnostics: localTextureSamplerDiagnostics,
            });
        localDiagnostics.push(...localTextureSamplerDiagnostics.splice(0));
        if (sourceSampler === null || localDiagnostics.length > 0) {
            return null;
        }
        preparedTiles.push({
            candidate,
            sourceTextureResource: sourceTexture.resource,
            sourceSamplerResource: sourceSampler.resource,
        });
        tileKeysToUpdate.push(tileKey);
    }
    if (preparedTiles.length > 0) {
        const blitSucceeded = renderCookieAtlasBlitTiles({
            device,
            resource,
            format: first.texture.format,
            tiles: preparedTiles,
            clear: created,
        });
        if (!blitSucceeded) {
            return null;
        }
        const nextSourceKeys = new Map(previousSourceKeys);
        for (let index = 0; index < tileKeysToUpdate.length; index += 1) {
            const tileKey = tileKeysToUpdate[index];
            const prepared = preparedTiles[index];
            if (tileKey !== undefined && prepared !== undefined) {
                nextSourceKeys.set(tileKey, prepared.candidate.textureCacheKey);
            }
        }
        setCookieAtlasSourceKeys(resource.texture, nextSourceKeys);
    }
    else if (created) {
        setCookieAtlasSourceKeys(resource.texture, previousSourceKeys);
    }
    if (created) {
        options.cache.textures.set(cacheKey, resource);
        options.reuse.textureResourcesCreated += 1;
    }
    else {
        options.reuse.textureResourcesReused += 1;
    }
    return {
        cacheKey,
        resource,
        atlasUpdate: {
            updateMode: preparedTiles.length > 0 ? "gpu-blit" : "cache-hit",
            atlasWidth: first.atlasWidth,
            atlasHeight: first.atlasHeight,
            requestedTileCount: options.candidates.length,
            updatedTileCount: preparedTiles.length,
            gpuBlitTileCount: preparedTiles.length,
            cpuUploadTileCount: 0,
            cachedTileCount: options.candidates.length - preparedTiles.length,
            sourceTextureKeys,
        },
    };
}
function prepareCookieTextureAtlasCpuUploadResource(options) {
    const first = options.candidates[0];
    if (first === undefined) {
        return null;
    }
    const cacheKey = `local-light-cookie-atlas:v1:${first.atlasWidth}x${first.atlasHeight}:${options.candidates
        .map((candidate) => `${candidate.light.kind}:${candidate.light.lightId}@${candidate.originX},${candidate.originY}+${candidate.atlasTileWidth}x${candidate.atlasTileHeight}:${candidate.textureCacheKey}`)
        .join("|")}`;
    const cached = options.cache.textures.get(cacheKey);
    if (cached !== undefined) {
        options.reuse.textureResourcesReused += 1;
        return {
            cacheKey,
            resource: cached,
            atlasUpdate: {
                updateMode: "cache-hit",
                atlasWidth: first.atlasWidth,
                atlasHeight: first.atlasHeight,
                requestedTileCount: options.candidates.length,
                updatedTileCount: 0,
                gpuBlitTileCount: 0,
                cpuUploadTileCount: 0,
                cachedTileCount: options.candidates.length,
                sourceTextureKeys: options.candidates.map((candidate) => candidate.textureCacheKey),
            },
        };
    }
    const result = createTextureGpuResource({
        device: options.device,
        resourceKey: cacheKey,
        descriptor: {
            label: cacheKey,
            size: [first.atlasWidth, first.atlasHeight, 1],
            format: first.texture.format,
            colorSpace: first.texture.colorSpace,
            semantic: first.texture.semantic,
            mipLevelCount: first.texture.mipLevelCount,
            usage: WEBGPU_TEXTURE_USAGE_FLAGS.TEXTURE_BINDING |
                WEBGPU_TEXTURE_USAGE_FLAGS.COPY_DST,
        },
    });
    options.diagnostics.push(...result.diagnostics);
    if (!result.valid || result.resource === null) {
        return null;
    }
    const textureDevice = options.device;
    const queue = textureDevice.queue;
    if (queue === undefined || queue.writeTexture === undefined) {
        options.diagnostics.push({
            code: "localLightClusterCookie.textureAtlasUploadUnavailable",
            resourceKey: cacheKey,
            message: `Clustered local-light cookie atlas '${cacheKey}' cannot upload source texture tiles because WebGPU queue.writeTexture is unavailable.`,
        });
        return null;
    }
    for (const candidate of options.candidates) {
        if (candidate.texture.sourceData === undefined) {
            options.diagnostics.push({
                code: "localLightClusterCookie.textureAtlasMissingSourceData",
                resourceKey: cacheKey,
                message: `Clustered local-light cookie atlas '${cacheKey}' requires source texture bytes for '${candidate.textureKey}'.`,
            });
            return null;
        }
        if (candidate.texture.sourceData.bytes.byteLength < candidate.layerByteLength) {
            options.diagnostics.push({
                code: "localLightClusterCookie.textureAtlasIncompatible",
                resourceKey: cacheKey,
                message: `Clustered local-light cookie atlas '${cacheKey}' has incompatible source data for texture '${candidate.textureKey}'.`,
            });
            return null;
        }
        const upload = atlasTileUploadData(candidate);
        if (upload === null) {
            options.diagnostics.push({
                code: "localLightClusterCookie.textureAtlasIncompatible",
                resourceKey: cacheKey,
                message: `Clustered local-light cookie atlas '${cacheKey}' has incompatible source data for texture '${candidate.textureKey}'.`,
            });
            return null;
        }
        try {
            queue.writeTexture({
                texture: result.resource.texture,
                origin: { x: candidate.originX, y: candidate.originY, z: 0 },
            }, upload.bytes, {
                bytesPerRow: upload.bytesPerRow,
                rowsPerImage: upload.rowsPerImage,
            }, [candidate.atlasTileWidth, candidate.atlasTileHeight, 1]);
        }
        catch (error) {
            options.diagnostics.push({
                code: "localLightClusterCookie.textureAtlasUploadFailed",
                resourceKey: cacheKey,
                message: `Clustered local-light cookie atlas '${cacheKey}' upload failed for texture '${candidate.textureKey}': ${error instanceof Error ? error.message : "Texture upload failed."}`,
            });
            return null;
        }
    }
    options.cache.textures.set(cacheKey, result.resource);
    options.reuse.textureResourcesCreated += 1;
    return {
        cacheKey,
        resource: result.resource,
        atlasUpdate: {
            updateMode: "cpu-upload",
            atlasWidth: first.atlasWidth,
            atlasHeight: first.atlasHeight,
            requestedTileCount: options.candidates.length,
            updatedTileCount: options.candidates.length,
            gpuBlitTileCount: 0,
            cpuUploadTileCount: options.candidates.length,
            cachedTileCount: 0,
            sourceTextureKeys: options.candidates.map((candidate) => candidate.textureCacheKey),
        },
    };
}
function canBlitCookieAtlasOnGpu(device) {
    return (typeof device.createShaderModule === "function" &&
        typeof device.createBindGroupLayout === "function" &&
        typeof device.createPipelineLayout === "function" &&
        typeof device.createRenderPipeline === "function" &&
        typeof device.createBindGroup === "function" &&
        typeof device.createCommandEncoder === "function" &&
        typeof device.queue?.submit === "function");
}
function getCookieAtlasSourceKeys(texture) {
    return isObjectLike(texture) ? cookieAtlasSourceKeys.get(texture) : undefined;
}
function setCookieAtlasSourceKeys(texture, keys) {
    if (isObjectLike(texture)) {
        cookieAtlasSourceKeys.set(texture, keys);
    }
}
function cookieAtlasTileKey(candidate) {
    return `${candidate.light.kind}:${candidate.light.lightId}@${candidate.originX},${candidate.originY}+${candidate.atlasTileWidth}x${candidate.atlasTileHeight}`;
}
function renderCookieAtlasBlitTiles(options) {
    if (options.tiles.length === 0) {
        return true;
    }
    const pipeline = getOrCreateCookieAtlasBlitPipeline(options.device, options.format);
    const encoder = options.device.createCommandEncoder?.({
        label: "local-light-cookie-atlas-blit-encoder",
    });
    if (pipeline === null ||
        encoder === undefined ||
        typeof encoder.beginRenderPass !== "function" ||
        typeof encoder.finish !== "function") {
        return false;
    }
    const pass = encoder.beginRenderPass({
        label: "local-light-cookie-atlas-blit-pass",
        colorAttachments: [
            {
                view: options.resource.view,
                loadOp: options.clear ? "clear" : "load",
                storeOp: "store",
                clearValue: { r: 0, g: 0, b: 0, a: 0 },
            },
        ],
    });
    if (pass === undefined ||
        typeof pass.setPipeline !== "function" ||
        typeof pass.setBindGroup !== "function" ||
        typeof pass.setViewport !== "function" ||
        typeof pass.draw !== "function" ||
        typeof pass.end !== "function") {
        return false;
    }
    pass.setPipeline(pipeline.pipeline);
    for (const tile of options.tiles) {
        const bindGroup = options.device.createBindGroup?.({
            label: `local-light-cookie-atlas-blit:${tile.candidate.light.lightId}`,
            layout: pipeline.bindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: tile.sourceTextureResource.view,
                },
                {
                    binding: 1,
                    resource: tile.sourceSamplerResource.sampler,
                },
            ],
        });
        if (bindGroup === undefined) {
            return false;
        }
        pass.setBindGroup(0, bindGroup);
        pass.setViewport(tile.candidate.originX, tile.candidate.originY, tile.candidate.atlasTileWidth, tile.candidate.atlasTileHeight, 0, 1);
        pass.draw(3, 1, 0, 0);
    }
    pass.end();
    const commandBuffer = encoder.finish();
    options.device.queue?.submit?.([commandBuffer]);
    return true;
}
function getOrCreateCookieAtlasBlitPipeline(device, format) {
    if (!isObjectLike(device)) {
        return null;
    }
    let pipelines = cookieAtlasBlitPipelineCache.get(device);
    if (pipelines === undefined) {
        pipelines = new Map();
        cookieAtlasBlitPipelineCache.set(device, pipelines);
    }
    const cached = pipelines.get(format);
    if (cached !== undefined) {
        return cached;
    }
    const shaderModule = device.createShaderModule?.({
        label: "local-light-cookie-atlas-blit-shader",
        code: COOKIE_ATLAS_BLIT_WGSL,
    });
    const bindGroupLayout = device.createBindGroupLayout?.({
        label: "local-light-cookie-atlas-blit-bind-group-layout",
        entries: [
            {
                binding: 0,
                visibility: 2,
                texture: { sampleType: "float", viewDimension: "2d" },
            },
            {
                binding: 1,
                visibility: 2,
                sampler: { type: "filtering" },
            },
        ],
    });
    if (shaderModule === undefined || bindGroupLayout === undefined) {
        return null;
    }
    const layout = device.createPipelineLayout?.({
        label: "local-light-cookie-atlas-blit-pipeline-layout",
        bindGroupLayouts: [bindGroupLayout],
    });
    if (layout === undefined) {
        return null;
    }
    const pipeline = device.createRenderPipeline?.({
        label: `local-light-cookie-atlas-blit-pipeline:${format}`,
        layout,
        vertex: {
            module: shaderModule,
            entryPoint: "vertexMain",
        },
        fragment: {
            module: shaderModule,
            entryPoint: "fragmentMain",
            targets: [{ format }],
        },
        primitive: {
            topology: "triangle-list",
        },
    });
    if (pipeline === undefined) {
        return null;
    }
    const created = { bindGroupLayout, pipeline };
    pipelines.set(format, created);
    return created;
}
function isObjectLike(value) {
    return ((typeof value === "object" && value !== null) || typeof value === "function");
}
function atlasTileUploadData(candidate) {
    const source = candidate.texture.sourceData;
    if (source === undefined) {
        return null;
    }
    if (candidate.atlasTileWidth === candidate.texture.width &&
        candidate.atlasTileHeight === candidate.texture.height) {
        return {
            bytes: source.bytes.subarray(0, candidate.layerByteLength),
            bytesPerRow: source.bytesPerRow,
            rowsPerImage: candidate.rowsPerImage,
        };
    }
    const bytesPerPixel = source.bytesPerRow / candidate.texture.width;
    if (!Number.isInteger(bytesPerPixel) ||
        bytesPerPixel <= 0 ||
        candidate.atlasTileWidth <= 0 ||
        candidate.atlasTileHeight <= 0) {
        return null;
    }
    const bytesPerRow = candidate.atlasTileWidth * bytesPerPixel;
    const bytes = new Uint8Array(bytesPerRow * candidate.atlasTileHeight);
    for (let y = 0; y < candidate.atlasTileHeight; y += 1) {
        const sourceY = Math.min(candidate.texture.height - 1, Math.floor(((y + 0.5) * candidate.texture.height) / candidate.atlasTileHeight));
        for (let x = 0; x < candidate.atlasTileWidth; x += 1) {
            const sourceX = Math.min(candidate.texture.width - 1, Math.floor(((x + 0.5) * candidate.texture.width) / candidate.atlasTileWidth));
            const sourceOffset = sourceY * source.bytesPerRow + sourceX * bytesPerPixel;
            const targetOffset = y * bytesPerRow + x * bytesPerPixel;
            if (sourceOffset + bytesPerPixel > source.bytes.byteLength) {
                return null;
            }
            bytes.set(source.bytes.subarray(sourceOffset, sourceOffset + bytesPerPixel), targetOffset);
        }
    }
    return {
        bytes,
        bytesPerRow,
        rowsPerImage: candidate.atlasTileHeight,
    };
}
//# sourceMappingURL=local-light-cookie-textures.js.map