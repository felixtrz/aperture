import { invertMat4 } from "/aperture/worker-modules/packages/simulation/dist/index.js";
import { createSamplerAsset, } from "/aperture/worker-modules/packages/render/dist/index.js";
import { createWebGpuBuffer } from "../gpu/buffer.js";
import { WEBGPU_BUFFER_USAGE_FLAGS } from "../resources/meshes/mesh-buffer-descriptors.js";
import { WEBGPU_APP_DEPTH_FORMAT } from "../resources/textures/depth-texture-resource.js";
import { createSamplerGpuResource, } from "../resources/textures/texture-resources.js";
import { createSkyboxRenderPipelineResource, skyboxPipelineCacheKey, } from "../render/skybox/skybox-pipeline.js";
import { prepareAppSamplerResource, prepareAppTextureResource, } from "./app-texture-sampler-resources.js";
import { webGpuAppScenePassColorFormat } from "./render-color-format.js";
export async function writeSkyboxCommandsForView(options) {
    options.target.length = 0;
    const skybox = selectSkyboxForView(options.snapshot.skyboxes ?? [], options.view);
    if (skybox === null) {
        return { valid: true, commands: options.target, diagnostics: [] };
    }
    const diagnostics = [];
    const pipeline = await getOrCreateWebGpuAppSkyboxPipeline(options.app, options.cache, options.reuse);
    diagnostics.push(...pipeline.diagnostics);
    if (!pipeline.valid || pipeline.resource === null) {
        return { valid: false, commands: options.target, diagnostics };
    }
    const device = options.app.initialization.device;
    const pipelineHandle = pipeline.resource.pipeline;
    if (pipelineHandle.getBindGroupLayout === undefined) {
        diagnostics.push({
            code: "skyboxFrame.missingPipelineLayouts",
            message: "Skybox pipeline does not expose bind group layouts.",
        });
        return { valid: false, commands: options.target, diagnostics };
    }
    if (device.createBindGroup === undefined) {
        diagnostics.push({
            code: "skyboxFrame.createBindGroupUnavailable",
            message: "WebGPU device cannot create skybox bind groups.",
        });
        return { valid: false, commands: options.target, diagnostics };
    }
    const uniformData = createSkyboxViewUniformData({
        snapshot: options.snapshot,
        view: options.view,
        skybox,
        diagnostics,
    });
    if (uniformData === null) {
        return { valid: false, commands: options.target, diagnostics };
    }
    const uniformBuffer = createWebGpuBuffer({
        device,
        descriptor: {
            label: `Skybox/View/${String(options.view.viewId)}`,
            size: uniformData.byteLength,
            usage: WEBGPU_BUFFER_USAGE_FLAGS.UNIFORM | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
            initialData: uniformData,
        },
    });
    if (!uniformBuffer.ok) {
        diagnostics.push(bufferDiagnostic("skyboxFrame.viewBufferFailed", uniformBuffer.message));
        return { valid: false, commands: options.target, diagnostics };
    }
    const texture = prepareAppTextureResource({
        assets: options.assets,
        device: options.app.initialization.device,
        cache: options.cache,
        handle: skybox.texture,
        reuse: options.reuse,
        diagnostics: diagnostics,
        viewDescriptor: { dimension: "cube" },
        viewDescriptorKey: "cube",
    });
    if (texture === null) {
        return { valid: false, commands: options.target, diagnostics };
    }
    const sampler = skybox.sampler === undefined || skybox.sampler === null
        ? {
            cacheKey: "skybox:default-sampler",
            resource: getOrCreateSkyboxDefaultSampler(options.app, options.cache, options.reuse, diagnostics),
        }
        : prepareAppSamplerResource({
            assets: options.assets,
            device: options.app.initialization.device,
            cache: options.cache,
            handle: skybox.sampler,
            reuse: options.reuse,
            diagnostics: diagnostics,
        });
    if (sampler === null || sampler.resource === null) {
        return { valid: false, commands: options.target, diagnostics };
    }
    const viewBindGroup = device.createBindGroup({
        label: `Skybox/ViewBindGroup/${String(options.view.viewId)}`,
        layout: pipelineHandle.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: uniformBuffer.buffer } }],
    });
    const textureBindGroup = device.createBindGroup({
        label: `Skybox/TextureBindGroup/${skybox.skyboxId}`,
        layout: pipelineHandle.getBindGroupLayout(1),
        entries: [
            { binding: 0, resource: texture.resource.view },
            { binding: 1, resource: sampler.resource.sampler },
        ],
    });
    options.target.push({
        kind: "setPipeline",
        renderId: skybox.skyboxId,
        pipelineKey: pipeline.resource.cacheKey,
        pipeline: pipeline.resource.pipeline,
    }, {
        kind: "setBindGroup",
        renderId: skybox.skyboxId,
        index: 0,
        resourceKey: `skybox:view:${String(options.view.viewId)}`,
        bindGroup: viewBindGroup,
    }, {
        kind: "setBindGroup",
        renderId: skybox.skyboxId,
        index: 1,
        resourceKey: `skybox:${texture.cacheKey}:${sampler.cacheKey}`,
        bindGroup: textureBindGroup,
    }, {
        kind: "draw",
        renderId: skybox.skyboxId,
        vertexCount: 3,
        instanceCount: 1,
        firstVertex: 0,
        firstInstance: 0,
    });
    return {
        valid: diagnostics.length === 0,
        commands: options.target,
        diagnostics,
    };
}
function selectSkyboxForView(skyboxes, view) {
    for (const skybox of skyboxes) {
        if ((skybox.layerMask & view.layerMask) !== 0) {
            return skybox;
        }
    }
    return null;
}
async function getOrCreateWebGpuAppSkyboxPipeline(app, cache, reuse) {
    const colorFormat = webGpuAppScenePassColorFormat(app);
    const key = skyboxPipelineCacheKey(colorFormat, WEBGPU_APP_DEPTH_FORMAT, app.msaa.sampleCount);
    const cached = cache.skyboxPipelines.get(key);
    if (cached !== undefined) {
        reuse.pipelineHits += 1;
        return cached;
    }
    reuse.pipelineMisses += 1;
    const result = await createSkyboxRenderPipelineResource({
        device: app.initialization.device,
        colorFormat,
        depthFormat: WEBGPU_APP_DEPTH_FORMAT,
        sampleCount: app.msaa.sampleCount,
    });
    cache.skyboxPipelines.set(key, result);
    return result;
}
function createSkyboxViewUniformData(input) {
    const viewProjectionOffset = input.view.viewProjectionMatrixOffset;
    const viewMatrixOffset = input.view.viewMatrixOffset;
    if (!hasMatrixRange(input.snapshot.viewMatrices, viewProjectionOffset)) {
        input.diagnostics.push({
            code: "skyboxFrame.viewProjectionOutOfRange",
            message: `Skybox view ${String(input.view.viewId)} view-projection matrix offset ${String(viewProjectionOffset)} is outside snapshot view matrix data.`,
        });
        return null;
    }
    if (!hasMatrixRange(input.snapshot.viewMatrices, viewMatrixOffset)) {
        input.diagnostics.push({
            code: "skyboxFrame.viewMatrixOutOfRange",
            message: `Skybox view ${String(input.view.viewId)} view matrix offset ${String(viewMatrixOffset)} is outside snapshot view matrix data.`,
        });
        return null;
    }
    const viewProjection = input.snapshot.viewMatrices.subarray(viewProjectionOffset, viewProjectionOffset + 16);
    const inverseViewProjection = invertMat4(viewProjection);
    if (inverseViewProjection === null) {
        input.diagnostics.push({
            code: "skyboxFrame.viewProjectionNotInvertible",
            message: `Skybox view ${String(input.view.viewId)} has a non-invertible view-projection matrix.`,
        });
        return null;
    }
    if (!Number.isFinite(input.skybox.intensity) || input.skybox.intensity < 0) {
        input.diagnostics.push({
            code: "skyboxFrame.invalidIntensity",
            message: `Skybox ${String(input.skybox.skyboxId)} intensity must be finite and non-negative.`,
        });
        return null;
    }
    const data = new Float32Array(24);
    data.set(inverseViewProjection, 0);
    writeCameraPositionFromViewMatrix(data, 16, input.snapshot.viewMatrices, viewMatrixOffset);
    data[20] = input.skybox.intensity;
    data[21] = 0;
    data[22] = 0;
    data[23] = 0;
    return data;
}
function hasMatrixRange(values, sourceOffset) {
    return sourceOffset >= 0 && sourceOffset + 16 <= values.length;
}
function writeCameraPositionFromViewMatrix(target, targetOffset, viewMatrices, viewMatrixOffset) {
    const tx = viewMatrices[viewMatrixOffset + 12] ?? 0;
    const ty = viewMatrices[viewMatrixOffset + 13] ?? 0;
    const tz = viewMatrices[viewMatrixOffset + 14] ?? 0;
    target[targetOffset] = -((viewMatrices[viewMatrixOffset] ?? 1) * tx +
        (viewMatrices[viewMatrixOffset + 1] ?? 0) * ty +
        (viewMatrices[viewMatrixOffset + 2] ?? 0) * tz);
    target[targetOffset + 1] = -((viewMatrices[viewMatrixOffset + 4] ?? 0) * tx +
        (viewMatrices[viewMatrixOffset + 5] ?? 1) * ty +
        (viewMatrices[viewMatrixOffset + 6] ?? 0) * tz);
    target[targetOffset + 2] = -((viewMatrices[viewMatrixOffset + 8] ?? 0) * tx +
        (viewMatrices[viewMatrixOffset + 9] ?? 0) * ty +
        (viewMatrices[viewMatrixOffset + 10] ?? 1) * tz);
    target[targetOffset + 3] = 1;
}
function getOrCreateSkyboxDefaultSampler(app, cache, reuse, diagnostics) {
    const cacheKey = "skybox:default-sampler";
    const cached = cache.samplers.get(cacheKey);
    if (cached !== undefined) {
        reuse.samplerResourcesReused += 1;
        return cached;
    }
    const sampler = createSamplerGpuResource({
        device: app.initialization.device,
        resourceKey: cacheKey,
        sampler: createSamplerAsset({
            label: "SkyboxDefaultSampler",
            addressModeU: "clamp-to-edge",
            addressModeV: "clamp-to-edge",
            addressModeW: "clamp-to-edge",
            magFilter: "linear",
            minFilter: "linear",
            mipmapFilter: "linear",
        }),
    });
    diagnostics.push(...sampler.diagnostics);
    if (!sampler.valid || sampler.resource === null) {
        return null;
    }
    cache.samplers.set(cacheKey, sampler.resource);
    reuse.samplerResourcesCreated += 1;
    return sampler.resource;
}
function bufferDiagnostic(code, message) {
    return { code, message };
}
//# sourceMappingURL=skybox.js.map