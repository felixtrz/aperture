import { assetHandleKey, } from "@aperture-engine/simulation";
import { createSamplerAsset, } from "@aperture-engine/render";
import { createWebGpuBuffer, destroyWebGpuBuffer } from "../gpu/buffer.js";
import { createCommandEncoderResource } from "../gpu/command-encoder.js";
import { finishCommandEncoder } from "../gpu/command-buffer.js";
import { WEBGPU_BUFFER_USAGE_FLAGS } from "../resources/meshes/mesh-buffer-descriptors.js";
import { WEBGPU_APP_DEPTH_FORMAT } from "../resources/textures/depth-texture-resource.js";
import { createSamplerGpuResource, createTextureGpuResource, WEBGPU_TEXTURE_USAGE_FLAGS, } from "../resources/textures/texture-resources.js";
import { submitCommandBuffers } from "../render/queues/queue-submit.js";
import { executeComputePassCommands, } from "../render/passes/compute-pass-commands.js";
import { createParticleComputePipelineResource, createParticleRenderPipelineResource, particleBurstRenderPipelineCacheKey, particleComputePipelineCacheKey, particleRenderPipelineCacheKey, } from "../render/particles/particle-pipeline.js";
import { prepareAppSamplerResource, prepareAppTextureResource, } from "./app-texture-sampler-resources.js";
import { webGpuAppScenePassColorFormat, webGpuAppUsesHdrScenePass, } from "./render-color-format.js";
import { webGpuAppCanvasDimensions } from "./canvas.js";
const PARTICLE_VIEWPORT_FLOAT_OFFSET = 20;
const PARTICLE_DATA_FLOAT_STRIDE = 8;
const PARTICLE_BURST_DATA_FLOAT_STRIDE = 12;
const PARTICLE_CURVE_SAMPLE_COUNT = 16;
const PARTICLE_SIZE_CURVE_FLOAT_OFFSET = 16;
const PARTICLE_COLOR_CURVE_FLOAT_OFFSET = PARTICLE_SIZE_CURVE_FLOAT_OFFSET + PARTICLE_CURVE_SAMPLE_COUNT;
const PARTICLE_PARAM_BYTE_LENGTH = 16 +
    (PARTICLE_COLOR_CURVE_FLOAT_OFFSET + PARTICLE_CURVE_SAMPLE_COUNT * 4) * 4;
const PARTICLE_BURST_RENDER_PARAM_FLOAT_COUNT = 4 + 4 + 4 * 4 + 16 * 4;
const PARTICLE_BURST_SIZE_CURVE_FLOAT_OFFSET = 8;
const PARTICLE_BURST_COLOR_CURVE_FLOAT_OFFSET = PARTICLE_BURST_SIZE_CURVE_FLOAT_OFFSET + PARTICLE_CURVE_SAMPLE_COUNT;
const PARTICLE_DEFAULT_TEXTURE_CACHE_KEY = "particle:default-white-texture";
const PARTICLE_DEFAULT_SAMPLER_CACHE_KEY = "particle:default-linear-sampler";
export async function prepareParticleFrameResourcesForSnapshot(options) {
    const emitters = options.snapshot.particleEmitters ?? [];
    if (emitters.length === 0) {
        const activeKeys = new Set();
        const staleStatesRemoved = cleanupParticleStates(options.cache, activeKeys) +
            cleanupParticleBurstCpuStates(options.cache, activeKeys) +
            cleanupParticleBurstBatchStates(options.cache, activeKeys);
        const report = emptyParticleFrameReport();
        return {
            valid: true,
            commands: [],
            diagnostics: [],
            report: {
                ...report,
                staleStatesRemoved,
            },
        };
    }
    const computePipelineResult = getOrCreateWebGpuAppParticleComputePipeline(options.app, options.cache);
    const computePipeline = isPromiseLike(computePipelineResult)
        ? await computePipelineResult
        : computePipelineResult;
    if (!computePipeline.valid || computePipeline.resource === null) {
        return {
            valid: false,
            commands: [],
            diagnostics: [...computePipeline.diagnostics],
            report: emptyParticleFrameReport(emitters.length),
        };
    }
    return createParticleFrameResources({
        app: options.app,
        assets: options.assets,
        cache: options.cache,
        snapshot: options.snapshot,
        viewUniforms: options.viewUniforms,
        computePipeline: computePipeline.resource,
        ...(options.reuse === undefined ? {} : { reuse: options.reuse }),
        time: options.time ?? 0,
    });
}
export function getOrCreateWebGpuAppParticleComputePipeline(app, cache) {
    const key = particleComputePipelineCacheKey();
    const cached = cache.particleComputePipelines.get(key);
    if (cached !== undefined) {
        return cached;
    }
    return createParticleComputePipelineResource({
        device: app.initialization.device,
    }).then((result) => {
        cache.particleComputePipelines.set(key, result);
        return result;
    });
}
export function getOrCreateWebGpuAppParticleRenderPipeline(app, cache, blendMode) {
    const colorFormat = webGpuAppScenePassColorFormat(app);
    const isHdr = webGpuAppUsesHdrScenePass(app);
    const tonemap = isHdr ? "none" : (app.tonemap ?? "none");
    const outputColorSpace = isHdr
        ? "linear"
        : (app.outputColorSpace ?? "linear");
    const key = particleRenderPipelineCacheKey(colorFormat, WEBGPU_APP_DEPTH_FORMAT, app.msaa.sampleCount, blendMode, tonemap, outputColorSpace);
    const cached = cache.particleRenderPipelines.get(key);
    if (cached !== undefined) {
        return cached;
    }
    return createParticleRenderPipelineResource({
        device: app.initialization.device,
        colorFormat,
        depthFormat: WEBGPU_APP_DEPTH_FORMAT,
        sampleCount: app.msaa.sampleCount,
        blendMode,
        tonemap,
        outputColorSpace,
    }).then((result) => {
        cache.particleRenderPipelines.set(key, result);
        return result;
    });
}
export function getOrCreateWebGpuAppParticleBurstRenderPipeline(app, cache, blendMode) {
    const colorFormat = webGpuAppScenePassColorFormat(app);
    const isHdr = webGpuAppUsesHdrScenePass(app);
    const tonemap = isHdr ? "none" : (app.tonemap ?? "none");
    const outputColorSpace = isHdr
        ? "linear"
        : (app.outputColorSpace ?? "linear");
    const key = particleBurstRenderPipelineCacheKey(colorFormat, WEBGPU_APP_DEPTH_FORMAT, app.msaa.sampleCount, blendMode, tonemap, outputColorSpace);
    const cached = cache.particleRenderPipelines.get(key);
    if (cached !== undefined) {
        return cached;
    }
    return createParticleRenderPipelineResource({
        device: app.initialization.device,
        colorFormat,
        depthFormat: WEBGPU_APP_DEPTH_FORMAT,
        sampleCount: app.msaa.sampleCount,
        blendMode,
        tonemap,
        outputColorSpace,
        variant: "burst",
    }).then((result) => {
        cache.particleRenderPipelines.set(key, result);
        return result;
    });
}
function isPromiseLike(value) {
    return (typeof value === "object" &&
        value !== null &&
        "then" in value &&
        typeof value.then === "function");
}
function getOrCreateParticleViewUniformBuffer(options) {
    const cached = options.cache.particleViewUniformBuffer;
    if (cached !== null && cached.byteLength >= options.data.byteLength) {
        if (options.device.queue?.writeBuffer === undefined) {
            return {
                ok: false,
                message: "Particle view uniform buffer updates require queue.writeBuffer.",
            };
        }
        options.device.queue.writeBuffer(cached.buffer, 0, options.data.buffer, options.data.byteOffset, options.data.byteLength);
        return { ok: true, resource: cached };
    }
    if (cached !== null) {
        destroyWebGpuBuffer(cached.buffer);
    }
    const created = createWebGpuBuffer({
        device: options.device,
        descriptor: {
            label: "Particle/ViewUniforms",
            size: options.data.byteLength,
            usage: WEBGPU_BUFFER_USAGE_FLAGS.UNIFORM | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
            initialData: options.data,
        },
    });
    if (!created.ok) {
        return { ok: false, message: created.message };
    }
    const resource = {
        buffer: created.buffer,
        byteLength: options.data.byteLength,
    };
    options.cache.particleViewUniformBuffer = resource;
    return { ok: true, resource };
}
async function createParticleFrameResources(options) {
    const diagnostics = [];
    const commands = [];
    const report = emptyParticleFrameReport(options.snapshot.particleEmitters?.length ?? 0);
    const mutableReport = report;
    const device = options.app.initialization.device;
    const computePipeline = options.computePipeline.pipeline;
    if (device.createBindGroup === undefined ||
        computePipeline.getBindGroupLayout === undefined) {
        return {
            valid: false,
            commands,
            diagnostics: [
                {
                    code: "particleFrame.missingBindGroupSupport",
                    message: "Particle frame resources require bind groups and pipeline layouts.",
                },
            ],
            report,
        };
    }
    const reuse = options.reuse ?? createParticleTextureSamplerReuseReport();
    const reuseStart = particleTextureSamplerReuseSnapshot(reuse);
    const viewData = viewUniformData(options);
    const viewBuffer = getOrCreateParticleViewUniformBuffer({
        cache: options.cache,
        device,
        data: viewData,
    });
    if (!viewBuffer.ok) {
        return {
            valid: false,
            commands,
            diagnostics: [
                {
                    code: "particleFrame.viewBufferFailed",
                    message: viewBuffer.message,
                },
            ],
            report,
        };
    }
    const activeStateKeys = new Set();
    const activeBurstCpuStateKeys = new Set();
    const activeBurstBatchKeys = new Set();
    const textureSamplerFrameCache = new Map();
    const renderPipelineFrameCache = new Map();
    const emitterResourceFrameCache = new Map();
    const units = [];
    let activeBurstGroup = null;
    for (const emitter of options.snapshot.particleEmitters ?? []) {
        const burstBatchable = isBatchableParticleBurst(emitter);
        const prepared = await prepareParticleEmitterFrameResources({
            app: options.app,
            assets: options.assets,
            cache: options.cache,
            device,
            emitter,
            burstBatchable,
            reuse,
            diagnostics,
            renderPipelineFrameCache,
            textureSamplerFrameCache,
            emitterResourceFrameCache,
        });
        if (prepared === null) {
            continue;
        }
        if (prepared.effect.texture !== undefined &&
            prepared.effect.texture !== null) {
            mutableReport.texturedEmitters += 1;
        }
        const record = {
            emitter,
            effectKey: prepared.effectKey,
            effect: prepared.effect,
            renderPipeline: prepared.renderPipeline,
            renderPipelineResource: prepared.renderPipelineResource,
            textureSampler: prepared.textureSampler,
        };
        if (burstBatchable) {
            const key = particleBurstBatchUnitKey(record);
            if (activeBurstGroup !== null && activeBurstGroup.key === key) {
                activeBurstGroup.records.push(record);
            }
            else {
                activeBurstGroup = {
                    kind: "burstBatch",
                    key,
                    records: [record],
                };
                units.push(activeBurstGroup);
            }
            continue;
        }
        activeBurstGroup = null;
        units.push({ kind: "single", record });
    }
    for (const unit of units) {
        if (unit.kind === "burstBatch") {
            const batchReport = writeParticleBurstBatchCommands({
                cache: options.cache,
                device,
                viewBuffer: viewBuffer.resource.buffer,
                frame: options.snapshot.frame,
                time: options.time,
                unit,
                activeBurstCpuStateKeys,
                activeBurstBatchKeys,
                commands,
            });
            diagnostics.push(...batchReport.diagnostics);
            mutableReport.liveParticles += batchReport.liveParticles;
            mutableReport.statesCreated += batchReport.statesCreated;
            mutableReport.statesReused += batchReport.statesReused;
            continue;
        }
        const record = unit.record;
        const stateResult = getOrCreateParticleEmitterGpuState({
            cache: options.cache,
            device,
            emitter: record.emitter,
        });
        if (!stateResult.valid || stateResult.state === null) {
            diagnostics.push(...stateResult.diagnostics);
            continue;
        }
        activeStateKeys.add(stateResult.state.key);
        mutableReport.statesCreated += stateResult.created ? 1 : 0;
        mutableReport.statesReused += stateResult.created ? 0 : 1;
        let drawInstanceCount = record.emitter.capacity;
        if (record.emitter.mode === "burst" && record.emitter.burst !== undefined) {
            const burstReport = updateParticleBurstCpuState({
                device,
                state: stateResult.state,
                emitter: record.emitter,
                effect: record.effect,
                time: options.time,
            });
            diagnostics.push(...burstReport.diagnostics);
            drawInstanceCount = burstReport.liveParticles;
        }
        else {
            const params = createParticleParamData({
                emitter: record.emitter,
                effect: record.effect,
                snapshot: options.snapshot,
                frame: options.snapshot.frame,
                time: options.time,
            });
            const paramBuffer = createWebGpuBuffer({
                device,
                descriptor: {
                    label: `Particle/Params/${record.emitter.emitterId}`,
                    size: params.byteLength,
                    usage: WEBGPU_BUFFER_USAGE_FLAGS.UNIFORM |
                        WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
                    initialData: params,
                },
            });
            if (!paramBuffer.ok) {
                diagnostics.push({
                    code: "particleFrame.paramBufferFailed",
                    message: paramBuffer.message,
                });
                continue;
            }
            const computeBindGroup = device.createBindGroup({
                label: `Particle/ComputeBindGroup/${record.emitter.emitterId}`,
                layout: computePipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: { buffer: paramBuffer.buffer } },
                    {
                        binding: 1,
                        resource: { buffer: stateResult.state.particleBuffer },
                    },
                ],
            });
            const computeReport = submitParticleComputePass({
                device,
                pipeline: options.computePipeline,
                bindGroup: computeBindGroup,
                emitter: record.emitter,
            });
            diagnostics.push(...computeReport.diagnostics);
            mutableReport.dispatches += computeReport.dispatches;
        }
        if (drawInstanceCount <= 0) {
            continue;
        }
        const viewBindGroup = device.createBindGroup({
            label: `Particle/ViewBindGroup/${record.emitter.emitterId}`,
            layout: record.renderPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: viewBuffer.resource.buffer } },
            ],
        });
        mutableReport.liveParticles += drawInstanceCount;
        const particleBindGroup = device.createBindGroup({
            label: `Particle/RenderBindGroup/${record.emitter.emitterId}`,
            layout: record.renderPipeline.getBindGroupLayout(1),
            entries: [
                { binding: 0, resource: { buffer: stateResult.state.particleBuffer } },
            ],
        });
        const textureBindGroup = device.createBindGroup({
            label: `Particle/TextureBindGroup/${record.emitter.emitterId}`,
            layout: record.renderPipeline.getBindGroupLayout(2),
            entries: [
                { binding: 0, resource: record.textureSampler.texture.view },
                { binding: 1, resource: record.textureSampler.sampler.sampler },
            ],
        });
        commands.push({
            kind: "setPipeline",
            renderId: record.emitter.emitterId,
            pipelineKey: record.renderPipelineResource.cacheKey,
            pipeline: record.renderPipelineResource.pipeline,
        }, {
            kind: "setBindGroup",
            renderId: record.emitter.emitterId,
            index: 0,
            resourceKey: `particle:view:${options.snapshot.frame}`,
            bindGroup: viewBindGroup,
        }, {
            kind: "setBindGroup",
            renderId: record.emitter.emitterId,
            index: 1,
            resourceKey: stateResult.state.key,
            bindGroup: particleBindGroup,
        }, {
            kind: "setBindGroup",
            renderId: record.emitter.emitterId,
            index: 2,
            resourceKey: `${record.textureSampler.textureKey}:${record.textureSampler.samplerKey}`,
            bindGroup: textureBindGroup,
        }, {
            kind: "draw",
            renderId: record.emitter.emitterId,
            vertexCount: 6,
            instanceCount: drawInstanceCount,
            firstVertex: 0,
            firstInstance: 0,
        });
    }
    mutableReport.textureResourcesCreated +=
        reuse.textureResourcesCreated - reuseStart.textureResourcesCreated;
    mutableReport.textureResourcesReused +=
        reuse.textureResourcesReused - reuseStart.textureResourcesReused;
    mutableReport.samplerResourcesCreated +=
        reuse.samplerResourcesCreated - reuseStart.samplerResourcesCreated;
    mutableReport.samplerResourcesReused +=
        reuse.samplerResourcesReused - reuseStart.samplerResourcesReused;
    mutableReport.staleStatesRemoved = cleanupParticleStates(options.cache, activeStateKeys);
    mutableReport.staleStatesRemoved += cleanupParticleBurstCpuStates(options.cache, activeBurstCpuStateKeys);
    mutableReport.staleStatesRemoved += cleanupParticleBurstBatchStates(options.cache, activeBurstBatchKeys);
    return {
        valid: diagnostics.length === 0,
        commands,
        diagnostics,
        report,
    };
}
async function prepareParticleEmitterFrameResources(options) {
    const effectKey = assetHandleKey(options.emitter.effect);
    const cacheKey = `${effectKey}@${options.emitter.effectVersion}:${options.burstBatchable ? "burst" : "computed"}`;
    const cached = options.emitterResourceFrameCache.get(cacheKey);
    if (cached !== undefined) {
        return cached;
    }
    const effectEntry = options.assets.get(options.emitter.effect);
    const effect = effectEntry?.asset;
    if (effectEntry?.status !== "ready" ||
        effect === undefined ||
        effect === null) {
        options.diagnostics.push({
            code: "particleFrame.effectNotReady",
            message: `Particle effect '${effectKey}' is not ready.`,
        });
        options.emitterResourceFrameCache.set(cacheKey, null);
        return null;
    }
    const renderPipelineFrameKey = `${effect.blendMode}:${options.burstBatchable ? "burst" : "computed"}`;
    let renderPipelineResult = options.renderPipelineFrameCache.get(renderPipelineFrameKey);
    if (renderPipelineResult === undefined) {
        const pipelineResult = options.burstBatchable
            ? getOrCreateWebGpuAppParticleBurstRenderPipeline(options.app, options.cache, effect.blendMode)
            : getOrCreateWebGpuAppParticleRenderPipeline(options.app, options.cache, effect.blendMode);
        renderPipelineResult = isPromiseLike(pipelineResult)
            ? await pipelineResult
            : pipelineResult;
        options.renderPipelineFrameCache.set(renderPipelineFrameKey, renderPipelineResult);
    }
    if (!renderPipelineResult.valid || renderPipelineResult.resource === null) {
        options.diagnostics.push(...renderPipelineResult.diagnostics);
        options.emitterResourceFrameCache.set(cacheKey, null);
        return null;
    }
    const renderPipelineResource = renderPipelineResult.resource;
    const renderPipeline = renderPipelineResource.pipeline;
    if (renderPipeline.getBindGroupLayout === undefined) {
        options.diagnostics.push({
            code: "particleFrame.missingBindGroupSupport",
            message: "Particle render pipeline does not expose bind-group layouts.",
        });
        options.emitterResourceFrameCache.set(cacheKey, null);
        return null;
    }
    const textureSamplerCacheKey = particleTextureSamplerFrameCacheKey(effect);
    let textureSampler = options.textureSamplerFrameCache.get(textureSamplerCacheKey) ?? null;
    if (textureSampler === null) {
        textureSampler = prepareParticleTextureSamplerResources({
            assets: options.assets,
            cache: options.cache,
            device: options.device,
            effect,
            reuse: options.reuse,
            diagnostics: options.diagnostics,
        });
        if (textureSampler !== null) {
            options.textureSamplerFrameCache.set(textureSamplerCacheKey, textureSampler);
        }
    }
    if (textureSampler === null) {
        options.emitterResourceFrameCache.set(cacheKey, null);
        return null;
    }
    const prepared = {
        effectKey,
        effect,
        renderPipeline: renderPipeline,
        renderPipelineResource,
        textureSampler,
    };
    options.emitterResourceFrameCache.set(cacheKey, prepared);
    return prepared;
}
function isBatchableParticleBurst(emitter) {
    return (emitter.mode === "burst" &&
        emitter.burst !== undefined &&
        emitter.simulationSpace === "world" &&
        emitter.capacity > 0);
}
function particleTextureSamplerFrameCacheKey(effect) {
    const textureKey = effect.texture === undefined || effect.texture === null
        ? PARTICLE_DEFAULT_TEXTURE_CACHE_KEY
        : assetHandleKey(effect.texture);
    const samplerKey = effect.sampler === undefined || effect.sampler === null
        ? PARTICLE_DEFAULT_SAMPLER_CACHE_KEY
        : assetHandleKey(effect.sampler);
    return `${textureKey}:${samplerKey}`;
}
function particleBurstBatchUnitKey(record) {
    const { emitter, textureSampler } = record;
    return [
        "particle-burst-batch",
        `effect:${record.effectKey}@${emitter.effectVersion}`,
        `pipeline:${record.renderPipelineResource.cacheKey}`,
        `texture:${textureSampler.textureKey}`,
        `sampler:${textureSampler.samplerKey}`,
        `view:${emitter.sortKey.viewId}`,
        `layer-mask:${emitter.layerMask}`,
        `sort-layer:${emitter.sortKey.layer}`,
        `order:${emitter.sortKey.order}`,
    ].join("|");
}
function writeParticleBurstBatchCommands(options) {
    const first = options.unit.records[0];
    if (first === undefined) {
        return {
            liveParticles: 0,
            statesCreated: 0,
            statesReused: 0,
            diagnostics: [],
        };
    }
    if (options.device.createBindGroup === undefined ||
        options.device.queue?.writeBuffer === undefined) {
        return {
            liveParticles: 0,
            statesCreated: 0,
            statesReused: 0,
            diagnostics: [
                {
                    code: "particleFrame.burstBatchUnavailable",
                    message: "Particle burst batching requires bind groups and queue.writeBuffer.",
                },
            ],
        };
    }
    const diagnostics = [];
    const liveSlices = [];
    const activeSlotKeys = new Set();
    let totalCapacity = 0;
    let totalLiveParticles = 0;
    let statesCreated = 0;
    let statesReused = 0;
    for (const record of options.unit.records) {
        const capacity = Math.max(0, Math.trunc(record.emitter.capacity));
        totalCapacity += capacity;
        const cpuState = getOrCreateParticleBurstCpuState({
            cache: options.cache,
            emitter: record.emitter,
        });
        const slotKey = cpuState.key;
        options.activeBurstCpuStateKeys.add(cpuState.key);
        activeSlotKeys.add(slotKey);
        statesCreated += cpuState.created ? 1 : 0;
        statesReused += cpuState.created ? 0 : 1;
        const update = updateParticleBurstAnalyticCpuData({
            cpu: cpuState.cpu,
            emitter: record.emitter,
            effect: record.effect,
            time: options.time,
        });
        diagnostics.push(...update.diagnostics);
        if (update.liveParticles <= 0) {
            continue;
        }
        totalLiveParticles += update.liveParticles;
        liveSlices.push({
            key: slotKey,
            cpu: cpuState.cpu,
            emitter: record.emitter,
            effect: record.effect,
            liveParticles: update.liveParticles,
            capacity,
        });
    }
    if (totalLiveParticles <= 0) {
        return {
            liveParticles: 0,
            statesCreated,
            statesReused,
            diagnostics,
        };
    }
    const batchState = getOrCreateParticleBurstBatchGpuState({
        cache: options.cache,
        device: options.device,
        key: options.unit.key,
        capacity: Math.max(totalCapacity, totalLiveParticles),
    });
    if (!batchState.valid || batchState.state === null) {
        return {
            liveParticles: 0,
            statesCreated,
            statesReused,
            diagnostics: [...diagnostics, ...batchState.diagnostics],
        };
    }
    options.activeBurstBatchKeys.add(batchState.state.key);
    statesCreated += batchState.created ? 1 : 0;
    statesReused += batchState.created ? 0 : 1;
    releaseInactiveParticleBurstBatchSlots(batchState.state, activeSlotKeys);
    const activeDrawRanges = [];
    const uploadRanges = [];
    for (const slice of liveSlices) {
        const slot = acquireParticleBurstBatchSlot(batchState.state, slice.key, slice.capacity);
        if (slot === null) {
            diagnostics.push({
                code: "particleFrame.burstBatchSlotUnavailable",
                message: "Particle burst batch did not have enough contiguous slot capacity.",
            });
            continue;
        }
        if (slot.created) {
            const upload = writeParticleBurstInitialSlotData({
                state: batchState.state,
                slot: slot.slot,
                cpu: slice.cpu,
                emitter: slice.emitter,
            });
            uploadRanges.push(upload);
        }
        activeDrawRanges.push({
            firstInstance: slot.slot.offset,
            instanceCount: slot.slot.capacity,
        });
    }
    const drawRanges = mergeParticleBurstDrawRanges(activeDrawRanges);
    if (drawRanges.length === 0) {
        return {
            liveParticles: totalLiveParticles,
            statesCreated,
            statesReused,
            diagnostics,
        };
    }
    for (const upload of mergeParticleBurstUploadRanges(uploadRanges)) {
        options.device.queue.writeBuffer(batchState.state.particleBuffer, upload.byteOffset, batchState.state.bufferData.buffer, batchState.state.bufferData.byteOffset + upload.byteOffset, upload.byteLength);
    }
    const params = getOrUpdateParticleBurstRenderParams({
        device: options.device,
        state: batchState.state,
        effect: first.effect,
        time: options.time,
    });
    if (!params.valid) {
        return {
            liveParticles: 0,
            statesCreated,
            statesReused,
            diagnostics: [...diagnostics, ...params.diagnostics],
        };
    }
    if (params.buffer === null) {
        return {
            liveParticles: 0,
            statesCreated,
            statesReused,
            diagnostics: [
                ...diagnostics,
                {
                    code: "particleFrame.burstParamBufferMissing",
                    message: "Particle burst render params did not return a buffer.",
                },
            ],
        };
    }
    const viewBindGroup = options.device.createBindGroup({
        label: `Particle/BurstBatchViewBindGroup/${first.emitter.emitterId}`,
        layout: first.renderPipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: options.viewBuffer } }],
    });
    const particleBindGroup = options.device.createBindGroup({
        label: `Particle/BurstBatchRenderBindGroup/${first.emitter.emitterId}`,
        layout: first.renderPipeline.getBindGroupLayout(1),
        entries: [
            { binding: 0, resource: { buffer: batchState.state.particleBuffer } },
        ],
    });
    const textureBindGroup = options.device.createBindGroup({
        label: `Particle/BurstBatchTextureBindGroup/${first.emitter.emitterId}`,
        layout: first.renderPipeline.getBindGroupLayout(2),
        entries: [
            { binding: 0, resource: first.textureSampler.texture.view },
            { binding: 1, resource: first.textureSampler.sampler.sampler },
        ],
    });
    const paramsBindGroup = options.device.createBindGroup({
        label: `Particle/BurstBatchParamsBindGroup/${first.emitter.emitterId}`,
        layout: first.renderPipeline.getBindGroupLayout(3),
        entries: [{ binding: 0, resource: { buffer: params.buffer } }],
    });
    options.commands.push({
        kind: "setPipeline",
        renderId: first.emitter.emitterId,
        pipelineKey: first.renderPipelineResource.cacheKey,
        pipeline: first.renderPipelineResource.pipeline,
    }, {
        kind: "setBindGroup",
        renderId: first.emitter.emitterId,
        index: 0,
        resourceKey: `particle:view:${options.frame}`,
        bindGroup: viewBindGroup,
    }, {
        kind: "setBindGroup",
        renderId: first.emitter.emitterId,
        index: 1,
        resourceKey: batchState.state.key,
        bindGroup: particleBindGroup,
    }, {
        kind: "setBindGroup",
        renderId: first.emitter.emitterId,
        index: 2,
        resourceKey: `${first.textureSampler.textureKey}:${first.textureSampler.samplerKey}`,
        bindGroup: textureBindGroup,
    }, {
        kind: "setBindGroup",
        renderId: first.emitter.emitterId,
        index: 3,
        resourceKey: `${batchState.state.key}:params`,
        bindGroup: paramsBindGroup,
    });
    for (const range of drawRanges) {
        options.commands.push({
            kind: "draw",
            renderId: first.emitter.emitterId,
            vertexCount: 6,
            instanceCount: range.instanceCount,
            firstVertex: 0,
            firstInstance: range.firstInstance,
        });
    }
    return {
        liveParticles: totalLiveParticles,
        statesCreated,
        statesReused,
        diagnostics,
    };
}
function mergeParticleBurstDrawRanges(ranges) {
    if (ranges.length <= 1) {
        return ranges;
    }
    const sorted = particleBurstDrawRangesAreOrdered(ranges)
        ? ranges
        : [...ranges].sort((a, b) => a.firstInstance - b.firstInstance);
    const merged = [];
    let currentStart = sorted[0]?.firstInstance ?? 0;
    let currentEnd = currentStart + Math.max(0, sorted[0]?.instanceCount ?? 0);
    for (let index = 1; index < sorted.length; index += 1) {
        const range = sorted[index];
        if (range === undefined || range.instanceCount <= 0) {
            continue;
        }
        const rangeEnd = range.firstInstance + range.instanceCount;
        if (range.firstInstance <= currentEnd) {
            currentEnd = Math.max(currentEnd, rangeEnd);
            continue;
        }
        merged.push({
            firstInstance: currentStart,
            instanceCount: currentEnd - currentStart,
        });
        currentStart = range.firstInstance;
        currentEnd = rangeEnd;
    }
    if (currentEnd > currentStart) {
        merged.push({
            firstInstance: currentStart,
            instanceCount: currentEnd - currentStart,
        });
    }
    return merged;
}
function particleBurstDrawRangesAreOrdered(ranges) {
    let previous = ranges[0]?.firstInstance ?? 0;
    for (let index = 1; index < ranges.length; index += 1) {
        const current = ranges[index]?.firstInstance ?? previous;
        if (current < previous) {
            return false;
        }
        previous = current;
    }
    return true;
}
function prepareParticleTextureSamplerResources(options) {
    const texture = options.effect.texture === undefined || options.effect.texture === null
        ? getOrCreateDefaultParticleTexture({
            cache: options.cache,
            device: options.device,
            reuse: options.reuse,
            diagnostics: options.diagnostics,
        })
        : prepareAppTextureResource({
            assets: options.assets,
            device: options.device,
            cache: options.cache,
            handle: options.effect.texture,
            reuse: options.reuse,
            diagnostics: options.diagnostics,
        });
    const sampler = options.effect.sampler === undefined || options.effect.sampler === null
        ? getOrCreateDefaultParticleSampler({
            cache: options.cache,
            device: options.device,
            reuse: options.reuse,
            diagnostics: options.diagnostics,
        })
        : prepareAppSamplerResource({
            assets: options.assets,
            device: options.device,
            cache: options.cache,
            handle: options.effect.sampler,
            reuse: options.reuse,
            diagnostics: options.diagnostics,
        });
    if (texture === null || sampler === null) {
        return null;
    }
    return {
        texture: texture.resource,
        sampler: sampler.resource,
        textureKey: texture.cacheKey,
        samplerKey: sampler.cacheKey,
    };
}
function getOrCreateDefaultParticleTexture(options) {
    const cached = options.cache.textures.get(PARTICLE_DEFAULT_TEXTURE_CACHE_KEY);
    if (cached !== undefined) {
        options.reuse.textureResourcesReused += 1;
        return {
            cacheKey: PARTICLE_DEFAULT_TEXTURE_CACHE_KEY,
            resource: cached,
        };
    }
    const result = createTextureGpuResource({
        device: options.device,
        resourceKey: "texture:__aperture_particle_default_white",
        descriptor: {
            label: "Particle default white texture",
            size: [1, 1, 1],
            format: "rgba8unorm-srgb",
            usage: WEBGPU_TEXTURE_USAGE_FLAGS.TEXTURE_BINDING |
                WEBGPU_TEXTURE_USAGE_FLAGS.COPY_DST,
            colorSpace: "srgb",
            semantic: "base-color",
            mipLevelCount: 1,
        },
        upload: {
            data: new Uint8Array([255, 255, 255, 255]),
            bytesPerRow: 4,
        },
    });
    options.diagnostics.push(...result.diagnostics);
    if (!result.valid || result.resource === null) {
        return null;
    }
    options.cache.textures.set(PARTICLE_DEFAULT_TEXTURE_CACHE_KEY, result.resource);
    options.reuse.textureResourcesCreated += 1;
    return {
        cacheKey: PARTICLE_DEFAULT_TEXTURE_CACHE_KEY,
        resource: result.resource,
    };
}
function getOrCreateDefaultParticleSampler(options) {
    const cached = options.cache.samplers.get(PARTICLE_DEFAULT_SAMPLER_CACHE_KEY);
    if (cached !== undefined) {
        options.reuse.samplerResourcesReused += 1;
        return {
            cacheKey: PARTICLE_DEFAULT_SAMPLER_CACHE_KEY,
            resource: cached,
        };
    }
    const result = createSamplerGpuResource({
        device: options.device,
        resourceKey: "sampler:__aperture_particle_default_linear",
        sampler: createSamplerAsset({
            label: "Particle default linear sampler",
            addressModeU: "clamp-to-edge",
            addressModeV: "clamp-to-edge",
            addressModeW: "clamp-to-edge",
            magFilter: "linear",
            minFilter: "linear",
            mipmapFilter: "nearest",
            lodMaxClamp: 0,
        }),
    });
    options.diagnostics.push(...result.diagnostics);
    if (!result.valid || result.resource === null) {
        return null;
    }
    options.cache.samplers.set(PARTICLE_DEFAULT_SAMPLER_CACHE_KEY, result.resource);
    options.reuse.samplerResourcesCreated += 1;
    return {
        cacheKey: PARTICLE_DEFAULT_SAMPLER_CACHE_KEY,
        resource: result.resource,
    };
}
function getOrCreateParticleEmitterGpuState(options) {
    const key = particleEmitterStateKey(options.emitter);
    const cached = options.cache.particleEmitterStates.get(key);
    if (cached !== undefined) {
        return { valid: true, state: cached, created: false, diagnostics: [] };
    }
    const byteLength = options.emitter.capacity * PARTICLE_DATA_FLOAT_STRIDE * 4;
    const zero = new Float32Array(options.emitter.capacity * PARTICLE_DATA_FLOAT_STRIDE);
    const buffer = createWebGpuBuffer({
        device: options.device,
        descriptor: {
            label: `Particle/State/${options.emitter.emitterId}`,
            size: byteLength,
            usage: WEBGPU_BUFFER_USAGE_FLAGS.STORAGE | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
            initialData: zero,
        },
    });
    if (!buffer.ok) {
        return {
            valid: false,
            state: null,
            created: false,
            diagnostics: [
                {
                    code: "particleFrame.stateBufferFailed",
                    message: buffer.message,
                },
            ],
        };
    }
    const state = {
        key,
        emitterId: options.emitter.emitterId,
        effectVersion: options.emitter.effectVersion,
        capacity: options.emitter.capacity,
        resetEpoch: options.emitter.resetEpoch,
        particleBuffer: buffer.buffer,
        byteLength,
        ...(options.emitter.mode === "burst"
            ? { cpu: createParticleEmitterCpuState(options.emitter.capacity) }
            : {}),
    };
    options.cache.particleEmitterStates.set(key, state);
    return { valid: true, state, created: true, diagnostics: [] };
}
function getOrCreateParticleBurstCpuState(options) {
    const key = particleEmitterStateKey(options.emitter);
    const cached = options.cache.particleBurstCpuStates.get(key);
    if (cached !== undefined) {
        return { key, cpu: cached, created: false };
    }
    const cpu = createParticleEmitterCpuState(options.emitter.capacity);
    options.cache.particleBurstCpuStates.set(key, cpu);
    return { key, cpu, created: true };
}
function getOrCreateParticleBurstBatchGpuState(options) {
    const capacity = nextPowerOfTwo(Math.max(1, Math.trunc(options.capacity)));
    const cached = options.cache.particleBurstBatchStates.get(options.key);
    if (cached !== undefined && cached.capacity >= capacity) {
        return { valid: true, state: cached, created: false, diagnostics: [] };
    }
    if (cached !== undefined) {
        destroyWebGpuBuffer(cached.particleBuffer);
    }
    const byteLength = capacity * PARTICLE_BURST_DATA_FLOAT_STRIDE * 4;
    const buffer = createWebGpuBuffer({
        device: options.device,
        descriptor: {
            label: `Particle/BurstBatch/${options.key}`,
            size: byteLength,
            usage: WEBGPU_BUFFER_USAGE_FLAGS.STORAGE | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
        },
    });
    if (!buffer.ok) {
        return {
            valid: false,
            state: null,
            created: false,
            diagnostics: [
                {
                    code: "particleFrame.burstBatchBufferFailed",
                    message: buffer.message,
                },
            ],
        };
    }
    const state = {
        key: options.key,
        capacity,
        particleBuffer: buffer.buffer,
        byteLength,
        bufferData: new Float32Array(capacity * PARTICLE_BURST_DATA_FLOAT_STRIDE),
        slotsByBurstKey: new Map(),
        freeSlots: [],
        nextParticleSlot: 0,
        paramBuffer: null,
        paramByteLength: 0,
        paramData: null,
    };
    options.cache.particleBurstBatchStates.set(options.key, state);
    return { valid: true, state, created: true, diagnostics: [] };
}
function releaseInactiveParticleBurstBatchSlots(state, activeKeys) {
    for (const [key, slot] of state.slotsByBurstKey) {
        if (activeKeys.has(key)) {
            continue;
        }
        state.slotsByBurstKey.delete(key);
        state.freeSlots.push({ offset: slot.offset, capacity: slot.capacity });
    }
}
function acquireParticleBurstBatchSlot(state, key, capacity) {
    const cached = state.slotsByBurstKey.get(key);
    if (cached !== undefined) {
        return { slot: cached, created: false };
    }
    const requestedCapacity = Math.max(1, Math.trunc(capacity));
    for (let index = 0; index < state.freeSlots.length; index += 1) {
        const free = state.freeSlots[index];
        if (free === undefined || free.capacity < requestedCapacity) {
            continue;
        }
        state.freeSlots.splice(index, 1);
        if (free.capacity > requestedCapacity) {
            state.freeSlots.push({
                offset: free.offset + requestedCapacity,
                capacity: free.capacity - requestedCapacity,
            });
        }
        const slot = {
            key,
            offset: free.offset,
            capacity: requestedCapacity,
        };
        state.slotsByBurstKey.set(key, slot);
        return { slot, created: true };
    }
    if (state.nextParticleSlot + requestedCapacity > state.capacity) {
        return null;
    }
    const slot = {
        key,
        offset: state.nextParticleSlot,
        capacity: requestedCapacity,
    };
    state.nextParticleSlot += requestedCapacity;
    state.slotsByBurstKey.set(key, slot);
    return { slot, created: true };
}
function writeParticleBurstInitialSlotData(options) {
    const startFloat = options.slot.offset * PARTICLE_BURST_DATA_FLOAT_STRIDE;
    const particleCount = Math.min(options.slot.capacity, options.cpu.ages.length);
    for (let index = 0; index < particleCount; index += 1) {
        const sourceOffset = index * 3;
        const outputOffset = startFloat + index * PARTICLE_BURST_DATA_FLOAT_STRIDE;
        options.state.bufferData[outputOffset] =
            options.cpu.positions[sourceOffset] ?? 0;
        options.state.bufferData[outputOffset + 1] =
            options.cpu.positions[sourceOffset + 1] ?? 0;
        options.state.bufferData[outputOffset + 2] =
            options.cpu.positions[sourceOffset + 2] ?? 0;
        options.state.bufferData[outputOffset + 3] = options.cpu.startTime;
        options.state.bufferData[outputOffset + 4] =
            options.cpu.velocities[sourceOffset] ?? 0;
        options.state.bufferData[outputOffset + 5] =
            options.cpu.velocities[sourceOffset + 1] ?? 0;
        options.state.bufferData[outputOffset + 6] =
            options.cpu.velocities[sourceOffset + 2] ?? 0;
        options.state.bufferData[outputOffset + 7] =
            options.cpu.lifetimes[index] ?? 0.001;
        options.state.bufferData[outputOffset + 8] =
            options.cpu.baseSizes[index] ?? 1;
        options.state.bufferData[outputOffset + 9] = options.emitter.timeScale;
        options.state.bufferData[outputOffset + 10] = 0;
        options.state.bufferData[outputOffset + 11] = 0;
    }
    const byteOffset = startFloat * Float32Array.BYTES_PER_ELEMENT;
    const byteLength = particleCount *
        PARTICLE_BURST_DATA_FLOAT_STRIDE *
        Float32Array.BYTES_PER_ELEMENT;
    return { byteOffset, byteLength };
}
function mergeParticleBurstUploadRanges(ranges) {
    if (ranges.length <= 1) {
        return ranges;
    }
    const sorted = particleBurstUploadRangesAreOrdered(ranges)
        ? ranges
        : [...ranges].sort((a, b) => a.byteOffset - b.byteOffset);
    const merged = [];
    let currentOffset = sorted[0]?.byteOffset ?? 0;
    let currentEnd = currentOffset + (sorted[0]?.byteLength ?? 0);
    for (let index = 1; index < sorted.length; index += 1) {
        const range = sorted[index];
        if (range === undefined) {
            continue;
        }
        const rangeEnd = range.byteOffset + range.byteLength;
        if (range.byteOffset <= currentEnd) {
            currentEnd = Math.max(currentEnd, rangeEnd);
            continue;
        }
        merged.push({
            byteOffset: currentOffset,
            byteLength: currentEnd - currentOffset,
        });
        currentOffset = range.byteOffset;
        currentEnd = rangeEnd;
    }
    merged.push({
        byteOffset: currentOffset,
        byteLength: currentEnd - currentOffset,
    });
    return merged;
}
function particleBurstUploadRangesAreOrdered(ranges) {
    let previous = ranges[0]?.byteOffset ?? 0;
    for (let index = 1; index < ranges.length; index += 1) {
        const current = ranges[index]?.byteOffset ?? previous;
        if (current < previous) {
            return false;
        }
        previous = current;
    }
    return true;
}
function getOrUpdateParticleBurstRenderParams(options) {
    if (options.device.queue?.writeBuffer === undefined) {
        return {
            valid: false,
            buffer: null,
            diagnostics: [
                {
                    code: "particleFrame.burstParamWriteUnavailable",
                    message: "Particle burst render params require queue.writeBuffer.",
                },
            ],
        };
    }
    const data = options.state.paramData?.length === PARTICLE_BURST_RENDER_PARAM_FLOAT_COUNT
        ? options.state.paramData
        : new Float32Array(PARTICLE_BURST_RENDER_PARAM_FLOAT_COUNT);
    data[0] = options.time;
    data[1] = options.effect.gravity[0];
    data[2] = options.effect.gravity[1];
    data[3] = options.effect.gravity[2];
    data[4] = options.effect.linearDamping;
    data[5] = 0;
    data[6] = 0;
    data[7] = 0;
    writeParticleBurstRenderCurveData(data, options.effect);
    if (options.state.paramBuffer !== null &&
        options.state.paramByteLength === data.byteLength) {
        options.device.queue.writeBuffer(options.state.paramBuffer, 0, data.buffer, data.byteOffset, data.byteLength);
        options.state.paramData = data;
        return {
            valid: true,
            buffer: options.state.paramBuffer,
            diagnostics: [],
        };
    }
    if (options.state.paramBuffer !== null) {
        destroyWebGpuBuffer(options.state.paramBuffer);
    }
    const buffer = createWebGpuBuffer({
        device: options.device,
        descriptor: {
            label: `Particle/BurstBatchParams/${options.state.key}`,
            size: data.byteLength,
            usage: WEBGPU_BUFFER_USAGE_FLAGS.UNIFORM | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
            initialData: data,
        },
    });
    if (!buffer.ok) {
        return {
            valid: false,
            buffer: null,
            diagnostics: [
                {
                    code: "particleFrame.burstParamBufferFailed",
                    message: buffer.message,
                },
            ],
        };
    }
    options.state.paramBuffer = buffer.buffer;
    options.state.paramByteLength = data.byteLength;
    options.state.paramData = data;
    return { valid: true, buffer: buffer.buffer, diagnostics: [] };
}
function createParticleEmitterCpuState(capacity) {
    return {
        positions: new Float32Array(capacity * 3),
        velocities: new Float32Array(capacity * 3),
        ages: new Float32Array(capacity),
        lifetimes: new Float32Array(capacity),
        baseSizes: new Float32Array(capacity),
        bufferData: new Float32Array(capacity * PARTICLE_DATA_FLOAT_STRIDE),
        initialized: false,
        startTime: 0,
        lastTime: 0,
        liveCount: 0,
        maxLifetime: 0,
        uniformLifetime: false,
    };
}
function updateParticleBurstAnalyticCpuData(options) {
    if (options.emitter.burst === undefined) {
        return {
            liveParticles: 0,
            diagnostics: [
                {
                    code: "particleFrame.burstStateMissing",
                    message: "Particle burst packet is missing burst parameters.",
                },
            ],
        };
    }
    ensureParticleBurstCpuInitialized(options);
    const elapsed = Math.max(0, options.time - options.cpu.startTime);
    const scaledElapsed = elapsed * options.emitter.timeScale;
    const maxLifetime = Math.max(options.cpu.maxLifetime, 0.001);
    if (options.cpu.uniformLifetime) {
        const live = scaledElapsed < maxLifetime ? options.cpu.lifetimes.length : 0;
        options.cpu.liveCount = live;
        return { liveParticles: live, diagnostics: [] };
    }
    let live = 0;
    for (let index = 0; index < options.cpu.lifetimes.length; index += 1) {
        if (scaledElapsed < (options.cpu.lifetimes[index] ?? 0)) {
            live += 1;
        }
    }
    options.cpu.liveCount = live;
    return { liveParticles: live, diagnostics: [] };
}
function updateParticleBurstCpuState(options) {
    const cpu = options.state.cpu;
    if (cpu === undefined) {
        return {
            liveParticles: 0,
            diagnostics: [
                {
                    code: "particleFrame.burstStateMissing",
                    message: "Particle burst packet is missing renderer CPU state.",
                },
            ],
        };
    }
    if (options.device.queue?.writeBuffer === undefined) {
        return {
            liveParticles: 0,
            diagnostics: [
                {
                    code: "particleFrame.burstWriteBufferUnavailable",
                    message: "Particle burst simulation requires queue.writeBuffer.",
                },
            ],
        };
    }
    const update = updateParticleBurstCpuData({
        cpu,
        emitter: options.emitter,
        effect: options.effect,
        time: options.time,
    });
    if (update.liveParticles > 0) {
        options.device.queue.writeBuffer(options.state.particleBuffer, 0, cpu.bufferData.buffer, cpu.bufferData.byteOffset, update.liveParticles * PARTICLE_DATA_FLOAT_STRIDE * 4);
    }
    return update;
}
function updateParticleBurstCpuData(options) {
    if (options.emitter.burst === undefined) {
        return {
            liveParticles: 0,
            diagnostics: [
                {
                    code: "particleFrame.burstStateMissing",
                    message: "Particle burst packet is missing burst parameters.",
                },
            ],
        };
    }
    ensureParticleBurstCpuInitialized(options);
    const rawDelta = options.time - options.cpu.lastTime;
    const delta = !Number.isFinite(rawDelta) || rawDelta <= 0
        ? 0
        : Math.min(rawDelta, 1 / 15) * options.emitter.timeScale;
    options.cpu.lastTime = options.time;
    const liveParticles = writeParticleBurstCpuBuffer({
        cpu: options.cpu,
        effect: options.effect,
        delta,
    });
    return { liveParticles, diagnostics: [] };
}
function ensureParticleBurstCpuInitialized(options) {
    if (options.cpu.initialized) {
        return;
    }
    initializeParticleBurstCpuState({
        cpu: options.cpu,
        emitter: options.emitter,
        effect: options.effect,
    });
    options.cpu.initialized = true;
    options.cpu.startTime = options.emitter.burst?.startTime ?? options.time;
    options.cpu.lastTime = options.cpu.startTime;
}
function initializeParticleBurstCpuState(options) {
    const burst = options.emitter.burst;
    if (burst === undefined) {
        return;
    }
    let maxLifetime = 0;
    const uniformLifetime = options.effect.lifetime.min === options.effect.lifetime.max;
    for (let index = 0; index < options.emitter.capacity; index += 1) {
        const offset = index * 3;
        const r0 = hashUnit(options.emitter.seed ^ (index * 747796405));
        const r1 = hashUnit(options.emitter.seed ^ (index * 277803737));
        const r2 = hashUnit(options.emitter.seed ^ (index * 1442695041));
        const r3 = hashUnit(options.emitter.seed ^ (index * 1597334677));
        const r4 = hashUnit(options.emitter.seed ^ (index * 2891336453));
        options.cpu.positions[offset] =
            burst.position[0] +
                lerp(burst.positionJitterMin[0], burst.positionJitterMax[0], r0);
        options.cpu.positions[offset + 1] =
            burst.position[1] +
                lerp(burst.positionJitterMin[1], burst.positionJitterMax[1], r1);
        options.cpu.positions[offset + 2] =
            burst.position[2] +
                lerp(burst.positionJitterMin[2], burst.positionJitterMax[2], r2);
        options.cpu.velocities[offset] = lerp(burst.velocityMin[0], burst.velocityMax[0], r2);
        options.cpu.velocities[offset + 1] = lerp(burst.velocityMin[1], burst.velocityMax[1], r3);
        options.cpu.velocities[offset + 2] = lerp(burst.velocityMin[2], burst.velocityMax[2], r4);
        options.cpu.ages[index] = 0;
        const lifetime = Math.max(0.001, lerp(options.effect.lifetime.min, options.effect.lifetime.max, r3));
        options.cpu.lifetimes[index] = lifetime;
        maxLifetime = Math.max(maxLifetime, lifetime);
        options.cpu.baseSizes[index] = Math.max(0.001, lerp(options.effect.startSize.min, options.effect.startSize.max, r4));
    }
    options.cpu.maxLifetime = maxLifetime;
    options.cpu.uniformLifetime = uniformLifetime;
}
function writeParticleBurstCpuBuffer(options) {
    let live = 0;
    const dampingFactor = options.effect.linearDamping <= 0
        ? 1
        : Math.exp(-options.effect.linearDamping * options.delta);
    for (let index = 0; index < options.cpu.ages.length; index += 1) {
        const lifetime = options.cpu.lifetimes[index] ?? 0;
        const age = (options.cpu.ages[index] ?? 0) + options.delta;
        if (age >= lifetime) {
            options.cpu.ages[index] = lifetime;
            continue;
        }
        options.cpu.ages[index] = age;
        const sourceOffset = index * 3;
        options.cpu.velocities[sourceOffset] =
            (options.cpu.velocities[sourceOffset] ?? 0) +
                options.effect.gravity[0] * options.delta;
        options.cpu.velocities[sourceOffset + 1] =
            (options.cpu.velocities[sourceOffset + 1] ?? 0) +
                options.effect.gravity[1] * options.delta;
        options.cpu.velocities[sourceOffset + 2] =
            (options.cpu.velocities[sourceOffset + 2] ?? 0) +
                options.effect.gravity[2] * options.delta;
        options.cpu.velocities[sourceOffset] =
            (options.cpu.velocities[sourceOffset] ?? 0) * dampingFactor;
        options.cpu.velocities[sourceOffset + 1] =
            (options.cpu.velocities[sourceOffset + 1] ?? 0) * dampingFactor;
        options.cpu.velocities[sourceOffset + 2] =
            (options.cpu.velocities[sourceOffset + 2] ?? 0) * dampingFactor;
        options.cpu.positions[sourceOffset] =
            (options.cpu.positions[sourceOffset] ?? 0) +
                (options.cpu.velocities[sourceOffset] ?? 0) * options.delta;
        options.cpu.positions[sourceOffset + 1] =
            (options.cpu.positions[sourceOffset + 1] ?? 0) +
                (options.cpu.velocities[sourceOffset + 1] ?? 0) * options.delta;
        options.cpu.positions[sourceOffset + 2] =
            (options.cpu.positions[sourceOffset + 2] ?? 0) +
                (options.cpu.velocities[sourceOffset + 2] ?? 0) * options.delta;
        const lifeT = clamp01(age / lifetime);
        const color = samplePackedParticleColorCurve(options.effect, lifeT);
        const outputOffset = live * PARTICLE_DATA_FLOAT_STRIDE;
        options.cpu.bufferData[outputOffset] =
            options.cpu.positions[sourceOffset] ?? 0;
        options.cpu.bufferData[outputOffset + 1] =
            options.cpu.positions[sourceOffset + 1] ?? 0;
        options.cpu.bufferData[outputOffset + 2] =
            options.cpu.positions[sourceOffset + 2] ?? 0;
        options.cpu.bufferData[outputOffset + 3] = Math.max(0.001, (options.cpu.baseSizes[index] ?? 1) *
            samplePackedParticleSizeCurve(options.effect, lifeT));
        options.cpu.bufferData[outputOffset + 4] = color[0];
        options.cpu.bufferData[outputOffset + 5] = color[1];
        options.cpu.bufferData[outputOffset + 6] = color[2];
        options.cpu.bufferData[outputOffset + 7] = color[3];
        live += 1;
    }
    options.cpu.liveCount = live;
    return live;
}
function hashUnit(value) {
    let x = value >>> 0;
    x = (((x >>> 16) ^ x) * 0x45d9f3b) >>> 0;
    x = (((x >>> 16) ^ x) * 0x45d9f3b) >>> 0;
    x = ((x >>> 16) ^ x) >>> 0;
    return (x & 0x00ff_ffff) / 0x0100_0000;
}
function submitParticleComputePass(options) {
    const encoderResult = createCommandEncoderResource({
        device: options.device,
        label: `particle-compute:${options.emitter.emitterId}`,
    });
    const encoder = encoderResult.resource?.encoder;
    const pass = encoder?.beginComputePass?.({
        label: `ParticleCompute/${options.emitter.emitterId}`,
    });
    if (!encoderResult.valid || encoder === undefined || pass === undefined) {
        return {
            dispatches: 0,
            diagnostics: [
                ...encoderResult.diagnostics,
                {
                    code: "particleFrame.beginComputeFailed",
                    message: "Particle compute pass could not begin.",
                },
            ],
        };
    }
    const execution = executeComputePassCommands({
        pass,
        commands: [
            {
                kind: "setComputePipeline",
                pipelineKey: options.pipeline.cacheKey,
                pipeline: options.pipeline.pipeline,
            },
            {
                kind: "setComputeBindGroup",
                index: 0,
                resourceKey: particleEmitterStateKey(options.emitter),
                bindGroup: options.bindGroup,
            },
            {
                kind: "dispatchWorkgroups",
                workgroupCountX: Math.max(1, Math.ceil(options.emitter.capacity / 64)),
                workgroupCountY: 1,
                workgroupCountZ: 1,
            },
        ],
    });
    pass.end?.();
    const finished = finishCommandEncoder({
        encoder,
        label: `particle-compute:${options.emitter.emitterId}`,
    });
    const submitted = finished.resource === null
        ? null
        : submitCommandBuffers({
            queue: options.device.queue ?? {},
            commandBuffers: [finished.resource],
        });
    return {
        dispatches: execution.dispatchCount,
        diagnostics: [
            ...execution.diagnostics,
            ...finished.diagnostics,
            ...(submitted?.diagnostics ?? []),
        ],
    };
}
function createParticleParamData(options) {
    const bytes = new Uint8Array(PARTICLE_PARAM_BYTE_LENGTH);
    const words = new Uint32Array(bytes.buffer, bytes.byteOffset, 4);
    const floats = new Float32Array(bytes.buffer, bytes.byteOffset + 16, (PARTICLE_PARAM_BYTE_LENGTH - 16) / 4);
    const startColor = options.effect.startColor;
    const endColor = options.effect.endColor;
    const origin = emitterWorldOrigin(options.snapshot, options.emitter);
    words[0] = options.frame >>> 0;
    words[1] = options.emitter.seed >>> 0;
    words[2] = options.emitter.capacity >>> 0;
    words[3] = PARTICLE_CURVE_SAMPLE_COUNT;
    floats[0] = origin[0];
    floats[1] = origin[1];
    floats[2] = options.time * options.emitter.timeScale;
    floats[3] = Math.max(0.01, options.effect.startSpeed.max);
    floats[4] = startColor[0];
    floats[5] = startColor[1];
    floats[6] = startColor[2];
    floats[7] = startColor[3];
    floats[8] = endColor[0];
    floats[9] = endColor[1];
    floats[10] = endColor[2];
    floats[11] = endColor[3];
    floats[12] = options.effect.startSize.min;
    floats[13] = options.effect.startSize.max;
    floats[14] = options.effect.lifetime.max;
    floats[15] = 0;
    writeParticleCurveData(floats, options.effect);
    return bytes;
}
function writeParticleCurveData(floats, effect) {
    for (let index = 0; index < PARTICLE_CURVE_SAMPLE_COUNT; index += 1) {
        const t = index / (PARTICLE_CURVE_SAMPLE_COUNT - 1);
        const color = samplePackedParticleColorCurve(effect, t);
        floats[PARTICLE_SIZE_CURVE_FLOAT_OFFSET + index] =
            samplePackedParticleSizeCurve(effect, t);
        floats[PARTICLE_COLOR_CURVE_FLOAT_OFFSET + index * 4] = color[0];
        floats[PARTICLE_COLOR_CURVE_FLOAT_OFFSET + index * 4 + 1] = color[1];
        floats[PARTICLE_COLOR_CURVE_FLOAT_OFFSET + index * 4 + 2] = color[2];
        floats[PARTICLE_COLOR_CURVE_FLOAT_OFFSET + index * 4 + 3] = color[3];
    }
}
function writeParticleBurstRenderCurveData(floats, effect) {
    for (let index = 0; index < PARTICLE_CURVE_SAMPLE_COUNT; index += 1) {
        const t = index / (PARTICLE_CURVE_SAMPLE_COUNT - 1);
        const color = samplePackedParticleColorCurve(effect, t);
        floats[PARTICLE_BURST_SIZE_CURVE_FLOAT_OFFSET + index] =
            samplePackedParticleSizeCurve(effect, t);
        floats[PARTICLE_BURST_COLOR_CURVE_FLOAT_OFFSET + index * 4] = color[0];
        floats[PARTICLE_BURST_COLOR_CURVE_FLOAT_OFFSET + index * 4 + 1] = color[1];
        floats[PARTICLE_BURST_COLOR_CURVE_FLOAT_OFFSET + index * 4 + 2] = color[2];
        floats[PARTICLE_BURST_COLOR_CURVE_FLOAT_OFFSET + index * 4 + 3] = color[3];
    }
}
function samplePackedParticleSizeCurve(effect, t) {
    return samplePackedScalarTable(effect.curves.sizeOverLifetime, t);
}
function samplePackedParticleColorCurve(effect, t) {
    const color = effect.curves.colorOverLifetime;
    const sampleCount = effect.curves.sampleCount;
    if (sampleCount <= 1) {
        return [
            color[0] ?? effect.startColor[0],
            color[1] ?? effect.startColor[1],
            color[2] ?? effect.startColor[2],
            color[3] ?? effect.startColor[3],
        ];
    }
    const scaled = clamp01(t) * (sampleCount - 1);
    const lower = Math.floor(scaled);
    const upper = Math.min(sampleCount - 1, lower + 1);
    const blend = scaled - lower;
    const lowerOffset = lower * 4;
    const upperOffset = upper * 4;
    return [
        lerp(color[lowerOffset] ?? effect.startColor[0], color[upperOffset] ?? effect.endColor[0], blend),
        lerp(color[lowerOffset + 1] ?? effect.startColor[1], color[upperOffset + 1] ?? effect.endColor[1], blend),
        lerp(color[lowerOffset + 2] ?? effect.startColor[2], color[upperOffset + 2] ?? effect.endColor[2], blend),
        lerp(color[lowerOffset + 3] ?? effect.startColor[3], color[upperOffset + 3] ?? effect.endColor[3], blend),
    ];
}
function samplePackedScalarTable(values, t) {
    if (values.length <= 1) {
        return values[0] ?? 1;
    }
    const scaled = clamp01(t) * (values.length - 1);
    const lower = Math.floor(scaled);
    const upper = Math.min(values.length - 1, lower + 1);
    return lerp(values[lower] ?? 1, values[upper] ?? 1, scaled - lower);
}
function clamp01(value) {
    return Math.min(1, Math.max(0, value));
}
function lerp(start, end, t) {
    return start + (end - start) * t;
}
function viewUniformData(options) {
    const source = options.viewUniforms.data.subarray(0, options.viewUniforms.floatCount ?? options.viewUniforms.data.length);
    const data = new Float32Array(source);
    const dimensions = options.app.canvas === undefined
        ? { width: 1, height: 1 }
        : webGpuAppCanvasDimensions(options.app.canvas);
    for (const record of options.viewUniforms.views) {
        const view = options.snapshot.views.find((candidate) => candidate.viewId === record.viewId);
        const viewport = view?.viewport ?? [0, 0, 1, 1];
        const offset = record.packedOffset + PARTICLE_VIEWPORT_FLOAT_OFFSET;
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
function particleEmitterStateKey(emitter) {
    return `particle:${emitter.emitterId}:effect-v${emitter.effectVersion}:capacity-${emitter.capacity}:reset-${emitter.resetEpoch}`;
}
function emitterWorldOrigin(snapshot, emitter) {
    const offset = emitter.worldTransformOffset;
    return [
        snapshot.transforms[offset + 12] ?? 0,
        snapshot.transforms[offset + 13] ?? 0,
        snapshot.transforms[offset + 14] ?? 0,
    ];
}
function cleanupParticleStates(cache, activeKeys) {
    let removed = 0;
    for (const key of cache.particleEmitterStates.keys()) {
        if (!activeKeys.has(key)) {
            destroyWebGpuBuffer(cache.particleEmitterStates.get(key)?.particleBuffer);
            cache.particleEmitterStates.delete(key);
            removed += 1;
        }
    }
    return removed;
}
function cleanupParticleBurstCpuStates(cache, activeKeys) {
    let removed = 0;
    for (const key of cache.particleBurstCpuStates.keys()) {
        if (!activeKeys.has(key)) {
            cache.particleBurstCpuStates.delete(key);
            removed += 1;
        }
    }
    return removed;
}
function cleanupParticleBurstBatchStates(cache, activeKeys) {
    let removed = 0;
    for (const key of cache.particleBurstBatchStates.keys()) {
        if (!activeKeys.has(key)) {
            const state = cache.particleBurstBatchStates.get(key);
            destroyWebGpuBuffer(state?.particleBuffer);
            destroyWebGpuBuffer(state?.paramBuffer);
            cache.particleBurstBatchStates.delete(key);
            removed += 1;
        }
    }
    return removed;
}
function nextPowerOfTwo(value) {
    if (!Number.isFinite(value) || value <= 1) {
        return 1;
    }
    return 2 ** Math.ceil(Math.log2(value));
}
function emptyParticleFrameReport(emitters = 0) {
    return {
        emitters,
        liveParticles: 0,
        texturedEmitters: 0,
        statesCreated: 0,
        statesReused: 0,
        staleStatesRemoved: 0,
        dispatches: 0,
        textureResourcesCreated: 0,
        textureResourcesReused: 0,
        samplerResourcesCreated: 0,
        samplerResourcesReused: 0,
    };
}
function createParticleTextureSamplerReuseReport() {
    return {
        textureResourcesCreated: 0,
        textureResourcesReused: 0,
        samplerResourcesCreated: 0,
        samplerResourcesReused: 0,
    };
}
function particleTextureSamplerReuseSnapshot(reuse) {
    return {
        textureResourcesCreated: reuse.textureResourcesCreated,
        textureResourcesReused: reuse.textureResourcesReused,
        samplerResourcesCreated: reuse.samplerResourcesCreated,
        samplerResourcesReused: reuse.samplerResourcesReused,
    };
}
//# sourceMappingURL=particles.js.map