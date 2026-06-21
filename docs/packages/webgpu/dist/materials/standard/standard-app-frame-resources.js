import { sameStringList, writeBufferData, writeBufferDataDirtyRange, writeVersionedBufferData, } from "../../app/app-frame-resource-utils.js";
import { retireWebGpuBuffer } from "../../gpu/buffer.js";
import { recordPreparedAppMaterialResourceUse, } from "../core/prepared-app-material-resource.js";
import { CLUSTERED_LOCAL_LIGHT_PIPELINE_FEATURE, createLocalLightClusterDescriptor, } from "../../lighting/local-light-clusters.js";
import { createLightBufferDescriptorPlanScratch, createLightBufferDescriptorScratch, writeLightBufferDescriptor, writeLightBufferDescriptorPlan, } from "../../lighting/light-packing.js";
import { preparePreparedStandardMaterial, preparePreparedStandardMesh, } from "./standard-app-prepared-resources.js";
import { createStandardFrameGpuResources, } from "./standard-frame-resources.js";
import { createViewUniformBufferDescriptorScratch, writeViewUniformBufferDescriptor, } from "../../resources/views/view-uniform-buffer.js";
import { createViewUniformGpuBuffer, } from "../../resources/views/view-uniform-buffer-resource.js";
import { createWorldTransformBufferDescriptorScratch, createWorldTransformGpuBuffer, writeWorldTransformBufferDescriptor, } from "../../resources/transforms/world-transform-buffer.js";
export function createStandardAppFrameResourceCacheSlot() {
    return {
        current: null,
        byRoute: new Map(),
        sharedViewUniform: null,
        sharedWorldTransforms: null,
        sharedViewDescriptorScratch: createViewUniformBufferDescriptorScratch(),
        sharedWorldTransformDescriptorScratch: createWorldTransformBufferDescriptorScratch(),
    };
}
function prepareStandardSharedFrameResources(input) {
    if (!standardSharedFrameResourcesEnabled(input.cache)) {
        return {
            valid: true,
            viewUniform: null,
            worldTransforms: null,
            diagnostics: [],
        };
    }
    const diagnostics = [
        ...input.viewDescriptor.diagnostics,
        ...input.transformDescriptor.diagnostics,
    ];
    const viewUniforms = input.viewUniforms;
    const packedWorldTransforms = input.worldTransforms;
    if (viewUniforms === null ||
        packedWorldTransforms === null ||
        input.viewDescriptor.plan === null ||
        input.transformDescriptor.plan === null) {
        return {
            valid: false,
            viewUniform: null,
            worldTransforms: null,
            diagnostics,
        };
    }
    const viewUniform = prepareSharedViewUniformResource({ ...input, viewUniforms }, diagnostics);
    const worldTransformResource = prepareSharedWorldTransformResource({ ...input, worldTransforms: packedWorldTransforms }, diagnostics);
    return {
        valid: viewUniform !== null && worldTransformResource !== null,
        viewUniform,
        worldTransforms: worldTransformResource,
        diagnostics,
    };
}
function standardSharedFrameResourcesEnabled(cache) {
    return (cache.sharedViewDescriptorScratch !== undefined ||
        cache.sharedWorldTransformDescriptorScratch !== undefined ||
        cache.sharedViewUniform !== undefined ||
        cache.sharedWorldTransforms !== undefined);
}
function prepareSharedViewUniformResource(input, diagnostics) {
    const plan = input.viewDescriptor.plan;
    if (plan === null) {
        return null;
    }
    const cached = input.cache.sharedViewUniform ?? null;
    if (cached !== null && cached.byteLength === plan.source.byteLength) {
        const outcome = writeVersionedBufferData(input.device, cached.resource.buffer, plan.source, input.viewUniforms, cached.uploadStamp);
        if (outcome === false) {
            return null;
        }
        cached.resource.views = plan.views;
        return cached.resource;
    }
    if (cached !== null) {
        retireWebGpuBuffer(input.device, cached.resource.buffer);
        input.cache.sharedViewUniform = null;
    }
    const created = createViewUniformGpuBuffer({
        device: input.device,
        plan,
    });
    diagnostics.push(...created.diagnostics);
    if (!created.valid || created.resource === null) {
        return null;
    }
    input.cache.sharedViewUniform = {
        resource: created.resource,
        byteLength: plan.source.byteLength,
        uploadStamp: { version: input.viewUniforms.contentVersion },
    };
    return created.resource;
}
function prepareSharedWorldTransformResource(input, diagnostics) {
    const plan = input.transformDescriptor.plan;
    if (plan === null) {
        return null;
    }
    const cached = input.cache.sharedWorldTransforms ?? null;
    if (cached !== null && cached.byteLength === plan.source.byteLength) {
        const outcome = writeVersionedBufferData(input.device, cached.resource.buffer, plan.source, input.worldTransforms, cached.uploadStamp);
        if (outcome === false) {
            return null;
        }
        cached.resource.offsets = plan.offsets;
        return cached.resource;
    }
    if (cached !== null) {
        retireWebGpuBuffer(input.device, cached.resource.buffer);
        input.cache.sharedWorldTransforms = null;
    }
    const created = createWorldTransformGpuBuffer({
        device: input.device,
        plan,
    });
    diagnostics.push(...created.diagnostics);
    if (!created.valid || created.resource === null) {
        return null;
    }
    input.cache.sharedWorldTransforms = {
        resource: created.resource,
        byteLength: plan.source.byteLength,
        uploadStamp: { version: input.worldTransforms.contentVersion },
    };
    return created.resource;
}
export function createOrReuseStandardAppFrameResources(options) {
    const standardMaterialIblBindGroupResourceKey = standardMaterialIblBindGroupResourceKeyFromResources(options.standardMaterialIblResources);
    const standardMaterialShadowReceiverResourceKey = standardMaterialShadowReceiverResourceKeyFromResources(options.shadowReceiverResources);
    const transmissionSceneColorResourceKey = transmissionSceneColorResourceKeyFromResources(options.transmissionSceneColorResources);
    const materialLayoutKey = options.materialLayout?.layoutKey ?? null;
    const lightLayoutKey = options.lightLayout?.layoutKey ?? null;
    const localLightClusterDescriptor = requiresClusteredLocalLights(options.pipelineKey)
        ? createLocalLightClusterDescriptor(options.snapshot, {
            ...(options.draw === undefined
                ? {}
                : { layerMask: options.draw.layerMask }),
            supportedPointShadowResources: supportedPointShadowResourcesFromReceiver(options.shadowReceiverResources),
            supportedSpotShadowResources: supportedSpotShadowResourcesFromReceiver(options.shadowReceiverResources),
            supportedCookieResources: options.localLightCookieResources?.supportedResources ?? [],
        })
        : null;
    const localLightClusterResourceKey = localLightClusterDescriptor?.resourceKey ?? null;
    const localLightClusterContentKeys = localLightClusterDescriptor === null
        ? null
        : createLocalLightClusterContentKeys(localLightClusterDescriptor);
    const localLightCookieTextureKey = options.localLightCookieResources?.textureKey ?? null;
    const localLightCookieSamplerKey = options.localLightCookieResources?.samplerKey ?? null;
    const localLightCookieMatrixKey = options.localLightCookieResources?.matrixResource.resourceKey ?? null;
    const routeCacheKey = createStandardAppFrameResourceCacheKey({
        meshKey: options.meshKey,
        materialKey: options.materialKey,
        pipelineKey: options.pipelineKey,
        materialLayoutKey,
        lightLayoutKey,
        standardMaterialIblBindGroupResourceKey,
        standardMaterialShadowReceiverResourceKey,
        transmissionSceneColorResourceKey,
        previousWorldTransformResourceKey: options.previousWorldTransforms?.resourceKey ?? null,
        localLightClusterResourceKey,
        localLightCookieTextureKey,
        localLightCookieSamplerKey,
        localLightCookieMatrixKey,
        textureKeys: options.textureSamplerDependencies.textureKeys,
        samplerKeys: options.textureSamplerDependencies.samplerKeys,
    });
    const cached = options.cache.byRoute === undefined
        ? options.cache.current
        : (options.cache.byRoute.get(routeCacheKey) ?? null);
    const viewDescriptorScratch = options.cache.sharedViewDescriptorScratch ??
        cached?.viewDescriptorScratch ??
        createViewUniformBufferDescriptorScratch();
    const worldTransformDescriptorScratch = options.cache.sharedWorldTransformDescriptorScratch ??
        cached?.worldTransformDescriptorScratch ??
        createWorldTransformBufferDescriptorScratch();
    const lightBufferDescriptorScratch = cached?.lightBufferDescriptorScratch ??
        createLightBufferDescriptorScratch();
    const lightBufferDescriptorPlanScratch = cached?.lightBufferDescriptorPlanScratch ??
        createLightBufferDescriptorPlanScratch();
    const viewDescriptor = writeViewUniformBufferDescriptor(options.viewUniforms, viewDescriptorScratch);
    const transformDescriptor = writeWorldTransformBufferDescriptor(options.worldTransforms, worldTransformDescriptorScratch);
    const sharedFrameResources = options.preparedViewUniform !== undefined &&
        options.preparedWorldTransforms !== undefined
        ? {
            valid: true,
            viewUniform: options.preparedViewUniform,
            worldTransforms: options.preparedWorldTransforms,
            diagnostics: [
                ...viewDescriptor.diagnostics,
                ...transformDescriptor.diagnostics,
            ],
        }
        : prepareStandardSharedFrameResources({
            device: options.device,
            cache: options.cache,
            viewUniforms: options.viewUniforms,
            worldTransforms: options.worldTransforms,
            viewDescriptor,
            transformDescriptor,
        });
    if (!sharedFrameResources.valid) {
        return {
            valid: false,
            resources: null,
            diagnostics: sharedFrameResources.diagnostics,
        };
    }
    const lightBuffer = writeLightBufferDescriptor(options.snapshot, lightBufferDescriptorScratch);
    const lightDescriptor = writeLightBufferDescriptorPlan(lightBuffer, lightBufferDescriptorPlanScratch);
    const cachedLocalLightClusters = cached?.result.resources?.localLightClusters ?? null;
    const localLightClusterContentUnchanged = localLightClusterContentKeys !== null &&
        cached?.localLightClusterContentKeys !== null &&
        cached?.localLightClusterContentKeys !== undefined &&
        sameLocalLightClusterContentKeys(cached.localLightClusterContentKeys, localLightClusterContentKeys);
    let localLightClusterBufferWrites = 0;
    let localLightClusterBufferWritesSkipped = 0;
    const usingSharedFrameResources = sharedFrameResources.viewUniform !== null &&
        sharedFrameResources.worldTransforms !== null;
    // AI-64/AI-65: dirty-range/skip upload outcomes for accounting. Holder
    // objects: TS flow analysis cannot see the closure assignment ordering, so
    // plain lets would narrow back to "full" at the use sites.
    const worldTransformUpload = {
        value: "full",
    };
    const viewUniformUpload = { value: "full" };
    const writeCachedWorldTransformBuffer = () => {
        if (cached === null || cached.result.resources === null) {
            return false;
        }
        const outcome = writeVersionedBufferData(options.device, cached.result.resources.worldTransforms.buffer, transformDescriptor.plan?.source ?? options.worldTransforms.data, options.worldTransforms, cached.worldTransformUploadStamp);
        if (outcome === false) {
            return false;
        }
        worldTransformUpload.value = outcome;
        return true;
    };
    const writeCachedViewUniformBuffer = () => {
        if (cached === null || cached.result.resources === null) {
            return false;
        }
        const outcome = writeVersionedBufferData(options.device, cached.result.resources.viewUniform.buffer, viewDescriptor.plan?.source ?? options.viewUniforms.data, options.viewUniforms, cached.viewUploadStamp);
        if (outcome === false) {
            return false;
        }
        viewUniformUpload.value = outcome;
        return true;
    };
    // AI-65: the per-route light packing scratch pairs 1:1 with this route's
    // light buffers, so its dirty windows apply directly (no version handshake).
    const lightFloatUpload = { value: "full" };
    const lightMetadataUpload = { value: "full" };
    const writeCachedLightBuffers = () => {
        const resource = cached?.result.resources?.lightGpuBuffers.resource;
        if (resource === null || resource === undefined) {
            return false;
        }
        const floats = writeBufferDataDirtyRange(options.device, resource.floatBuffer, lightDescriptor.plan?.source.floats ?? lightBuffer.packed.floats, lightBuffer.floatsDirty);
        if (floats === false) {
            return false;
        }
        const metadata = writeBufferDataDirtyRange(options.device, resource.metadataBuffer, lightDescriptor.plan?.source.metadata ?? lightBuffer.packed.metadata, lightBuffer.metadataDirty);
        if (metadata === false) {
            return false;
        }
        lightFloatUpload.value = floats;
        lightMetadataUpload.value = metadata;
        return true;
    };
    const writeCachedLocalLightClusterBuffers = () => {
        if (localLightClusterDescriptor === null) {
            return true;
        }
        if (cachedLocalLightClusters === null) {
            return false;
        }
        if (localLightClusterContentUnchanged) {
            localLightClusterBufferWritesSkipped = 4;
            return true;
        }
        const written = writeBufferData(options.device, cachedLocalLightClusters.paramsBuffer, localLightClusterDescriptor.params) &&
            writeBufferData(options.device, cachedLocalLightClusters.cellsBuffer, localLightClusterDescriptor.cells) &&
            writeBufferData(options.device, cachedLocalLightClusters.indicesBuffer, localLightClusterDescriptor.indices) &&
            writeBufferData(options.device, cachedLocalLightClusters.metadataBuffer, localLightClusterDescriptor.metadata);
        if (written) {
            localLightClusterBufferWrites = 4;
        }
        return written;
    };
    const cacheReusePreconditionFailure = standardFrameResourceCachePreconditionFailure({
        cached,
        sharedFrameResources,
        usingSharedFrameResources,
        viewDescriptorPlan: viewDescriptor.plan,
        transformDescriptorPlan: transformDescriptor.plan,
        lightDescriptorPlan: lightDescriptor.plan,
        localLightClusterDescriptor,
        cachedLocalLightClusters,
        pipelineKey: options.pipelineKey,
    });
    if (cacheReusePreconditionFailure === null &&
        cached !== null &&
        cached.meshKey === options.meshKey &&
        cached.materialKey === options.materialKey &&
        cached.pipelineKey === options.pipelineKey &&
        cached.materialLayoutKey === materialLayoutKey &&
        cached.lightLayoutKey === lightLayoutKey &&
        cached.standardMaterialIblBindGroupResourceKey ===
            standardMaterialIblBindGroupResourceKey &&
        cached.standardMaterialShadowReceiverResourceKey ===
            standardMaterialShadowReceiverResourceKey &&
        cached.transmissionSceneColorResourceKey ===
            transmissionSceneColorResourceKey &&
        cached.localLightClusterResourceKey === localLightClusterResourceKey &&
        cached.localLightCookieTextureKey === localLightCookieTextureKey &&
        cached.localLightCookieSamplerKey === localLightCookieSamplerKey &&
        cached.localLightCookieMatrixKey === localLightCookieMatrixKey &&
        cached.previousWorldTransformResourceKey ===
            (options.previousWorldTransforms?.resourceKey ?? null) &&
        sameStringList(cached.textureKeys, options.textureSamplerDependencies.textureKeys) &&
        sameStringList(cached.samplerKeys, options.textureSamplerDependencies.samplerKeys) &&
        cached.result.resources !== null &&
        (!usingSharedFrameResources ||
            (cached.result.resources.viewUniform ===
                sharedFrameResources.viewUniform &&
                cached.result.resources.worldTransforms ===
                    sharedFrameResources.worldTransforms)) &&
        cached.result.resources.lightGpuBuffers.resource !== null &&
        viewDescriptor.plan !== null &&
        transformDescriptor.plan !== null &&
        lightDescriptor.plan !== null &&
        (usingSharedFrameResources ||
            cached.viewByteLength === viewDescriptor.plan.source.byteLength) &&
        (usingSharedFrameResources ||
            cached.worldTransformByteLength ===
                transformDescriptor.plan.source.byteLength) &&
        cached.lightFloatByteLength ===
            lightDescriptor.plan.source.floats.byteLength &&
        cached.lightMetadataByteLength ===
            lightDescriptor.plan.source.metadata.byteLength &&
        (localLightClusterDescriptor === null ||
            (cachedLocalLightClusters !== null &&
                cached.localLightClusterParamsByteLength ===
                    localLightClusterDescriptor.params.byteLength &&
                cached.localLightClusterCellsByteLength ===
                    localLightClusterDescriptor.cells.byteLength &&
                cached.localLightClusterIndicesByteLength ===
                    localLightClusterDescriptor.indices.byteLength &&
                cached.localLightClusterMetadataByteLength ===
                    localLightClusterDescriptor.metadata.byteLength)) &&
        !requiresInstanceTintBuffer(options.pipelineKey) &&
        !requiresSkinningJointBuffer(options.pipelineKey) &&
        !requiresMorphTargetWeightBuffer(options.pipelineKey) &&
        (usingSharedFrameResources || writeCachedViewUniformBuffer()) &&
        (usingSharedFrameResources || writeCachedWorldTransformBuffer()) &&
        writeCachedLightBuffers() &&
        writeCachedLocalLightClusterBuffers()) {
        recordStandardFrameResourceCacheHit(options.reuse);
        options.reuse.meshBuffersReused += 1;
        options.reuse.materialBuffersReused += 1;
        options.reuse.bindGroupsReused += cached.result.resources.bindGroups.length;
        options.reuse.lightBuffersReused += 1;
        options.reuse.dynamicBufferWrites +=
            (usingSharedFrameResources ? 2 : 4) -
                (!usingSharedFrameResources && worldTransformUpload.value === "skipped"
                    ? 1
                    : 0) -
                (!usingSharedFrameResources && viewUniformUpload.value === "skipped"
                    ? 1
                    : 0) -
                (lightFloatUpload.value === "skipped" ? 1 : 0) -
                (lightMetadataUpload.value === "skipped" ? 1 : 0);
        if (localLightClusterDescriptor !== null &&
            cachedLocalLightClusters !== null) {
            cachedLocalLightClusters.descriptor = localLightClusterDescriptor;
            options.reuse.localLightClusterBuffersReused += 4;
            options.reuse.localLightClusterBufferWrites +=
                localLightClusterBufferWrites;
            options.reuse.localLightClusterBufferWritesSkipped +=
                localLightClusterBufferWritesSkipped;
            options.reuse.dynamicBufferWrites += localLightClusterBufferWrites;
            cached.localLightClusterContentKeys = localLightClusterContentKeys;
        }
        const resources = cached.result.resources;
        if (!usingSharedFrameResources) {
            resources.viewUniform.views = viewDescriptor.plan.views;
            resources.worldTransforms.offsets = transformDescriptor.plan.offsets;
        }
        resources.lightGpuBuffers.lightBuffer = lightBuffer;
        resources.lightGpuBuffers.descriptorPlan = lightDescriptor.plan;
        return cached.result;
    }
    recordStandardFrameResourceCacheMiss(options.reuse, cacheReusePreconditionFailure ?? "buffer-write-failed");
    const preparedMaterialFallbackDiagnostics = [];
    const resourceLifetimeFrame = options.resourceLifetimeFrame ?? options.snapshot.frame;
    const preparedMesh = preparePreparedStandardMesh({
        ...options,
        frame: resourceLifetimeFrame,
    });
    const preparedMaterial = preparePreparedStandardMaterial({ ...options, frame: resourceLifetimeFrame }, preparedMaterialFallbackDiagnostics);
    const result = createStandardFrameGpuResources({
        device: options.device,
        snapshot: options.snapshot,
        ...(options.draw === undefined ? {} : { draw: options.draw }),
        pipelineKey: options.pipelineKey,
        mesh: options.mesh,
        ...(preparedMesh === null
            ? {}
            : { preparedMesh: preparedMesh.resource.mesh }),
        material: options.material,
        ...(preparedMaterial === null
            ? {}
            : { preparedMaterial: preparedMaterial.resource }),
        viewUniforms: options.viewUniforms,
        ...(sharedFrameResources.viewUniform === null
            ? {}
            : { preparedViewUniform: sharedFrameResources.viewUniform }),
        worldTransforms: options.worldTransforms,
        ...(sharedFrameResources.worldTransforms === null
            ? {}
            : { preparedWorldTransforms: sharedFrameResources.worldTransforms }),
        ...(options.previousWorldTransforms === undefined
            ? {}
            : { previousWorldTransforms: options.previousWorldTransforms }),
        ...(options.instanceTints === undefined
            ? {}
            : { instanceTints: options.instanceTints }),
        sharedLayouts: options.sharedLayouts,
        materialLayout: options.materialLayout,
        lightLayout: options.lightLayout,
        sharedBindGroupCache: options.sharedBindGroupCache,
        lightBindGroupCache: options.lightBindGroupCache,
        standardLightShadowBindGroupCache: options.standardLightShadowBindGroupCache,
        ...(options.shadowReceiverResources === undefined
            ? {}
            : { shadowReceiverResources: options.shadowReceiverResources }),
        ...(options.standardMaterialIblResources === undefined
            ? {}
            : { standardMaterialIblResources: options.standardMaterialIblResources }),
        ...(options.standardAreaLightLtcResources === undefined
            ? {}
            : {
                standardAreaLightLtcResources: options.standardAreaLightLtcResources,
            }),
        ...(localLightClusterDescriptor === null
            ? {}
            : { localLightClusterDescriptor }),
        ...(options.localLightCookieResources === undefined ||
            options.localLightCookieResources === null
            ? {}
            : { localLightCookieResources: options.localLightCookieResources }),
        ...(options.transmissionSceneColorResources === undefined ||
            options.transmissionSceneColorResources === null
            ? {}
            : {
                transmissionSceneColorResources: options.transmissionSceneColorResources,
            }),
        textures: options.textureSamplerDependencies.textures,
        samplers: options.textureSamplerDependencies.samplers,
    });
    if (result.valid &&
        result.resources !== null &&
        result.resources.lightGpuBuffers.descriptorPlan !== null) {
        if (preparedMesh === null) {
            options.reuse.meshBuffersCreated += 1;
        }
        else if (preparedMesh.status === "reused") {
            options.reuse.meshBuffersReused += 1;
            options.reuse.preparedMeshBuffersReused += 1;
        }
        else {
            options.reuse.meshBuffersCreated += 1;
            options.reuse.preparedMeshBuffersCreated += 1;
        }
        if (preparedMaterial === null) {
            options.reuse.materialBuffersCreated += 1;
            options.reuse.bindGroupsCreated += result.resources.bindGroups.length;
        }
        else {
            recordPreparedAppMaterialResourceUse(options.reuse, preparedMaterial, result.resources.bindGroups.length);
        }
        options.reuse.lightBuffersCreated += 1;
        if (result.resources.localLightClusters !== undefined) {
            options.reuse.localLightClusterBuffersCreated += 4;
        }
        const cacheEntry = {
            meshKey: options.meshKey,
            materialKey: options.materialKey,
            pipelineKey: options.pipelineKey,
            materialLayoutKey,
            lightLayoutKey,
            standardMaterialIblBindGroupResourceKey,
            standardMaterialShadowReceiverResourceKey,
            transmissionSceneColorResourceKey,
            previousWorldTransformResourceKey: options.previousWorldTransforms?.resourceKey ?? null,
            textureKeys: [...options.textureSamplerDependencies.textureKeys],
            samplerKeys: [...options.textureSamplerDependencies.samplerKeys],
            viewByteLength: viewDescriptor.plan?.source.byteLength ??
                options.viewUniforms.data.byteLength,
            worldTransformByteLength: transformDescriptor.plan?.source.byteLength ??
                options.worldTransforms.data.byteLength,
            lightFloatByteLength: result.resources.lightGpuBuffers.descriptorPlan.source.floats
                .byteLength,
            lightMetadataByteLength: result.resources.lightGpuBuffers.descriptorPlan.source.metadata
                .byteLength,
            localLightClusterParamsByteLength: result.resources.localLightClusters?.descriptor.params.byteLength ?? 0,
            localLightClusterCellsByteLength: result.resources.localLightClusters?.descriptor.cells.byteLength ?? 0,
            localLightClusterIndicesByteLength: result.resources.localLightClusters?.descriptor.indices.byteLength ?? 0,
            localLightClusterMetadataByteLength: result.resources.localLightClusters?.descriptor.metadata.byteLength ??
                0,
            localLightClusterContentKeys,
            localLightClusterResourceKey,
            localLightCookieTextureKey,
            localLightCookieSamplerKey,
            localLightCookieMatrixKey,
            viewDescriptorScratch,
            worldTransformDescriptorScratch,
            lightBufferDescriptorScratch,
            lightBufferDescriptorPlanScratch,
            // Creation wrote the full initialData, so the buffer holds exactly this
            // packed content version (AI-64).
            worldTransformUploadStamp: {
                version: options.worldTransforms.contentVersion,
            },
            viewUploadStamp: { version: options.viewUniforms.contentVersion },
            result,
        };
        options.cache.current = cacheEntry;
        options.cache.byRoute?.set(routeCacheKey, cacheEntry);
    }
    return appendPreparedMaterialFallbackDiagnostics(result, preparedMaterialFallbackDiagnostics);
}
function requiresInstanceTintBuffer(pipelineKey) {
    return pipelineKey.split("|").includes("instance-tint");
}
function requiresSkinningJointBuffer(pipelineKey) {
    return pipelineKey.split("|").includes("skinned");
}
function requiresMorphTargetWeightBuffer(pipelineKey) {
    return pipelineKey.split("|").includes("morphed");
}
function supportedPointShadowResourcesFromReceiver(resources) {
    const pointResources = resources !== undefined && isMultiShadowKind(resources.shadowKind)
        ? resources.pointShadowReceiverResources
        : resources?.shadowKind === "point" ||
            resources?.shadowKind === "point-array" ||
            resources?.depthTextureResources.resources.some((resource) => resource.viewDimension === "cube" ||
                (resource.viewDimension === "2d-array" &&
                    resource.faceCount === 6)) === true
            ? resources
            : undefined;
    if (pointResources?.matrixBufferResource.resource === null ||
        pointResources?.samplerResource.resource === null) {
        return [];
    }
    const pointDepthResources = pointResources?.depthTextureResources.resources.filter((resource) => (resource.viewDimension === "cube" ||
        (resource.viewDimension === "2d-array" &&
            resource.faceCount === 6)) &&
        resource.allocation.resource !== null) ?? [];
    if (pointDepthResources.length === 0) {
        return [];
    }
    return pointDepthResources.map((resource, index) => ({
        shadowId: resource.shadowId,
        lightId: resource.lightId,
        matrixBaseIndex: resource.viewDimension === "2d-array"
            ? (resource.layerBaseIndex ?? index * 6)
            : index * 6,
        ...(resource.filterRadiusTexels === undefined
            ? {}
            : { filterRadiusTexels: resource.filterRadiusTexels }),
    }));
}
function supportedSpotShadowResourcesFromReceiver(resources) {
    const spotResources = resources !== undefined && isMultiShadowKind(resources.shadowKind)
        ? resources.spotShadowReceiverResources
        : resources?.shadowKind === "spot" ||
            resources?.shadowKind === "spot-array"
            ? resources
            : undefined;
    if (spotResources?.matrixBufferResource.resource === null ||
        spotResources?.samplerResource.resource === null) {
        return [];
    }
    const spotDepthResources = spotResources?.depthTextureResources.resources.filter((resource) => (resource.viewDimension === "2d" ||
        resource.viewDimension === "2d-array") &&
        resource.allocation.resource !== null) ?? [];
    if (spotDepthResources.length === 0) {
        return [];
    }
    return spotDepthResources.map((resource, index) => ({
        shadowId: resource.shadowId,
        lightId: resource.lightId,
        matrixBaseIndex: resource.viewDimension === "2d-array"
            ? (resource.layerBaseIndex ?? index)
            : index,
        ...(resource.filterRadiusTexels === undefined
            ? {}
            : { filterRadiusTexels: resource.filterRadiusTexels }),
    }));
}
function isMultiShadowKind(shadowKind) {
    return (shadowKind === "multi" ||
        shadowKind === "multi-spot-array" ||
        shadowKind === "multi-point-array" ||
        shadowKind === "multi-spot-array-point-array");
}
function recordStandardFrameResourceCacheHit(reuse) {
    reuse.standardFrameResourceCacheHits += 1;
}
function recordStandardFrameResourceCacheMiss(reuse, reason) {
    reuse.standardFrameResourceCacheMisses += 1;
    reuse.standardFrameResourceCacheMissReasons[reason] =
        (reuse.standardFrameResourceCacheMissReasons[reason] ?? 0) + 1;
}
function standardFrameResourceCachePreconditionFailure(input) {
    const cached = input.cached;
    if (cached === null) {
        return "no-route-entry";
    }
    const resources = cached.result.resources;
    if (resources === null) {
        return "cached-resources-null";
    }
    if (input.usingSharedFrameResources &&
        (resources.viewUniform !== input.sharedFrameResources.viewUniform ||
            resources.worldTransforms !== input.sharedFrameResources.worldTransforms)) {
        return "shared-frame-resource-mismatch";
    }
    if (resources.lightGpuBuffers.resource === null) {
        return "missing-light-buffer";
    }
    if (input.viewDescriptorPlan === null) {
        return "missing-view-descriptor";
    }
    if (input.transformDescriptorPlan === null) {
        return "missing-transform-descriptor";
    }
    if (input.lightDescriptorPlan === null) {
        return "missing-light-descriptor";
    }
    if (!input.usingSharedFrameResources &&
        cached.viewByteLength !== input.viewDescriptorPlan.source.byteLength) {
        return "view-byte-length-changed";
    }
    if (!input.usingSharedFrameResources &&
        cached.worldTransformByteLength !==
            input.transformDescriptorPlan.source.byteLength) {
        return "world-transform-byte-length-changed";
    }
    if (cached.lightFloatByteLength !==
        input.lightDescriptorPlan.source.floats.byteLength) {
        return "light-float-byte-length-changed";
    }
    if (cached.lightMetadataByteLength !==
        input.lightDescriptorPlan.source.metadata.byteLength) {
        return "light-metadata-byte-length-changed";
    }
    const localLightClusterDescriptor = input.localLightClusterDescriptor;
    if (localLightClusterDescriptor !== null) {
        if (input.cachedLocalLightClusters === null) {
            return "missing-local-light-cluster-cache";
        }
        if (cached.localLightClusterParamsByteLength !==
            localLightClusterDescriptor.params.byteLength) {
            return "local-light-cluster-params-byte-length-changed";
        }
        if (cached.localLightClusterCellsByteLength !==
            localLightClusterDescriptor.cells.byteLength) {
            return "local-light-cluster-cells-byte-length-changed";
        }
        if (cached.localLightClusterIndicesByteLength !==
            localLightClusterDescriptor.indices.byteLength) {
            return "local-light-cluster-indices-byte-length-changed";
        }
        if (cached.localLightClusterMetadataByteLength !==
            localLightClusterDescriptor.metadata.byteLength) {
            return "local-light-cluster-metadata-byte-length-changed";
        }
    }
    if (requiresInstanceTintBuffer(input.pipelineKey)) {
        return "requires-instance-tint-buffer";
    }
    if (requiresSkinningJointBuffer(input.pipelineKey)) {
        return "requires-skinning-joint-buffer";
    }
    if (requiresMorphTargetWeightBuffer(input.pipelineKey)) {
        return "requires-morph-target-weight-buffer";
    }
    return null;
}
function requiresClusteredLocalLights(pipelineKey) {
    return pipelineKey
        .split("|")
        .includes(CLUSTERED_LOCAL_LIGHT_PIPELINE_FEATURE);
}
function createLocalLightClusterContentKeys(descriptor) {
    return {
        params: typedArrayContentKey(descriptor.params),
        cells: typedArrayContentKey(descriptor.cells),
        indices: typedArrayContentKey(descriptor.indices),
        metadata: typedArrayContentKey(descriptor.metadata),
    };
}
function sameLocalLightClusterContentKeys(a, b) {
    return (a.params === b.params &&
        a.cells === b.cells &&
        a.indices === b.indices &&
        a.metadata === b.metadata);
}
function typedArrayContentKey(view) {
    const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    let hash = 2166136261;
    for (const byte of bytes) {
        hash ^= byte;
        hash = Math.imul(hash, 16777619);
    }
    return `${view.byteLength}:${(hash >>> 0).toString(16)}`;
}
function createStandardAppFrameResourceCacheKey(input) {
    return [
        input.meshKey,
        input.materialKey,
        input.pipelineKey,
        input.materialLayoutKey ?? "material-layout:none",
        input.lightLayoutKey ?? "light-layout:none",
        input.standardMaterialIblBindGroupResourceKey ?? "ibl:none",
        input.standardMaterialShadowReceiverResourceKey ?? "shadow:none",
        input.transmissionSceneColorResourceKey ?? "transmission:none",
        input.previousWorldTransformResourceKey ?? "previous-world:none",
        input.localLightClusterResourceKey ?? "local-light-cluster:none",
        input.localLightCookieTextureKey ?? "local-light-cookie-texture:none",
        input.localLightCookieSamplerKey ?? "local-light-cookie-sampler:none",
        input.localLightCookieMatrixKey ?? "local-light-cookie-matrix:none",
        `textures:${input.textureKeys.join(",")}`,
        `samplers:${input.samplerKeys.join(",")}`,
    ].join("|");
}
function appendPreparedMaterialFallbackDiagnostics(result, diagnostics) {
    return diagnostics.length === 0
        ? result
        : {
            ...result,
            diagnostics: [...result.diagnostics, ...diagnostics],
        };
}
function standardMaterialIblBindGroupResourceKeyFromResources(resources) {
    const report = resources?.bindGroupResource;
    return report?.status === "available" && report.resource !== null
        ? report.resource.resourceKey
        : null;
}
function standardMaterialShadowReceiverResourceKeyFromResources(resources) {
    if (resources === undefined) {
        return null;
    }
    const matrixKey = resources.matrixBufferResource.resource?.resourceKey ?? "";
    const depthKeys = resources.depthTextureResources.resources
        .map((resource) => resource.resourceKey)
        .join(",");
    const samplerKey = resources.samplerResource.resource?.resourceKey ?? "";
    return `${matrixKey}|${depthKeys}|${samplerKey}`;
}
function transmissionSceneColorResourceKeyFromResources(resources) {
    return resources?.texture.resourceKey ?? null;
}
//# sourceMappingURL=standard-app-frame-resources.js.map