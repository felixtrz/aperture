import { createMeshGpuUploadPlan, } from "/aperture/worker-modules/packages/render/dist/index.js";
import { packUnlitMaterial, } from "/aperture/worker-modules/packages/render/dist/index.js";
import { createMeshGpuBuffers, } from "../../resources/meshes/mesh-buffer-resources.js";
import { createMeshUploadBufferDescriptors, } from "../../resources/meshes/mesh-buffer-descriptors.js";
import { createUnlitBindGroupDescriptorPlan, createUnlitBindGroupsFromGpuResources, } from "./unlit-bind-group.js";
import { createUnlitMaterialBufferDescriptor, } from "./unlit-material-buffer.js";
import { createUnlitMaterialGpuBuffer, } from "./unlit-material-buffer-resource.js";
import { createViewUniformBufferDescriptor, } from "../../resources/views/view-uniform-buffer.js";
import { createViewUniformGpuBuffer, } from "../../resources/views/view-uniform-buffer-resource.js";
import { createWorldTransformBufferDescriptor, createWorldTransformGpuBuffer, } from "../../resources/transforms/world-transform-buffer.js";
export function createUnlitFrameGpuResources(options) {
    const diagnostics = [];
    const mesh = createMeshResource(options, diagnostics);
    const viewUniform = createViewUniformResource(options, diagnostics);
    const worldTransforms = createWorldTransformResource(options, diagnostics);
    const material = options.preparedMaterial?.material ??
        createMaterialResource(options, diagnostics);
    let bindGroups;
    if (options.preparedMaterial === undefined) {
        const bindGroupPlan = createUnlitBindGroupDescriptorPlan({
            viewUniformResourceKey: viewUniform?.resourceKey ?? null,
            worldTransformResourceKey: worldTransforms?.resourceKey ?? null,
            ...(options.previousWorldTransforms === undefined
                ? {}
                : {
                    previousWorldTransformResourceKey: options.previousWorldTransforms?.resourceKey ?? null,
                }),
            materialResourceKey: material?.resourceKey ?? null,
            baseColorTextureResourceKey: material?.dependencies.baseColorTextureKey ?? null,
            baseColorSamplerResourceKey: material?.dependencies.baseColorSamplerKey ?? null,
        });
        diagnostics.push(...bindGroupPlan.diagnostics);
        bindGroups = createUnlitBindGroupsFromGpuResources({
            device: options.device,
            plan: bindGroupPlan,
            layouts: options.layouts,
            bindGroupCache: options.bindGroupCache,
            buffers: compactBufferResources([
                viewUniform === null
                    ? null
                    : {
                        resourceKey: viewUniform.resourceKey,
                        buffer: viewUniform.buffer,
                    },
                worldTransforms === null
                    ? null
                    : {
                        resourceKey: worldTransforms.resourceKey,
                        buffer: worldTransforms.buffer,
                    },
                options.previousWorldTransforms === undefined ||
                    options.previousWorldTransforms === null
                    ? null
                    : {
                        resourceKey: options.previousWorldTransforms.resourceKey,
                        buffer: options.previousWorldTransforms.buffer,
                    },
                material === null
                    ? null
                    : {
                        resourceKey: material.resourceKey,
                        buffer: material.uniformBuffer,
                    },
            ]),
            textures: options.textures,
            samplers: options.samplers,
        });
    }
    else {
        bindGroups = createUnlitFrameBindGroupsFromPreparedMaterial({
            device: options.device,
            viewUniform,
            worldTransforms,
            ...(options.previousWorldTransforms === undefined
                ? {}
                : { previousWorldTransforms: options.previousWorldTransforms }),
            layouts: options.layouts,
            preparedMaterial: options.preparedMaterial,
            bindGroupCache: options.bindGroupCache,
        });
    }
    diagnostics.push(...bindGroups.diagnostics);
    if (mesh === null ||
        viewUniform === null ||
        worldTransforms === null ||
        material === null ||
        !bindGroups.valid) {
        return { valid: false, resources: null, diagnostics };
    }
    return {
        valid: true,
        resources: {
            mesh,
            viewUniform,
            worldTransforms,
            ...(options.previousWorldTransforms === undefined ||
                options.previousWorldTransforms === null
                ? {}
                : { previousWorldTransforms: options.previousWorldTransforms }),
            material,
            bindGroups: bindGroups.resources,
        },
        diagnostics,
    };
}
function createUnlitFrameBindGroupsFromPreparedMaterial(options) {
    const sharedBindGroupPlan = createSharedBindGroupDescriptorPlan({
        viewUniformResourceKey: options.viewUniform?.resourceKey ?? null,
        worldTransformResourceKey: options.worldTransforms?.resourceKey ?? null,
        ...(options.previousWorldTransforms === undefined
            ? {}
            : {
                previousWorldTransformResourceKey: options.previousWorldTransforms?.resourceKey ?? null,
            }),
    });
    const sharedBindGroups = createUnlitBindGroupsFromGpuResources({
        device: options.device,
        plan: sharedBindGroupPlan,
        layouts: options.layouts,
        bindGroupCache: options.bindGroupCache,
        buffers: compactBufferResources([
            options.viewUniform === null
                ? null
                : {
                    resourceKey: options.viewUniform.resourceKey,
                    buffer: options.viewUniform.buffer,
                },
            options.worldTransforms === null
                ? null
                : {
                    resourceKey: options.worldTransforms.resourceKey,
                    buffer: options.worldTransforms.buffer,
                },
            options.previousWorldTransforms === undefined ||
                options.previousWorldTransforms === null
                ? null
                : {
                    resourceKey: options.previousWorldTransforms.resourceKey,
                    buffer: options.previousWorldTransforms.buffer,
                },
        ]),
        requiredGroups: [0, 1],
    });
    return {
        valid: sharedBindGroupPlan.valid && sharedBindGroups.valid,
        resources: [
            ...sharedBindGroups.resources,
            options.preparedMaterial.bindGroup,
        ],
        diagnostics: [
            ...sharedBindGroupPlan.diagnostics,
            ...sharedBindGroups.diagnostics,
        ],
    };
}
export function createMultiMaterialUnlitFrameGpuResources(options) {
    const diagnostics = [];
    const mesh = createMeshResource(options, diagnostics);
    const viewUniform = createViewUniformResource(options, diagnostics);
    const worldTransforms = createWorldTransformResource(options, diagnostics);
    const materials = createMaterialResources(options, diagnostics);
    const sharedBindGroupPlan = createSharedBindGroupDescriptorPlan({
        viewUniformResourceKey: viewUniform?.resourceKey ?? null,
        worldTransformResourceKey: worldTransforms?.resourceKey ?? null,
        ...(options.previousWorldTransforms === undefined
            ? {}
            : {
                previousWorldTransformResourceKey: options.previousWorldTransforms?.resourceKey ?? null,
            }),
    });
    diagnostics.push(...sharedBindGroupPlan.diagnostics);
    const sharedBindGroups = createUnlitBindGroupsFromGpuResources({
        device: options.device,
        plan: sharedBindGroupPlan,
        layouts: options.layouts,
        bindGroupCache: options.bindGroupCache,
        buffers: compactBufferResources([
            viewUniform === null
                ? null
                : { resourceKey: viewUniform.resourceKey, buffer: viewUniform.buffer },
            worldTransforms === null
                ? null
                : {
                    resourceKey: worldTransforms.resourceKey,
                    buffer: worldTransforms.buffer,
                },
            options.previousWorldTransforms === undefined ||
                options.previousWorldTransforms === null
                ? null
                : {
                    resourceKey: options.previousWorldTransforms.resourceKey,
                    buffer: options.previousWorldTransforms.buffer,
                },
        ]),
        textures: options.textures,
        samplers: options.samplers,
    });
    diagnostics.push(...sharedBindGroups.diagnostics);
    const materialBindGroups = createMaterialBindGroups(options, materials, diagnostics);
    const materialCount = options.materials?.length ?? 0;
    if (mesh === null ||
        viewUniform === null ||
        worldTransforms === null ||
        materialCount === 0 ||
        materials.length !== materialCount ||
        !sharedBindGroups.valid ||
        !materialBindGroups.valid) {
        return { valid: false, resources: null, diagnostics };
    }
    return {
        valid: true,
        resources: {
            mesh,
            viewUniform,
            worldTransforms,
            ...(options.previousWorldTransforms === undefined ||
                options.previousWorldTransforms === null
                ? {}
                : { previousWorldTransforms: options.previousWorldTransforms }),
            materials,
            bindGroups: [
                ...sharedBindGroups.resources,
                ...materialBindGroups.bindGroups,
            ],
        },
        diagnostics,
    };
}
function createMeshResource(options, diagnostics) {
    if (options.preparedMesh !== undefined) {
        return options.preparedMesh;
    }
    if (options.mesh === null) {
        diagnostics.push({
            code: "unlitFrameResources.missingMesh",
            message: "Unlit frame GPU resource creation requires a mesh asset.",
        });
        return null;
    }
    const upload = createMeshGpuUploadPlan(options.mesh);
    diagnostics.push(...upload.diagnostics);
    const descriptors = createMeshUploadBufferDescriptors(upload.plan);
    diagnostics.push(...descriptors.diagnostics);
    const resource = createMeshGpuBuffers({
        device: options.device,
        plan: descriptors.plan,
    });
    diagnostics.push(...resource.diagnostics);
    return resource.valid ? resource.resource : null;
}
function createViewUniformResource(options, diagnostics) {
    if (options.preparedViewUniform !== undefined) {
        return options.preparedViewUniform;
    }
    if (options.viewUniforms === null) {
        diagnostics.push({
            code: "unlitFrameResources.missingViewUniforms",
            message: "Unlit frame GPU resource creation requires packed view uniforms.",
        });
        return null;
    }
    const descriptor = createViewUniformBufferDescriptor(options.viewUniforms);
    diagnostics.push(...descriptor.diagnostics);
    const resource = createViewUniformGpuBuffer({
        device: options.device,
        plan: descriptor.plan,
    });
    diagnostics.push(...resource.diagnostics);
    return resource.valid ? resource.resource : null;
}
function createWorldTransformResource(options, diagnostics) {
    if (options.preparedWorldTransforms !== undefined) {
        return options.preparedWorldTransforms;
    }
    if (options.worldTransforms === null) {
        diagnostics.push({
            code: "unlitFrameResources.missingWorldTransforms",
            message: "Unlit frame GPU resource creation requires packed world transforms.",
        });
        return null;
    }
    const descriptor = createWorldTransformBufferDescriptor(options.worldTransforms);
    diagnostics.push(...descriptor.diagnostics);
    const resource = createWorldTransformGpuBuffer({
        device: options.device,
        plan: descriptor.plan,
    });
    diagnostics.push(...resource.diagnostics);
    return resource.valid ? resource.resource : null;
}
function createMaterialResource(options, diagnostics) {
    if (options.material === null) {
        diagnostics.push({
            code: "unlitFrameResources.missingMaterial",
            message: "Unlit frame GPU resource creation requires a material asset.",
        });
        return null;
    }
    const packed = packUnlitMaterial(options.material);
    diagnostics.push(...packed.diagnostics);
    const descriptor = createUnlitMaterialBufferDescriptor(packed.packed, {
        label: `${options.material.label}/uniform`,
    });
    diagnostics.push(...descriptor.diagnostics);
    const resource = createUnlitMaterialGpuBuffer({
        device: options.device,
        plan: descriptor.plan,
    });
    diagnostics.push(...resource.diagnostics);
    return resource.valid ? resource.resource : null;
}
function createMaterialResources(options, diagnostics) {
    if (options.materials === null || options.materials.length === 0) {
        diagnostics.push({
            code: "unlitFrameResources.missingMaterials",
            message: "Multi-material unlit frame GPU resource creation requires at least one material asset.",
        });
        return [];
    }
    return options.materials.flatMap((material, index) => {
        if (material === null) {
            diagnostics.push({
                code: "unlitFrameResources.missingMaterial",
                message: `Multi-material unlit frame GPU resource creation is missing material asset at index ${index}.`,
            });
            return [];
        }
        const resource = createMaterialResource({ device: options.device, material }, diagnostics);
        return resource === null ? [] : [resource];
    });
}
function createSharedBindGroupDescriptorPlan(input) {
    const diagnostics = [];
    const entries = [];
    if (input.viewUniformResourceKey === null) {
        diagnostics.push({
            code: "unlitBindGroup.missingViewResource",
            message: "Unlit bind group planning requires a view uniform resource.",
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
            message: "Unlit bind group planning requires a world transform buffer resource.",
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
    if (input.previousWorldTransformResourceKey !== undefined) {
        if (input.previousWorldTransformResourceKey === null) {
            diagnostics.push({
                code: "unlitBindGroup.missingTransformResource",
                message: "Motion-vector shared bind group planning requires a previous world transform buffer resource.",
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
    return {
        valid: diagnostics.length === 0,
        entries,
        diagnostics,
    };
}
function createMaterialBindGroups(options, materials, diagnostics) {
    const bindGroups = [];
    let valid = true;
    for (const [index, material] of materials.entries()) {
        const result = createUnlitBindGroupsFromGpuResources({
            device: options.device,
            plan: {
                valid: true,
                entries: [
                    {
                        group: 2,
                        binding: 0,
                        resourceKey: material.resourceKey,
                        resourceKind: "buffer",
                    },
                    ...texturedMaterialBindGroupEntries(material),
                ],
                diagnostics: [],
            },
            layouts: options.materialLayouts?.[index] ?? options.layouts,
            bindGroupCache: options.bindGroupCache,
            buffers: [
                {
                    resourceKey: material.resourceKey,
                    buffer: material.uniformBuffer,
                },
            ],
            textures: options.textures,
            samplers: options.samplers,
        });
        diagnostics.push(...result.diagnostics);
        bindGroups.push(...result.resources);
        valid = valid && result.valid;
    }
    return { valid, bindGroups };
}
function texturedMaterialBindGroupEntries(material) {
    const entries = [];
    if (material.dependencies.baseColorTextureKey !== null) {
        entries.push({
            group: 2,
            binding: 1,
            resourceKey: material.dependencies.baseColorTextureKey,
            resourceKind: "texture-view",
        });
    }
    if (material.dependencies.baseColorSamplerKey !== null) {
        entries.push({
            group: 2,
            binding: 2,
            resourceKey: material.dependencies.baseColorSamplerKey,
            resourceKind: "sampler",
        });
    }
    return entries;
}
function compactBufferResources(resources) {
    return resources.flatMap((resource) => (resource === null ? [] : [resource]));
}
//# sourceMappingURL=unlit-frame-resources.js.map