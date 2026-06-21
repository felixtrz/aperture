import { prepareMatcapAppTextureSamplerResources, prepareStandardAppTextureSamplerResources, prepareUnlitAppTextureSamplerResources, emptyPreparedAppTextureSamplerResources, } from "./app-texture-sampler-resources.js";
import { createQueuedBuiltInAppResourceAdapterRegistry, createQueuedBuiltInAppResourceFamilyAdapterTable, queuedBuiltInAppResourceAdapterRegistryValidationReportToJsonValue, validateQueuedBuiltInAppResourceAdapterRegistry, } from "../materials/core/built-in-material-app-resource-adapter.js";
import { createOrReuseDebugNormalAppFrameResources } from "../materials/debug-normal/debug-normal-app-frame-resources.js";
import { createOrReuseMatcapAppFrameResources } from "../materials/matcap/matcap-app-frame-resources.js";
import { createOrReuseStandardAppFrameResources } from "../materials/standard/standard-app-frame-resources.js";
import { createOrReuseUnlitAppFrameResources } from "../materials/unlit/unlit-app-frame-resources.js";
export const QUEUED_BUILT_IN_MATERIAL_ADAPTERS = createQueuedBuiltInAppResourceAdapterRegistry({
    families: createQueuedBuiltInAppResourceFamilyAdapterTable({
        prepareUnlitTextureSamplerResources: (options) => prepareUnlitAppTextureSamplerResources({
            assets: options.assets,
            device: options.app.initialization.device,
            cache: options.cache,
            material: options.item.material,
            reuse: options.reuse,
        }),
        prepareMatcapTextureSamplerResources: (options) => prepareMatcapAppTextureSamplerResources({
            assets: options.assets,
            device: options.app.initialization.device,
            cache: options.cache,
            material: options.item.material,
            reuse: options.reuse,
        }),
        prepareStandardTextureSamplerResources: (options) => prepareStandardAppTextureSamplerResources({
            assets: options.assets,
            device: options.app.initialization.device,
            cache: options.cache,
            material: options.item.material,
            reuse: options.reuse,
        }),
        prepareDebugNormalTextureSamplerResources: () => emptyPreparedAppTextureSamplerResources(),
        createUnlitFrameResources: (options) => createOrReuseUnlitAppFrameResources({
            device: options.app.initialization.device,
            cache: options.cache.unlitFrame,
            mesh: options.item.mesh,
            meshHandle: options.item.draw.mesh,
            meshKey: options.item.meshKey,
            material: options.item.material,
            materialHandle: options.item.draw.material,
            materialKey: options.item.materialKey,
            sourceMaterialKey: options.item.sourceMaterialKey,
            frame: options.resourceLifetimeFrame,
            pipelineKey: options.item.draw.batchKey.pipelineKey,
            preparedMeshes: options.cache.preparedMeshes,
            preparedScalarMaterials: options.preparedMaterials.unlit,
            assets: options.assets,
            textureSamplerDependencies: options.textureSamplerDependencies,
            viewUniforms: options.viewUniforms,
            worldTransforms: options.worldTransforms,
            preparedViewUniform: options.preparedViewUniform,
            preparedWorldTransforms: options.preparedWorldTransforms,
            ...(options.previousWorldTransforms === undefined
                ? {}
                : { previousWorldTransforms: options.previousWorldTransforms }),
            layouts: options.layouts.sharedLayouts,
            bindGroupCache: options.sharedBindGroupCache,
            reuse: options.reuse,
        }),
        createMatcapFrameResources: (options) => createOrReuseMatcapAppFrameResources({
            device: options.app.initialization.device,
            cache: options.cache.matcapFrame,
            mesh: options.item.mesh,
            meshHandle: options.item.draw.mesh,
            meshKey: options.item.meshKey,
            material: options.item.material,
            materialHandle: options.item.draw.material,
            materialKey: options.item.materialKey,
            sourceMaterialKey: options.item.sourceMaterialKey,
            frame: options.resourceLifetimeFrame,
            pipelineKey: options.item.draw.batchKey.pipelineKey,
            assets: options.assets,
            textureSamplerDependencies: options.textureSamplerDependencies,
            viewUniforms: options.viewUniforms,
            worldTransforms: options.worldTransforms,
            preparedViewUniform: options.preparedViewUniform,
            preparedWorldTransforms: options.preparedWorldTransforms,
            ...(options.previousWorldTransforms === undefined
                ? {}
                : { previousWorldTransforms: options.previousWorldTransforms }),
            ...(options.instanceTints === undefined
                ? {}
                : { instanceTints: options.instanceTints }),
            sharedLayouts: options.layouts.sharedLayouts,
            materialLayout: options.layouts
                .materialLayout,
            bindGroupCache: options.sharedBindGroupCache,
            preparedMeshes: options.cache.preparedMeshes,
            preparedMatcapMaterials: options.preparedMaterials.matcap,
            reuse: options.reuse,
        }),
        createStandardFrameResources: (options) => createOrReuseStandardAppFrameResources({
            device: options.app.initialization.device,
            cache: options.cache.standardFrame,
            snapshot: options.snapshot,
            draw: options.item.draw,
            mesh: options.item.mesh,
            meshHandle: options.item.draw.mesh,
            meshKey: options.item.meshKey,
            material: options.item.material,
            materialHandle: options.item.draw.material,
            materialKey: options.item.materialKey,
            sourceMaterialKey: options.item.sourceMaterialKey,
            resourceLifetimeFrame: options.resourceLifetimeFrame,
            pipelineKey: options.item.draw.batchKey.pipelineKey,
            assets: options.assets,
            textureSamplerDependencies: options.textureSamplerDependencies,
            viewUniforms: options.viewUniforms,
            worldTransforms: options.worldTransforms,
            preparedViewUniform: options.preparedViewUniform,
            preparedWorldTransforms: options.preparedWorldTransforms,
            ...(options.previousWorldTransforms === undefined
                ? {}
                : { previousWorldTransforms: options.previousWorldTransforms }),
            ...(options.instanceTints === undefined
                ? {}
                : { instanceTints: options.instanceTints }),
            sharedLayouts: options.layouts.sharedLayouts,
            materialLayout: options.layouts
                .materialLayout,
            lightLayout: options.layouts.lightLayout,
            sharedBindGroupCache: options.sharedBindGroupCache,
            lightBindGroupCache: options.lightBindGroupCache,
            standardLightShadowBindGroupCache: options.standardLightShadowBindGroupCache,
            ...(options.standardMaterialShadowReceiverResources === undefined
                ? {}
                : {
                    shadowReceiverResources: options.standardMaterialShadowReceiverResources,
                }),
            ...(options.standardMaterialIblResources === undefined
                ? {}
                : {
                    standardMaterialIblResources: options.standardMaterialIblResources,
                }),
            ...(options.standardAreaLightLtcResources === undefined
                ? {}
                : {
                    standardAreaLightLtcResources: options.standardAreaLightLtcResources,
                }),
            ...(options.localLightCookieResources === undefined ||
                options.localLightCookieResources === null
                ? {}
                : {
                    localLightCookieResources: options.localLightCookieResources,
                }),
            ...(options.transmissionSceneColorResources === undefined ||
                options.transmissionSceneColorResources === null
                ? {}
                : {
                    transmissionSceneColorResources: options.transmissionSceneColorResources,
                }),
            preparedMeshes: options.cache.preparedMeshes,
            preparedScalarMaterials: options.preparedMaterials.standard,
            reuse: options.reuse,
        }),
        createDebugNormalFrameResources: (options) => createOrReuseDebugNormalAppFrameResources({
            device: options.app.initialization.device,
            cache: options.cache.debugNormalFrame,
            mesh: options.item.mesh,
            meshHandle: options.item.draw.mesh,
            meshKey: options.item.meshKey,
            material: options.item.material,
            materialHandle: options.item.draw.material,
            materialKey: options.item.materialKey,
            sourceMaterialKey: options.item.sourceMaterialKey,
            frame: options.resourceLifetimeFrame,
            pipelineKey: options.item.draw.batchKey.pipelineKey,
            assets: options.assets,
            viewUniforms: options.viewUniforms,
            worldTransforms: options.worldTransforms,
            preparedViewUniform: options.preparedViewUniform,
            preparedWorldTransforms: options.preparedWorldTransforms,
            ...(options.previousWorldTransforms === undefined
                ? {}
                : { previousWorldTransforms: options.previousWorldTransforms }),
            sharedLayouts: options.layouts.sharedLayouts,
            materialLayout: options.layouts
                .materialLayout,
            bindGroupCache: options.sharedBindGroupCache,
            preparedMeshes: options.cache.preparedMeshes,
            preparedDebugNormalMaterials: options.preparedMaterials.debugNormal,
            reuse: options.reuse,
        }),
    }),
});
export const QUEUED_BUILT_IN_APP_RESOURCE_ADAPTER_VALIDATION = queuedBuiltInAppResourceAdapterRegistryValidationReportToJsonValue(validateQueuedBuiltInAppResourceAdapterRegistry(QUEUED_BUILT_IN_MATERIAL_ADAPTERS));
//# sourceMappingURL=queued-built-in-adapters.js.map