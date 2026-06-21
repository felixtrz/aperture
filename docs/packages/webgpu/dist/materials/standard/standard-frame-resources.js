import { createLightBindGroupDescriptorPlan, createLightBindGroupResource, } from "../../lighting/light-bind-group.js";
import { createLocalLightClusterResource, requiresClusteredLocalLightBuffer, requiresClusteredLocalLightCookies, reusesShadowMatricesForClusteredLocalLightCookies, } from "./standard-frame-local-light-resources.js";
import { createInstanceTintResource, createMaterialResource, createMeshResource, createMorphTargetWeightResource, createMorphTargetDeltaResource, createMorphInstanceDescriptorResource, createSkinningJointResource, createViewUniformResource, createWorldTransformResource, requiresInstanceTintBuffer, requiresMorphTargetWeightBuffer, requiresSkinningJointBuffer, } from "./standard-frame-base-resources.js";
import { createSnapshotLightGpuBuffers, } from "../../lighting/lighting-resource-plan.js";
import { createStandardMaterialBindGroupDescriptorPlan, createStandardMaterialBindGroupResource, } from "./standard-bind-group.js";
import { createStandardLightIblBindGroupDescriptorPlan, createStandardLightMultiShadowBindGroupDescriptorPlan, createStandardLightShadowBindGroupDescriptorPlan, createStandardLightShadowBindGroupResource, } from "./standard-light-shadow-bind-group.js";
import { createUnlitBindGroupsFromGpuResources, } from "../unlit/unlit-bind-group.js";
export function createStandardFrameGpuResources(options) {
    const diagnostics = [];
    const mesh = createMeshResource(options, diagnostics);
    const viewUniform = options.preparedViewUniform ??
        createViewUniformResource(options, diagnostics);
    const worldTransforms = options.preparedWorldTransforms ??
        createWorldTransformResource(options, diagnostics);
    const instanceTints = createInstanceTintResource(options, diagnostics);
    const skinningJointMatrices = createSkinningJointResource(options, diagnostics);
    const morphTargetWeights = createMorphTargetWeightResource(options, diagnostics);
    const morphTargetDeltas = createMorphTargetDeltaResource(options, diagnostics);
    const morphInstanceDescriptors = createMorphInstanceDescriptorResource(options, diagnostics);
    const material = options.preparedMaterial?.material ??
        createMaterialResource(options, diagnostics);
    const sharedBindGroups = createSharedBindGroups(options, viewUniform, worldTransforms, skinningJointMatrices, morphTargetWeights, morphTargetDeltas, morphInstanceDescriptors, diagnostics);
    const materialBindGroup = options.preparedMaterial?.bindGroup ??
        createMaterialBindGroup(options, material, diagnostics);
    const lightGpuBuffers = createSnapshotLightGpuBuffers(options.snapshot, {
        device: options.device,
    });
    diagnostics.push(...lightGpuBuffers.diagnostics);
    if (lightGpuBuffers.valid && lightGpuBuffers.resource === null) {
        diagnostics.push({
            code: "standardFrameResources.missingLights",
            message: "Standard frame GPU resource creation requires at least one extracted light.",
        });
    }
    const localLightClusters = createLocalLightClusterResource(options, diagnostics);
    const lightBindGroup = createLightBindGroup(options, lightGpuBuffers, localLightClusters, diagnostics);
    const standardMaterialIblBindGroup = resolveStandardMaterialIblBindGroupResource(options);
    if (mesh === null ||
        viewUniform === null ||
        worldTransforms === null ||
        (requiresInstanceTintBuffer(options.pipelineKey) &&
            instanceTints === null) ||
        (requiresSkinningJointBuffer(options.pipelineKey) &&
            skinningJointMatrices === null) ||
        (requiresMorphTargetWeightBuffer(options.pipelineKey) &&
            (morphTargetWeights === null ||
                morphTargetDeltas === null ||
                morphInstanceDescriptors === null)) ||
        material === null ||
        !sharedBindGroups.valid ||
        materialBindGroup === null ||
        !lightGpuBuffers.valid ||
        lightGpuBuffers.resource === null ||
        (requiresClusteredLocalLightBuffer(options.pipelineKey) &&
            localLightClusters === null) ||
        lightBindGroup === null) {
        return { valid: false, resources: null, diagnostics };
    }
    return {
        valid: diagnostics.length === 0,
        resources: {
            mesh,
            viewUniform,
            worldTransforms,
            ...(options.previousWorldTransforms === undefined ||
                options.previousWorldTransforms === null
                ? {}
                : { previousWorldTransforms: options.previousWorldTransforms }),
            ...(instanceTints === null ? {} : { instanceTints }),
            ...(skinningJointMatrices === null ? {} : { skinningJointMatrices }),
            ...(morphTargetWeights === null ? {} : { morphTargetWeights }),
            ...(morphTargetDeltas === null ? {} : { morphTargetDeltas }),
            ...(morphInstanceDescriptors === null
                ? {}
                : { morphInstanceDescriptors }),
            material,
            lightGpuBuffers,
            ...(localLightClusters === null ? {} : { localLightClusters }),
            materialBindGroup,
            lightBindGroup,
            ...(standardMaterialIblBindGroup === null
                ? {}
                : { standardMaterialIblBindGroup }),
            bindGroups: [
                ...sharedBindGroups.resources,
                materialBindGroup,
                lightBindGroup,
            ],
        },
        diagnostics,
    };
}
function resolveStandardMaterialIblBindGroupResource(options) {
    const report = options.standardMaterialIblResources?.bindGroupResource;
    return report?.status === "available" && report.resource !== null
        ? report.resource
        : null;
}
function createSharedBindGroups(options, viewUniform, worldTransforms, skinningJointMatrices, morphTargetWeights, morphTargetDeltas, morphInstanceDescriptors, diagnostics) {
    const plan = createSharedBindGroupDescriptorPlan({
        viewUniformResourceKey: viewUniform?.resourceKey ?? null,
        worldTransformResourceKey: worldTransforms?.resourceKey ?? null,
        ...(requiresSkinningJointBuffer(options.pipelineKey)
            ? {
                skinningJointResourceKey: skinningJointMatrices?.resourceKey ?? null,
            }
            : {}),
        ...(requiresMorphTargetWeightBuffer(options.pipelineKey)
            ? {
                morphTargetWeightResourceKey: morphTargetWeights?.resourceKey ?? null,
                morphTargetDeltaResourceKey: morphTargetDeltas?.resourceKey ?? null,
                morphInstanceDescriptorResourceKey: morphInstanceDescriptors?.resourceKey ?? null,
            }
            : {}),
        ...(options.previousWorldTransforms === undefined
            ? {}
            : {
                previousWorldTransformResourceKey: options.previousWorldTransforms?.resourceKey ?? null,
            }),
    });
    diagnostics.push(...plan.diagnostics);
    const result = createUnlitBindGroupsFromGpuResources({
        device: options.device,
        plan,
        layouts: options.sharedLayouts,
        requiredGroups: [0, 1],
        bindGroupCache: options.sharedBindGroupCache,
        buffers: [
            ...(viewUniform === null
                ? []
                : [
                    {
                        resourceKey: viewUniform.resourceKey,
                        buffer: viewUniform.buffer,
                    },
                ]),
            ...(worldTransforms === null
                ? []
                : [
                    {
                        resourceKey: worldTransforms.resourceKey,
                        buffer: worldTransforms.buffer,
                    },
                ]),
            ...(skinningJointMatrices === null
                ? []
                : [
                    {
                        resourceKey: skinningJointMatrices.resourceKey,
                        buffer: skinningJointMatrices.buffer,
                    },
                ]),
            ...(morphTargetWeights === null
                ? []
                : [
                    {
                        resourceKey: morphTargetWeights.resourceKey,
                        buffer: morphTargetWeights.buffer,
                    },
                ]),
            ...(morphTargetDeltas === null
                ? []
                : [
                    {
                        resourceKey: morphTargetDeltas.resourceKey,
                        buffer: morphTargetDeltas.buffer,
                    },
                ]),
            ...(morphInstanceDescriptors === null
                ? []
                : [
                    {
                        resourceKey: morphInstanceDescriptors.resourceKey,
                        buffer: morphInstanceDescriptors.buffer,
                    },
                ]),
            ...(options.previousWorldTransforms === undefined ||
                options.previousWorldTransforms === null
                ? []
                : [
                    {
                        resourceKey: options.previousWorldTransforms.resourceKey,
                        buffer: options.previousWorldTransforms.buffer,
                    },
                ]),
        ],
    });
    diagnostics.push(...result.diagnostics);
    return result;
}
function createMaterialBindGroup(options, material, diagnostics) {
    const plan = material === null
        ? null
        : createStandardMaterialBindGroupDescriptorPlan({
            materialResourceKey: material.resourceKey,
            dependencies: material.dependencies,
        });
    if (plan !== null) {
        diagnostics.push(...plan.diagnostics);
    }
    const result = createStandardMaterialBindGroupResource({
        device: options.device,
        plan,
        layout: options.materialLayout,
        buffers: material === null
            ? []
            : [
                {
                    resourceKey: material.resourceKey,
                    buffer: material.uniformBuffer,
                },
            ],
        ...(options.textures === undefined ? {} : { textures: options.textures }),
        ...(options.samplers === undefined ? {} : { samplers: options.samplers }),
    });
    diagnostics.push(...result.diagnostics);
    return result.valid ? result.resource : null;
}
function createLightBindGroup(options, lightGpuBuffers, localLightClusters, diagnostics) {
    if (options.pipelineKey.includes("iblDiffuse") &&
        options.standardMaterialIblResources !== undefined) {
        return createLightIblBindGroup(options, lightGpuBuffers, localLightClusters, diagnostics);
    }
    if ((options.pipelineKey.includes("shadowMap") ||
        options.pipelineKey.includes("pointShadowMap")) &&
        options.shadowReceiverResources !== undefined) {
        return createLightShadowBindGroup(options, lightGpuBuffers, localLightClusters, diagnostics);
    }
    const plan = createLightBindGroupDescriptorPlan({
        lightGpuBufferResource: lightGpuBuffers.resource,
        layoutKey: options.lightLayout?.layoutKey ?? null,
        label: "standard/lights",
        areaLightLtcResources: options.standardAreaLightLtcResources ?? null,
        localLightClusterResources: localLightClusters,
        localLightCookieResources: requiresClusteredLocalLightCookies(options.pipelineKey)
            ? (options.localLightCookieResources ?? null)
            : null,
        ...(options.transmissionSceneColorResources === undefined ||
            options.transmissionSceneColorResources === null ||
            !options.pipelineKey.split("|").includes("transmission")
            ? {}
            : {
                transmissionSceneColorResources: options.transmissionSceneColorResources,
                pipelineKey: options.pipelineKey,
            }),
        ...(options.lightLayout === null
            ? {}
            : { group: options.lightLayout.group }),
    });
    diagnostics.push(...plan.diagnostics);
    const result = createLightBindGroupResource({
        device: options.device,
        plan,
        layout: options.lightLayout,
        bindGroupCache: options.lightBindGroupCache,
    });
    diagnostics.push(...result.diagnostics);
    return result.valid ? result.resource : null;
}
function createLightIblBindGroup(options, lightGpuBuffers, localLightClusters, diagnostics) {
    const iblResources = options.standardMaterialIblResources;
    if (iblResources === undefined ||
        iblResources.diffuseTextureResource === undefined ||
        iblResources.samplerResource === undefined) {
        return null;
    }
    const shadowRequired = options.pipelineKey.includes("shadowMap") ||
        options.pipelineKey.includes("pointShadowMap");
    const shadowReceiverResources = shadowRequired
        ? options.shadowReceiverResources
        : undefined;
    const cascadedShadowMap = options.pipelineKey.includes("cascadedShadowMap");
    const plan = createStandardLightIblBindGroupDescriptorPlan({
        lightGpuBufferResource: lightGpuBuffers.resource,
        layoutKey: options.lightLayout?.layoutKey ?? null,
        label: shadowRequired
            ? "standard/lights-shadow-ibl"
            : "standard/lights-ibl",
        diffuseTextureResource: iblResources.diffuseTextureResource,
        ...((options.pipelineKey.includes("iblSpecularProof") ||
            options.pipelineKey.includes("iblSpecularBrdf")) &&
            iblResources.specularTextureResource !== undefined
            ? { specularTextureResource: iblResources.specularTextureResource }
            : {}),
        samplerResource: iblResources.samplerResource,
        shadowRequired,
        cascadedShadowMap,
        areaLightLtcResources: options.standardAreaLightLtcResources ?? null,
        localLightClusterResources: localLightClusters,
        localLightCookieResources: requiresClusteredLocalLightCookies(options.pipelineKey)
            ? (options.localLightCookieResources ?? null)
            : null,
        reuseShadowMatricesForLocalLightCookies: reusesShadowMatricesForClusteredLocalLightCookies(options.pipelineKey),
        ...(shadowReceiverResources === undefined
            ? {}
            : { shadowReceiverResources }),
    });
    diagnostics.push(...plan.diagnostics);
    const result = createStandardLightShadowBindGroupResource({
        device: options.device,
        plan,
        layout: options.lightLayout,
        bindGroupCache: options.standardLightShadowBindGroupCache,
        lightGpuBufferResource: lightGpuBuffers.resource,
        matrixBufferResource: shadowReceiverResources?.matrixBufferResource ??
            emptyShadowMatrixBufferResourceReport(),
        depthTextureResources: shadowReceiverResources?.depthTextureResources ??
            emptyShadowDepthTextureResourceReport(),
        samplerResource: shadowReceiverResources?.samplerResource ??
            emptyShadowSamplerResourceReport(),
        diffuseTextureResource: iblResources.diffuseTextureResource,
        ...((options.pipelineKey.includes("iblSpecularProof") ||
            options.pipelineKey.includes("iblSpecularBrdf")) &&
            iblResources.specularTextureResource !== undefined
            ? { specularTextureResource: iblResources.specularTextureResource }
            : {}),
        iblSamplerResource: iblResources.samplerResource,
        areaLightLtcResources: options.standardAreaLightLtcResources ?? null,
        localLightClusterResources: localLightClusters,
        localLightCookieResources: requiresClusteredLocalLightCookies(options.pipelineKey)
            ? (options.localLightCookieResources ?? null)
            : null,
    });
    diagnostics.push(...result.diagnostics);
    return result.valid ? result.resource : null;
}
function createLightShadowBindGroup(options, lightGpuBuffers, localLightClusters, diagnostics) {
    const shadowReceiverResources = options.shadowReceiverResources;
    if (shadowReceiverResources === undefined) {
        return null;
    }
    if (options.pipelineKey.includes("shadowMap") &&
        options.pipelineKey.includes("pointShadowMap") &&
        shadowReceiverResources.spotShadowReceiverResources !== undefined &&
        shadowReceiverResources.pointShadowReceiverResources !== undefined) {
        const plan = createStandardLightMultiShadowBindGroupDescriptorPlan({
            lightGpuBufferResource: lightGpuBuffers.resource,
            layoutKey: options.lightLayout?.layoutKey ?? null,
            label: "standard/lights-multi-shadow",
            directionalShadowReceiverResources: shadowReceiverResources,
            spotShadowReceiverResources: shadowReceiverResources.spotShadowReceiverResources,
            pointShadowReceiverResources: shadowReceiverResources.pointShadowReceiverResources,
            areaLightLtcResources: options.standardAreaLightLtcResources ?? null,
            localLightClusterResources: localLightClusters,
            localLightCookieResources: requiresClusteredLocalLightCookies(options.pipelineKey)
                ? (options.localLightCookieResources ?? null)
                : null,
            reuseShadowMatricesForLocalLightCookies: reusesShadowMatricesForClusteredLocalLightCookies(options.pipelineKey),
        });
        diagnostics.push(...plan.diagnostics);
        const result = createStandardLightShadowBindGroupResource({
            device: options.device,
            plan,
            layout: options.lightLayout,
            bindGroupCache: options.standardLightShadowBindGroupCache,
            lightGpuBufferResource: lightGpuBuffers.resource,
            matrixBufferResource: shadowReceiverResources.matrixBufferResource,
            depthTextureResources: shadowReceiverResources.depthTextureResources,
            samplerResource: shadowReceiverResources.samplerResource,
            additionalShadowReceiverResources: [
                shadowReceiverResources.spotShadowReceiverResources,
                shadowReceiverResources.pointShadowReceiverResources,
            ],
            areaLightLtcResources: options.standardAreaLightLtcResources ?? null,
            localLightClusterResources: localLightClusters,
            localLightCookieResources: requiresClusteredLocalLightCookies(options.pipelineKey)
                ? (options.localLightCookieResources ?? null)
                : null,
        });
        diagnostics.push(...result.diagnostics);
        return result.valid ? result.resource : null;
    }
    const plan = createStandardLightShadowBindGroupDescriptorPlan({
        lightGpuBufferResource: lightGpuBuffers.resource,
        layoutKey: options.lightLayout?.layoutKey ?? null,
        label: "standard/lights-shadow",
        matrixBufferResource: shadowReceiverResources.matrixBufferResource,
        depthTextureResources: shadowReceiverResources.depthTextureResources,
        samplerResource: shadowReceiverResources.samplerResource,
        areaLightLtcResources: options.standardAreaLightLtcResources ?? null,
        localLightClusterResources: localLightClusters,
        localLightCookieResources: requiresClusteredLocalLightCookies(options.pipelineKey)
            ? (options.localLightCookieResources ?? null)
            : null,
        reuseShadowMatricesForLocalLightCookies: reusesShadowMatricesForClusteredLocalLightCookies(options.pipelineKey),
    });
    diagnostics.push(...plan.diagnostics);
    const result = createStandardLightShadowBindGroupResource({
        device: options.device,
        plan,
        layout: options.lightLayout,
        bindGroupCache: options.standardLightShadowBindGroupCache,
        lightGpuBufferResource: lightGpuBuffers.resource,
        matrixBufferResource: shadowReceiverResources.matrixBufferResource,
        depthTextureResources: shadowReceiverResources.depthTextureResources,
        samplerResource: shadowReceiverResources.samplerResource,
        areaLightLtcResources: options.standardAreaLightLtcResources ?? null,
        localLightClusterResources: localLightClusters,
        localLightCookieResources: requiresClusteredLocalLightCookies(options.pipelineKey)
            ? (options.localLightCookieResources ?? null)
            : null,
    });
    diagnostics.push(...result.diagnostics);
    return result.valid ? result.resource : null;
}
function createSharedBindGroupDescriptorPlan(input) {
    const diagnostics = [];
    const entries = [];
    if (input.viewUniformResourceKey === null) {
        diagnostics.push({
            code: "unlitBindGroup.missingViewResource",
            message: "Standard shared bind group planning requires a view uniform.",
        });
    }
    else {
        entries.push({
            group: 0,
            binding: 0,
            resourceKey: input.viewUniformResourceKey,
            resourceKind: "buffer",
        });
    }
    if (input.worldTransformResourceKey === null) {
        diagnostics.push({
            code: "unlitBindGroup.missingTransformResource",
            message: "Standard shared bind group planning requires a world transform buffer.",
        });
    }
    else {
        entries.push({
            group: 1,
            binding: 0,
            resourceKey: input.worldTransformResourceKey,
            resourceKind: "buffer",
        });
    }
    if (input.skinningJointResourceKey === null) {
        diagnostics.push({
            code: "unlitBindGroup.missingTransformResource",
            message: "Standard skinned shared bind group planning requires a skinning joint matrix buffer.",
        });
    }
    else if (input.skinningJointResourceKey !== undefined) {
        entries.push({
            group: 1,
            binding: 1,
            resourceKey: input.skinningJointResourceKey,
            resourceKind: "buffer",
        });
    }
    if (input.morphTargetWeightResourceKey === null) {
        diagnostics.push({
            code: "unlitBindGroup.missingTransformResource",
            message: "Standard morphed shared bind group planning requires a morph target weight buffer.",
        });
    }
    else if (input.morphTargetWeightResourceKey !== undefined) {
        entries.push({
            group: 1,
            binding: 2,
            resourceKey: input.morphTargetWeightResourceKey,
            resourceKind: "buffer",
        });
    }
    if (input.morphTargetDeltaResourceKey === null) {
        diagnostics.push({
            code: "unlitBindGroup.missingTransformResource",
            message: "Standard morphed shared bind group planning requires a morph target delta buffer.",
        });
    }
    else if (input.morphTargetDeltaResourceKey !== undefined) {
        entries.push({
            group: 1,
            binding: 4,
            resourceKey: input.morphTargetDeltaResourceKey,
            resourceKind: "buffer",
        });
    }
    if (input.morphInstanceDescriptorResourceKey === null) {
        diagnostics.push({
            code: "unlitBindGroup.missingTransformResource",
            message: "Standard morphed shared bind group planning requires a morph instance descriptor buffer.",
        });
    }
    else if (input.morphInstanceDescriptorResourceKey !== undefined) {
        entries.push({
            group: 1,
            binding: 5,
            resourceKey: input.morphInstanceDescriptorResourceKey,
            resourceKind: "buffer",
        });
    }
    if (input.previousWorldTransformResourceKey !== undefined) {
        if (input.previousWorldTransformResourceKey === null) {
            diagnostics.push({
                code: "unlitBindGroup.missingTransformResource",
                message: "Standard motion-vector shared bind group planning requires a previous world transform buffer.",
            });
        }
        else {
            entries.push({
                group: 1,
                binding: 3,
                resourceKey: input.previousWorldTransformResourceKey,
                resourceKind: "buffer",
            });
        }
    }
    return { valid: diagnostics.length === 0, entries, diagnostics };
}
function emptyShadowMatrixBufferResourceReport() {
    return {
        ready: false,
        status: "missing",
        matrixCount: 0,
        byteSize: 0,
        createdBufferCount: 0,
        reusedBufferCount: 0,
        sections: {
            matrixComputation: false,
            bufferDescriptor: false,
            bufferAllocation: false,
            upload: false,
            bindGroupResource: false,
            shaderSampling: false,
        },
        resource: null,
        diagnostics: [],
    };
}
function emptyShadowDepthTextureResourceReport() {
    return {
        ready: false,
        status: "missing",
        textureDescriptorCount: 0,
        createdTextureCount: 0,
        reusedTextureCount: 0,
        sections: {
            textureDescriptors: false,
            depthTextureResource: false,
            gpuAllocation: false,
            matrixUpload: false,
            passSubmission: false,
            shaderSampling: false,
        },
        resources: [],
        diagnostics: [],
    };
}
function emptyShadowSamplerResourceReport() {
    return {
        ready: false,
        status: "missing",
        createdSamplerCount: 0,
        reusedSamplerCount: 0,
        sections: {
            samplerDescriptor: true,
            samplerResource: false,
            bindGroupResource: false,
            shaderSampling: false,
        },
        resource: null,
        diagnostics: [],
    };
}
//# sourceMappingURL=standard-frame-resources.js.map