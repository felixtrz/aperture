import { assetHandleKey } from "/aperture/worker-modules/packages/simulation/dist/index.js";
import { sameStringList, writeVersionedBufferData, } from "../../app/app-frame-resource-utils.js";
import { createPreparedAppMaterialFallbackDiagnostic, recordPreparedAppMaterialResourceUse, } from "../core/prepared-app-material-resource.js";
import { createUnlitFrameGpuResources, } from "./unlit-frame-resources.js";
import { prepareScalarUnlitMaterialResource, prepareTexturedUnlitMaterialResource, } from "./prepared-unlit-material-cache.js";
import { prepareAppMeshResource, } from "../../resources/meshes/prepared-app-mesh-resource.js";
import { createViewUniformBufferDescriptorScratch, writeViewUniformBufferDescriptor, } from "../../resources/views/view-uniform-buffer.js";
import { createWorldTransformBufferDescriptorScratch, writeWorldTransformBufferDescriptor, } from "../../resources/transforms/world-transform-buffer.js";
export function createOrReuseUnlitAppFrameResources(options) {
    const cached = options.cache.current;
    const viewDescriptorScratch = cached?.viewDescriptorScratch ?? createViewUniformBufferDescriptorScratch();
    const worldTransformDescriptorScratch = cached?.worldTransformDescriptorScratch ??
        createWorldTransformBufferDescriptorScratch();
    const viewDescriptor = writeViewUniformBufferDescriptor(options.viewUniforms, viewDescriptorScratch);
    const transformDescriptor = writeWorldTransformBufferDescriptor(options.worldTransforms, worldTransformDescriptorScratch);
    // AI-64/AI-65: dirty-range/skip upload outcomes for accounting. Holder
    // objects: TS flow analysis cannot see the closure assignment ordering, so
    // plain lets would narrow back to "full" at the use sites.
    const worldTransformUpload = {
        value: "full",
    };
    const viewUniformUpload = { value: "full" };
    const usingSharedFrameResources = options.preparedViewUniform !== undefined &&
        options.preparedWorldTransforms !== undefined;
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
    if (cached !== null &&
        cached.meshKey === options.meshKey &&
        cached.materialKey === options.materialKey &&
        sameStringList(cached.textureKeys, options.textureSamplerDependencies.textureKeys) &&
        sameStringList(cached.samplerKeys, options.textureSamplerDependencies.samplerKeys) &&
        cached.previousWorldTransformResourceKey ===
            (options.previousWorldTransforms?.resourceKey ?? null) &&
        cached.result.resources !== null &&
        viewDescriptor.plan !== null &&
        transformDescriptor.plan !== null &&
        cached.viewByteLength === viewDescriptor.plan.source.byteLength &&
        cached.worldTransformByteLength ===
            transformDescriptor.plan.source.byteLength &&
        (!usingSharedFrameResources ||
            (cached.result.resources.viewUniform === options.preparedViewUniform &&
                cached.result.resources.worldTransforms ===
                    options.preparedWorldTransforms)) &&
        (usingSharedFrameResources || writeCachedViewUniformBuffer()) &&
        (usingSharedFrameResources || writeCachedWorldTransformBuffer())) {
        options.reuse.meshBuffersReused += 1;
        options.reuse.materialBuffersReused += 1;
        options.reuse.bindGroupsReused += cached.result.resources.bindGroups.length;
        options.reuse.dynamicBufferWrites += usingSharedFrameResources
            ? 0
            : 2 -
                (worldTransformUpload.value === "skipped" ? 1 : 0) -
                (viewUniformUpload.value === "skipped" ? 1 : 0);
        const resources = cached.result.resources;
        resources.viewUniform.views = viewDescriptor.plan.views;
        resources.worldTransforms.offsets = transformDescriptor.plan.offsets;
        return cached.result;
    }
    const preparedMaterialFallbackDiagnostics = [];
    const preparedMesh = preparePreparedScalarUnlitMesh(options);
    const preparedMaterial = preparePreparedUnlitMaterial(options, preparedMaterialFallbackDiagnostics);
    const result = createUnlitFrameGpuResources({
        device: options.device,
        mesh: options.mesh,
        ...(preparedMesh === null
            ? {}
            : { preparedMesh: preparedMesh.resource.mesh }),
        material: options.material,
        ...(preparedMaterial === null
            ? {}
            : { preparedMaterial: preparedMaterial.resource }),
        viewUniforms: options.viewUniforms,
        ...(options.preparedViewUniform === undefined
            ? {}
            : { preparedViewUniform: options.preparedViewUniform }),
        worldTransforms: options.worldTransforms,
        ...(options.preparedWorldTransforms === undefined
            ? {}
            : { preparedWorldTransforms: options.preparedWorldTransforms }),
        ...(options.previousWorldTransforms === undefined
            ? {}
            : { previousWorldTransforms: options.previousWorldTransforms }),
        layouts: options.layouts,
        bindGroupCache: options.bindGroupCache,
        textures: options.textureSamplerDependencies.textures,
        samplers: options.textureSamplerDependencies.samplers,
    });
    if (result.valid && result.resources !== null) {
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
        options.cache.current = {
            meshKey: options.meshKey,
            materialKey: options.materialKey,
            textureKeys: [...options.textureSamplerDependencies.textureKeys],
            samplerKeys: [...options.textureSamplerDependencies.samplerKeys],
            previousWorldTransformResourceKey: options.previousWorldTransforms?.resourceKey ?? null,
            viewByteLength: viewDescriptor.plan?.source.byteLength ??
                options.viewUniforms.data.byteLength,
            worldTransformByteLength: transformDescriptor.plan?.source.byteLength ??
                options.worldTransforms.data.byteLength,
            viewDescriptorScratch,
            worldTransformDescriptorScratch,
            worldTransformUploadStamp: {
                version: options.worldTransforms.contentVersion,
            },
            viewUploadStamp: { version: options.viewUniforms.contentVersion },
            result,
        };
    }
    return appendPreparedMaterialFallbackDiagnostics(result, preparedMaterialFallbackDiagnostics);
}
function preparePreparedScalarUnlitMesh(options) {
    if (options.mesh === null ||
        options.material === null ||
        options.material.kind !== "unlit" ||
        options.material.baseColorTexture !== null) {
        return null;
    }
    return prepareAppMeshResource({
        device: options.device,
        mesh: options.mesh,
        meshHandle: options.meshHandle,
        meshKey: options.meshKey,
        frame: options.frame,
        preparedMeshes: options.preparedMeshes,
    });
}
function preparePreparedUnlitMaterial(options, fallbackDiagnostics) {
    if (options.material === null || options.material.kind !== "unlit") {
        return null;
    }
    const sourceVersion = sourceVersionFromAssetKey(options.materialKey, options.sourceMaterialKey);
    if (sourceVersion === null) {
        return null;
    }
    const layout = options.layouts.find((candidate) => candidate.group === 2) ?? null;
    const result = options.material.baseColorTexture === null
        ? prepareScalarUnlitMaterialResource({
            registry: options.assets,
            device: options.device,
            cache: options.preparedScalarMaterials,
            handle: options.materialHandle,
            material: options.material,
            sourceVersion,
            frame: options.frame,
            pipelineKey: options.pipelineKey,
            layout,
        })
        : prepareTexturedUnlitMaterialResource({
            registry: options.assets,
            device: options.device,
            cache: options.preparedScalarMaterials,
            handle: options.materialHandle,
            material: options.material,
            sourceVersion,
            frame: options.frame,
            pipelineKey: options.pipelineKey,
            layout,
            textures: options.textureSamplerDependencies.textures,
            samplers: options.textureSamplerDependencies.samplers,
        });
    if (result.valid &&
        result.resource !== null &&
        (result.status === "created" || result.status === "reused")) {
        return { status: result.status, resource: result.resource };
    }
    const diagnostic = createPreparedAppMaterialFallbackDiagnostic({
        materialFamily: "unlit",
        materialKey: assetHandleKey(options.materialHandle),
        status: result.status,
        diagnostics: result.diagnostics,
    });
    if (diagnostic !== null) {
        fallbackDiagnostics.push(diagnostic);
    }
    return null;
}
function appendPreparedMaterialFallbackDiagnostics(result, diagnostics) {
    return diagnostics.length === 0
        ? result
        : {
            ...result,
            diagnostics: [...result.diagnostics, ...diagnostics],
        };
}
function sourceVersionFromAssetKey(assetKey, sourceAssetKey) {
    const prefix = `${sourceAssetKey}@`;
    if (!assetKey.startsWith(prefix)) {
        return null;
    }
    const version = Number.parseInt(assetKey.slice(prefix.length), 10);
    return Number.isFinite(version) ? version : null;
}
//# sourceMappingURL=unlit-app-frame-resources.js.map