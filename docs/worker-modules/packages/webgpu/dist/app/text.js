import { createSamplerAsset, } from "/aperture/worker-modules/packages/render/dist/index.js";
import { createWebGpuBuffer } from "../gpu/buffer.js";
import { WEBGPU_BUFFER_USAGE_FLAGS } from "../resources/meshes/mesh-buffer-descriptors.js";
import { WEBGPU_APP_DEPTH_FORMAT } from "../resources/textures/depth-texture-resource.js";
import { createSamplerGpuResource, } from "../resources/textures/texture-resources.js";
import { createMsdfTextRenderPipelineResource, msdfTextPipelineCacheKey, } from "../render/text/msdf-text-pipeline.js";
import { prepareAppSamplerResource, prepareAppTextureResource, } from "./app-texture-sampler-resources.js";
import { webGpuAppScenePassColorFormat, webGpuAppUsesHdrScenePass, } from "./render-color-format.js";
import { webGpuAppCanvasDimensions } from "./canvas.js";
const TEXT_VIEWPORT_FLOAT_OFFSET = 20;
const GLYPH_RENDER_FLOAT_STRIDE = 24;
export async function prepareMsdfTextFrameResourcesForSnapshot(options) {
    const glyphBatches = msdfTextQuadBatches(options.snapshot);
    if (glyphBatches.length === 0) {
        return {
            pipeline: null,
            resources: {
                valid: true,
                commands: [],
                diagnostics: [],
            },
        };
    }
    const pipeline = await getOrCreateWebGpuAppMsdfTextPipeline(options.app, options.cache);
    if (!pipeline.valid || pipeline.resource === null) {
        return {
            pipeline,
            resources: {
                valid: false,
                commands: [],
                diagnostics: pipeline.diagnostics,
            },
        };
    }
    return {
        pipeline,
        resources: createMsdfTextFrameResources({
            app: options.app,
            assets: options.assets,
            cache: options.cache,
            snapshot: options.snapshot,
            viewUniforms: options.viewUniforms,
            worldTransforms: options.worldTransforms,
            pipeline: pipeline.resource,
            reuse: options.reuse,
        }),
    };
}
export function createMsdfTextFrameResources(options) {
    const diagnostics = [];
    const commands = [];
    const device = options.app.initialization.device;
    const pipeline = options.pipeline.pipeline;
    const packedViewUniformData = options.viewUniforms.data.subarray(0, options.viewUniforms.floatCount ?? options.viewUniforms.data.length);
    const viewUniformData = createMsdfTextViewUniformData({
        snapshot: options.snapshot,
        viewUniforms: options.viewUniforms,
        source: packedViewUniformData,
        ...(options.app.canvas === undefined ? {} : { canvas: options.app.canvas }),
    });
    const worldTransformData = options.worldTransforms.data.subarray(0, options.worldTransforms.floatCount ?? options.worldTransforms.data.length);
    const renderInput = createMsdfTextRenderInput(options.snapshot, diagnostics);
    if (pipeline.getBindGroupLayout === undefined) {
        return {
            valid: false,
            commands,
            diagnostics: [
                {
                    code: "msdfTextFrame.missingPipelineLayouts",
                    message: "MSDF text pipeline does not expose bind group layouts.",
                },
            ],
        };
    }
    if (device.createBindGroup === undefined) {
        return {
            valid: false,
            commands,
            diagnostics: [
                {
                    code: "msdfTextFrame.createBindGroupUnavailable",
                    message: "WebGPU device cannot create MSDF text bind groups.",
                },
            ],
        };
    }
    const viewBuffer = createWebGpuBuffer({
        device,
        descriptor: {
            label: "MSDFText/ViewUniforms",
            size: viewUniformData.byteLength,
            usage: WEBGPU_BUFFER_USAGE_FLAGS.UNIFORM | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
            initialData: viewUniformData,
        },
    });
    const transformBuffer = createWebGpuBuffer({
        device,
        descriptor: {
            label: "MSDFText/WorldTransforms",
            size: worldTransformData.byteLength,
            usage: WEBGPU_BUFFER_USAGE_FLAGS.STORAGE | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
            initialData: worldTransformData,
        },
    });
    const glyphBuffer = createWebGpuBuffer({
        device,
        descriptor: {
            label: "MSDFText/GlyphData",
            size: renderInput.data.byteLength,
            usage: WEBGPU_BUFFER_USAGE_FLAGS.STORAGE | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
            initialData: renderInput.data,
        },
    });
    if (!viewBuffer.ok) {
        diagnostics.push(bufferDiagnostic("msdfTextFrame.viewBufferFailed", viewBuffer.message));
    }
    if (!transformBuffer.ok) {
        diagnostics.push(bufferDiagnostic("msdfTextFrame.transformBufferFailed", transformBuffer.message));
    }
    if (!glyphBuffer.ok) {
        diagnostics.push(bufferDiagnostic("msdfTextFrame.glyphBufferFailed", glyphBuffer.message));
    }
    if (!viewBuffer.ok || !transformBuffer.ok || !glyphBuffer.ok) {
        return { valid: false, commands, diagnostics };
    }
    const defaultSampler = getOrCreateMsdfTextDefaultSampler(options.app, options.cache, options.reuse, diagnostics);
    if (defaultSampler === null) {
        return { valid: false, commands, diagnostics };
    }
    const viewBindGroup = device.createBindGroup({
        label: "MSDFText/ViewBindGroup",
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: viewBuffer.buffer } }],
    });
    const transformBindGroup = device.createBindGroup({
        label: "MSDFText/TransformBindGroup",
        layout: pipeline.getBindGroupLayout(1),
        entries: [{ binding: 0, resource: { buffer: transformBuffer.buffer } }],
    });
    for (const batch of renderInput.batches) {
        const sampler = batch.sampler === undefined || batch.sampler === null
            ? {
                cacheKey: "msdf-text:default-sampler",
                resource: defaultSampler,
            }
            : prepareAppSamplerResource({
                assets: options.assets,
                device: options.app.initialization.device,
                cache: options.cache,
                handle: batch.sampler,
                reuse: options.reuse,
                diagnostics: diagnostics,
            });
        if (sampler === null) {
            continue;
        }
        const texture = prepareAppTextureResource({
            assets: options.assets,
            device: options.app.initialization.device,
            cache: options.cache,
            handle: batch.texture,
            reuse: options.reuse,
            diagnostics: diagnostics,
        });
        if (texture === null) {
            continue;
        }
        const glyphBindGroup = device.createBindGroup({
            label: `MSDFText/GlyphBindGroup/${batch.renderId}`,
            layout: pipeline.getBindGroupLayout(2),
            entries: [
                { binding: 0, resource: { buffer: glyphBuffer.buffer } },
                { binding: 1, resource: texture.resource.view },
                { binding: 2, resource: sampler.resource.sampler },
            ],
        });
        commands.push({
            kind: "setPipeline",
            renderId: batch.renderId,
            pipelineKey: options.pipeline.cacheKey,
            pipeline: options.pipeline.pipeline,
        }, {
            kind: "setBindGroup",
            renderId: batch.renderId,
            index: 0,
            resourceKey: `msdf-text:view:${options.snapshot.frame}`,
            bindGroup: viewBindGroup,
        }, {
            kind: "setBindGroup",
            renderId: batch.renderId,
            index: 1,
            resourceKey: `msdf-text:transforms:${options.snapshot.frame}`,
            bindGroup: transformBindGroup,
        }, {
            kind: "setBindGroup",
            renderId: batch.renderId,
            index: 2,
            resourceKey: `msdf-text:glyphs:${options.snapshot.frame}:${batch.renderId}:${texture.cacheKey}:${sampler.cacheKey}`,
            bindGroup: glyphBindGroup,
        }, {
            kind: "draw",
            renderId: batch.renderId,
            vertexCount: 6,
            instanceCount: batch.instanceCount,
            firstVertex: 0,
            firstInstance: batch.firstInstance,
        });
    }
    return {
        valid: diagnostics.length === 0 && commands.length > 0,
        commands,
        diagnostics,
    };
}
export async function getOrCreateWebGpuAppMsdfTextPipeline(app, cache) {
    const colorFormat = webGpuAppScenePassColorFormat(app);
    const isHdr = webGpuAppUsesHdrScenePass(app);
    const tonemap = isHdr ? "none" : (app.tonemap ?? "none");
    const outputColorSpace = isHdr
        ? "linear"
        : (app.outputColorSpace ?? "linear");
    const key = msdfTextPipelineCacheKey(colorFormat, WEBGPU_APP_DEPTH_FORMAT, app.msaa.sampleCount, tonemap, outputColorSpace);
    const cached = cache.msdfTextPipelines.get(key);
    if (cached !== undefined) {
        return cached;
    }
    const result = await createMsdfTextRenderPipelineResource({
        device: app.initialization.device,
        colorFormat,
        depthFormat: WEBGPU_APP_DEPTH_FORMAT,
        sampleCount: app.msaa.sampleCount,
        tonemap,
        outputColorSpace,
    });
    cache.msdfTextPipelines.set(key, result);
    return result;
}
function createMsdfTextRenderInput(snapshot, diagnostics) {
    const quads = snapshot.quads;
    const quadBatches = msdfTextQuadBatches(snapshot);
    if (quads === undefined) {
        diagnostics.push({
            code: "msdfTextFrame.missingQuadBuffers",
            message: "MSDF text glyph batches require quad snapshot buffers.",
        });
        return {
            data: new Float32Array(0),
            batches: [],
        };
    }
    const instanceCount = quads.instanceFloats.length / quads.instanceFloatStride;
    const data = new Float32Array(instanceCount * GLYPH_RENDER_FLOAT_STRIDE);
    const batches = [];
    for (const batch of quadBatches) {
        if (batch.texture === undefined || batch.texture === null) {
            diagnostics.push({
                code: "msdfTextFrame.quadBatchMissingTexture",
                message: `MSDF text quad batch ${batch.batchId} is missing its atlas texture handle.`,
            });
            continue;
        }
        batches.push({
            renderId: batch.batchId,
            texture: batch.texture,
            ...(batch.sampler === undefined ? {} : { sampler: batch.sampler }),
            firstInstance: batch.firstInstance,
            instanceCount: batch.instanceCount,
        });
    }
    for (let instance = 0; instance < instanceCount; instance += 1) {
        const sourceFloat = instance * quads.instanceFloatStride;
        const sourceWord = instance * quads.instanceWordStride;
        const target = instance * GLYPH_RENDER_FLOAT_STRIDE;
        data[target] = quads.instanceFloats[sourceFloat + 13] ?? 1;
        data[target + 1] = quads.instanceFloats[sourceFloat + 14] ?? 1;
        data[target + 2] = quads.instanceFloats[sourceFloat + 15] ?? 1;
        data[target + 3] = quads.instanceFloats[sourceFloat + 16] ?? 1;
        data[target + 4] = quads.instanceFloats[sourceFloat] ?? 0;
        data[target + 5] = quads.instanceFloats[sourceFloat + 1] ?? 0;
        data[target + 6] = quads.instanceFloats[sourceFloat + 4] ?? 0;
        data[target + 7] = quads.instanceFloats[sourceFloat + 5] ?? 0;
        data[target + 8] = quads.instanceFloats[sourceFloat + 9] ?? 0;
        data[target + 9] = quads.instanceFloats[sourceFloat + 10] ?? 0;
        data[target + 10] = quads.instanceFloats[sourceFloat + 11] ?? 1;
        data[target + 11] = quads.instanceFloats[sourceFloat + 12] ?? 1;
        data[target + 12] = quads.instanceFloats[sourceFloat + 17] ?? 4;
        data[target + 13] = quads.instanceFloats[sourceFloat + 18] ?? 1;
        data[target + 14] = quads.instanceFloats[sourceFloat + 19] ?? 1;
        data[target + 15] = quads.instanceFloats[sourceFloat + 20] ?? 1;
        data[target + 16] = (quads.instanceWords[sourceWord] ?? 0) / 16;
        data[target + 17] = quads.instanceWords[sourceWord + 2] ?? 0;
        data[target + 18] = quads.instanceWords[sourceWord + 5] ?? 0;
        data[target + 19] = quads.instanceWords[sourceWord + 6] ?? 0;
        data[target + 20] = 0;
        data[target + 21] = 0;
        data[target + 22] = 0;
        data[target + 23] = 0;
    }
    return { data, batches };
}
function createMsdfTextViewUniformData(options) {
    const data = new Float32Array(options.source);
    const dimensions = options.canvas === undefined
        ? { width: 1, height: 1 }
        : webGpuAppCanvasDimensions(options.canvas);
    // The text shader uses screen-pixel glyph positions and only needs the
    // viewport vec4 in addition to the shared matrix/camera lanes.
    for (const record of options.viewUniforms.views) {
        const view = options.snapshot.views.find((candidate) => candidate.viewId === record.viewId);
        const viewport = view?.viewport ?? [0, 0, 1, 1];
        const offset = record.packedOffset + TEXT_VIEWPORT_FLOAT_OFFSET;
        if (offset + 3 >= data.length) {
            continue;
        }
        const width = Math.max(1, dimensions.width * (viewport[2] ?? 1));
        const height = Math.max(1, dimensions.height * (viewport[3] ?? 1));
        data[offset] = width;
        data[offset + 1] = height;
        data[offset + 2] = 1 / width;
        data[offset + 3] = 1 / height;
    }
    return data;
}
function msdfTextQuadBatches(snapshot) {
    return (snapshot.quadBatches ?? []).filter((batch) => batch.kind === "glyph");
}
function getOrCreateMsdfTextDefaultSampler(app, cache, reuse, diagnostics) {
    const cacheKey = "msdf-text:default-sampler";
    const cached = cache.samplers.get(cacheKey);
    if (cached !== undefined) {
        reuse.samplerResourcesReused += 1;
        return cached;
    }
    const sampler = createSamplerGpuResource({
        device: app.initialization.device,
        resourceKey: cacheKey,
        sampler: createSamplerAsset({
            label: "MsdfTextDefaultSampler",
            addressModeU: "clamp-to-edge",
            addressModeV: "clamp-to-edge",
            addressModeW: "clamp-to-edge",
            magFilter: "linear",
            minFilter: "linear",
            mipmapFilter: "linear",
            lodMaxClamp: 0,
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
//# sourceMappingURL=text.js.map