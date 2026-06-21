import { assetHandleKey, } from "/aperture/worker-modules/packages/simulation/dist/index.js";
import { writePackedSnapshotInstanceTintsForVertexBuffer, writePackedSnapshotTransforms, writePackedSnapshotViewUniforms, } from "/aperture/worker-modules/packages/render/dist/index.js";
import { webGpuAppCanvasDimensions } from "./canvas.js";
import { prepareWebGpuAppSourceAssetFacades } from "./source-assets.js";
import { collectInstanceTintResources, queuedBuiltInResourceSetHasStandardMaterial, resolveStandardAreaLightLtcResources, } from "./queued-built-in-support.js";
import { createWebGpuAppPickSharedBindGroups, getOrCreateWebGpuIdBufferPickPipelines, popWebGpuPickErrorScope, pushWebGpuPickErrorScope, webGpuAppPickPixel, } from "./picking.js";
import { createWebGpuAppPickReport, createWebGpuAppResourceReuseReport, waitForSubmittedWork, } from "./report.js";
import { prepareQueuedBuiltInFrameResources, } from "./queued-frame-resources.js";
import { writeRenderFramePlanFromSnapshot } from "../render/frame/render-frame-plan.js";
import { collectQueuedBuiltInAppResourceSet, } from "../render/queues/queued-built-in-app-resource-set.js";
import { assembleFrameBoundary } from "../render/frame/frame-boundary.js";
import { createOrReuseWebGpuDepthTexture, createWebGpuDepthTextureCacheSlot, WEBGPU_APP_DEPTH_FORMAT, } from "../resources/textures/depth-texture-resource.js";
import { createWebGpuIdBufferEntries, findWebGpuIdBufferEntry, WEBGPU_ID_BUFFER_EMPTY_ID, } from "../picking/id-buffer.js";
import { createWebGpuIdBufferPickBindGroup, createWebGpuIdBufferPickCommands, createWebGpuIdBufferPickIdStorage, createWebGpuIdBufferPickTexture, readWebGpuIdBufferPickPixel, } from "../picking/id-buffer-pick.js";
export async function pickWebGpuAppEntity(context, resourceCache, latestReport, x, y, options) {
    const dimensions = webGpuAppCanvasDimensions(context.app.canvas);
    const pixel = webGpuAppPickPixel(dimensions, x, y);
    if (pixel === null) {
        return createWebGpuAppPickReport({
            x,
            y,
            dimensions,
            id: null,
            entity: null,
            diagnostics: [
                {
                    code: "webGpuApp.pickInvalidCoordinates",
                    message: `Pick coordinates ${String(x)},${String(y)} are outside the ${dimensions.width}x${dimensions.height} canvas.`,
                },
            ],
        });
    }
    if (latestReport === null) {
        return createWebGpuAppPickReport({
            x: pixel.x,
            y: pixel.y,
            dimensions,
            id: null,
            entity: null,
            diagnostics: [
                {
                    code: "webGpuApp.pickMissingFrame",
                    message: "WebGPU app picking requires a previously rendered frame.",
                },
            ],
        });
    }
    if (!latestReport.ok) {
        return createWebGpuAppPickReport({
            x: pixel.x,
            y: pixel.y,
            dimensions,
            id: null,
            entity: null,
            diagnostics: [
                {
                    code: "webGpuApp.pickLastFrameNotReady",
                    message: "WebGPU app picking requires the latest rendered frame to be ready.",
                },
                ...latestReport.diagnostics,
            ],
        });
    }
    const snapshot = latestReport.snapshot;
    const prepared = await prepareWebGpuAppPickFrameResources(context, resourceCache, snapshot, options);
    if (!prepared.valid ||
        prepared.framePlan === null ||
        prepared.resources === null) {
        return createWebGpuAppPickReport({
            x: pixel.x,
            y: pixel.y,
            dimensions,
            id: null,
            entity: null,
            diagnostics: prepared.diagnostics,
        });
    }
    const pipelines = await getOrCreateWebGpuIdBufferPickPipelines({
        app: context.app,
        cache: resourceCache,
        snapshot,
        pipelineKeysByRenderId: prepared.pipelineKeysByRenderId,
    });
    if (!pipelines.valid) {
        return createWebGpuAppPickReport({
            x: pixel.x,
            y: pixel.y,
            dimensions,
            id: null,
            entity: null,
            diagnostics: pipelines.diagnostics,
        });
    }
    const idStorage = createWebGpuIdBufferPickIdStorage({
        device: context.app.initialization.device,
        snapshot,
    });
    if (!idStorage.valid || idStorage.resource === null) {
        return createWebGpuAppPickReport({
            x: pixel.x,
            y: pixel.y,
            dimensions,
            id: null,
            entity: null,
            diagnostics: idStorage.diagnostics,
        });
    }
    const firstPickPipeline = pipelines.pipelines.values().next().value;
    if (firstPickPipeline === undefined) {
        return createWebGpuAppPickReport({
            x: pixel.x,
            y: pixel.y,
            dimensions,
            id: null,
            entity: null,
            diagnostics: [
                {
                    code: "webGpuApp.pickMissingPipeline",
                    message: "WebGPU app picking could not create an ID-buffer pipeline.",
                },
            ],
        });
    }
    const idBindGroup = createWebGpuIdBufferPickBindGroup({
        device: context.app.initialization.device,
        pipeline: firstPickPipeline,
        ids: idStorage.resource,
    });
    if (!idBindGroup.valid || idBindGroup.resource === null) {
        return createWebGpuAppPickReport({
            x: pixel.x,
            y: pixel.y,
            dimensions,
            id: null,
            entity: null,
            diagnostics: idBindGroup.diagnostics,
        });
    }
    const sharedBindGroups = createWebGpuAppPickSharedBindGroups({
        device: context.app.initialization.device,
        pipeline: firstPickPipeline,
        viewUniformBuffer: prepared.resources.viewUniform.buffer,
        worldTransformBuffer: prepared.resources.worldTransforms.buffer,
    });
    if (!sharedBindGroups.valid) {
        return createWebGpuAppPickReport({
            x: pixel.x,
            y: pixel.y,
            dimensions,
            id: null,
            entity: null,
            diagnostics: sharedBindGroups.diagnostics,
        });
    }
    const pickCommands = createWebGpuIdBufferPickCommands({
        commands: prepared.framePlan.commandPlan.commands,
        pipelineByKey: pipelines.pipelines,
        viewBindGroup: sharedBindGroups.viewBindGroup,
        worldTransformBindGroup: sharedBindGroups.worldTransformBindGroup,
        idBindGroup: idBindGroup.resource,
    });
    if (!pickCommands.valid) {
        return createWebGpuAppPickReport({
            x: pixel.x,
            y: pixel.y,
            dimensions,
            id: null,
            entity: null,
            diagnostics: pickCommands.diagnostics,
        });
    }
    const texture = createWebGpuIdBufferPickTexture({
        device: context.app.initialization.device,
        width: dimensions.width,
        height: dimensions.height,
    });
    if (!texture.valid || texture.resource === null) {
        return createWebGpuAppPickReport({
            x: pixel.x,
            y: pixel.y,
            dimensions,
            id: null,
            entity: null,
            diagnostics: texture.diagnostics,
        });
    }
    let pickDepthTexture = null;
    try {
        pushWebGpuPickErrorScope(context.app.initialization.device);
        pickDepthTexture = createOrReuseWebGpuDepthTexture({
            device: context.app.initialization.device,
            cache: createWebGpuDepthTextureCacheSlot(),
            width: dimensions.width,
            height: dimensions.height,
            format: WEBGPU_APP_DEPTH_FORMAT,
            sampleCount: 1,
            label: "aperture/webgpu-app/pick-depth",
        }).resource;
        const boundary = assembleFrameBoundary({
            context: context.app.initialization.context,
            device: context.app.initialization.device,
            queue: context.app.initialization.device
                .queue,
            commands: pickCommands.commands,
            label: "aperture-webgpu-app:pick-id-buffer",
            colorTarget: {
                source: "offscreen-target",
                texture: texture.resource.texture,
            },
            clearColor: [WEBGPU_ID_BUFFER_EMPTY_ID, 0, 0, 0],
            depthTarget: {
                view: pickDepthTexture.view,
                depthClearValue: snapshot.views[0]?.clearDepth ?? 1,
                depthLoadOp: "clear",
                depthStoreOp: "store",
            },
        });
        let validationMessage = null;
        try {
            await waitForSubmittedWork(context.app.initialization.device);
            validationMessage = await popWebGpuPickErrorScope(context.app.initialization.device);
        }
        catch (error) {
            // Device-level failure (device lost / GPU process gone): picks must
            // report a structured diagnostic instead of throwing — an unhandled
            // OperationError here fails the whole devtools tool call (seen as
            // "A valid external Instance reference no longer exists" in CI).
            return createWebGpuAppPickReport({
                x: pixel.x,
                y: pixel.y,
                dimensions,
                id: null,
                entity: null,
                diagnostics: [
                    {
                        code: "webGpuApp.pickDeviceUnavailable",
                        message: `Entity pick could not drain the GPU queue: ${error instanceof Error ? error.message : String(error)}`,
                    },
                ],
            });
        }
        if (!boundary.valid || validationMessage !== null) {
            return createWebGpuAppPickReport({
                x: pixel.x,
                y: pixel.y,
                dimensions,
                id: null,
                entity: null,
                diagnostics: [
                    ...(validationMessage === null
                        ? []
                        : [
                            {
                                code: "webGpuApp.pickGpuValidationError",
                                message: validationMessage,
                            },
                        ]),
                    ...boundary.texture.diagnostics,
                    ...(boundary.attachments?.diagnostics ?? []),
                    ...(boundary.encoder?.diagnostics ?? []),
                    ...(boundary.begin?.diagnostics ?? []),
                    ...(boundary.execution?.diagnostics ?? []),
                    ...(boundary.end?.diagnostics ?? []),
                    ...(boundary.finish?.diagnostics ?? []),
                    ...(boundary.submit?.diagnostics ?? []),
                ],
            });
        }
        const readback = await readWebGpuIdBufferPickPixel({
            device: context.app.initialization.device,
            texture: texture.resource.texture,
            width: dimensions.width,
            height: dimensions.height,
            x: pixel.x,
            y: pixel.y,
        });
        if (!readback.ok) {
            return createWebGpuAppPickReport({
                x: pixel.x,
                y: pixel.y,
                dimensions,
                id: null,
                entity: null,
                readback,
                diagnostics: [
                    {
                        code: readback.reason,
                        message: readback.message,
                    },
                ],
            });
        }
        const id = readback.id;
        const entry = id === WEBGPU_ID_BUFFER_EMPTY_ID
            ? null
            : findWebGpuIdBufferEntry(createWebGpuIdBufferEntries(snapshot.meshDraws), id);
        return createWebGpuAppPickReport({
            x: pixel.x,
            y: pixel.y,
            dimensions,
            id,
            entity: entry?.entity ?? null,
            readback,
            diagnostics: [],
        });
    }
    finally {
        pickDepthTexture?.texture.destroy?.();
        texture.resource.destroy?.();
    }
}
async function prepareWebGpuAppPickFrameResources(context, resourceCache, snapshot, options) {
    const firstDraw = snapshot.meshDraws[0];
    const firstView = snapshot.views[0];
    if (firstDraw === undefined || firstView === undefined) {
        return {
            valid: false,
            framePlan: null,
            resources: null,
            pipelineResults: [],
            pipelineKeysByRenderId: new Map(),
            diagnostics: [
                {
                    code: "webGpuApp.pickEmptySnapshot",
                    message: "WebGPU app picking requires at least one view and one mesh draw.",
                },
            ],
        };
    }
    prepareWebGpuAppSourceAssetFacades({
        registry: context.sourceAssets,
        snapshot,
        cache: resourceCache,
    });
    const queuedBuiltIn = collectQueuedBuiltInAppResourceSet({
        assets: context.sourceAssets,
        snapshot,
        materialQueueScratch: resourceCache.frameScratch.materialQueue,
        routeScratch: resourceCache.frameScratch.queueRoute,
        meshes: resourceCache.preparedMeshFacade,
        materials: resourceCache.preparedMaterialFacade,
        adapters: options.adapters,
    });
    if (!queuedBuiltIn.valid || queuedBuiltIn.resourceSet === null) {
        return {
            valid: false,
            framePlan: null,
            resources: null,
            pipelineResults: [],
            pipelineKeysByRenderId: new Map(),
            diagnostics: queuedBuiltIn.diagnostics,
        };
    }
    const packedViews = writePackedSnapshotViewUniforms(snapshot, resourceCache.frameScratch.viewUniforms);
    const packedTransforms = writePackedSnapshotTransforms(snapshot, resourceCache.frameScratch.worldTransforms);
    const packedInstanceTints = writePackedSnapshotInstanceTintsForVertexBuffer(snapshot, packedTransforms, resourceCache.frameScratch.instanceTints);
    const standardAreaLightLtc = resolveStandardAreaLightLtcResources({
        app: context.app,
        cache: resourceCache,
        required: queuedBuiltInResourceSetHasStandardMaterial(queuedBuiltIn.resourceSet),
    });
    if (!standardAreaLightLtc.valid) {
        return {
            valid: false,
            framePlan: null,
            resources: null,
            pipelineResults: [],
            pipelineKeysByRenderId: new Map(),
            diagnostics: [
                ...packedViews.diagnostics,
                ...packedTransforms.diagnostics,
                ...packedInstanceTints.diagnostics,
                ...standardAreaLightLtc.diagnostics,
            ],
        };
    }
    const pickResourceReuse = createWebGpuAppResourceReuseReport();
    const prepared = await prepareQueuedBuiltInFrameResources({
        app: context.app,
        assets: context.sourceAssets,
        cache: resourceCache,
        snapshot,
        resourceLifetimeFrame: options.resourceLifetimeFrame ?? snapshot.frame,
        resourceSet: queuedBuiltIn.resourceSet,
        reuse: pickResourceReuse,
        viewUniforms: packedViews,
        worldTransforms: packedTransforms,
        instanceTints: packedInstanceTints,
        standardAreaLightLtcResources: standardAreaLightLtc.resources,
        getPipeline: (item) => options.getPipeline({
            item,
            reuse: pickResourceReuse,
        }),
        getPipelineLayouts: options.getPipelineLayouts,
    });
    if (!prepared.valid || prepared.resources === null) {
        return {
            valid: false,
            framePlan: null,
            resources: null,
            pipelineResults: prepared.pipelineResults,
            pipelineKeysByRenderId: prepared.pipelineKeysByRenderId,
            diagnostics: [
                ...packedViews.diagnostics,
                ...packedTransforms.diagnostics,
                ...packedInstanceTints.diagnostics,
                ...prepared.diagnostics,
            ],
        };
    }
    const framePlan = writeRenderFramePlanFromSnapshot({
        snapshot,
        renderWorld: context.app.renderWorld,
        transforms: packedTransforms,
        resolveMeshResourceKey: (draw) => prepared.meshResourceKeys.get(assetHandleKey(draw.mesh)) ?? null,
        resolveMaterialResourceKey: (draw) => prepared.materialResourceKeys.get(assetHandleKey(draw.material)) ?? null,
        meshResources: prepared.resources.meshResources,
        instanceTintResources: collectInstanceTintResources(prepared.resources),
        pipelineKeysByRenderId: prepared.pipelineKeysByRenderId,
        pipelines: prepared.pipelineResults,
        bindGroups: prepared.resources.bindGroups,
        scratch: resourceCache.frameScratch.framePlan,
    });
    const diagnostics = [
        ...packedViews.diagnostics,
        ...packedTransforms.diagnostics,
        ...packedInstanceTints.diagnostics,
        ...framePlan.bindingPlan.diagnostics,
        ...framePlan.readiness.diagnostics,
        ...framePlan.packages.diagnostics,
        ...framePlan.drawCommands.diagnostics,
        ...framePlan.drawList.diagnostics,
        ...framePlan.resources.diagnostics,
        ...framePlan.commandPlan.diagnostics,
    ];
    return {
        valid: diagnostics.length === 0 &&
            framePlan.drawList.valid &&
            framePlan.resources.valid &&
            framePlan.commandPlan.valid,
        framePlan,
        resources: prepared.resources,
        pipelineResults: prepared.pipelineResults,
        pipelineKeysByRenderId: prepared.pipelineKeysByRenderId,
        diagnostics,
    };
}
//# sourceMappingURL=picking-frame.js.map