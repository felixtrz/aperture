import { createMeshGpuUploadPlan, } from "/aperture/worker-modules/packages/render/dist/index.js";
import { createMatcapMaterialBindGroupDescriptorPlan, createMatcapMaterialBindGroupResource, } from "./matcap-bind-group.js";
import { createMatcapMaterialGpuBuffer, } from "./matcap-material-buffer-resource.js";
import { createMatcapMaterialGpuPreparationPlan, } from "./matcap-material-buffer.js";
import { createMeshGpuBuffers, } from "../../resources/meshes/mesh-buffer-resources.js";
import { createMeshUploadBufferDescriptors, } from "../../resources/meshes/mesh-buffer-descriptors.js";
import { createUnlitBindGroupsFromGpuResources, } from "../unlit/unlit-bind-group.js";
import { createViewUniformBufferDescriptor, } from "../../resources/views/view-uniform-buffer.js";
import { createViewUniformGpuBuffer, } from "../../resources/views/view-uniform-buffer-resource.js";
import { createWorldTransformBufferDescriptor, createWorldTransformGpuBuffer, } from "../../resources/transforms/world-transform-buffer.js";
export function createMatcapFrameGpuResources(options) {
    const diagnostics = [];
    const mesh = createMeshResource(options, diagnostics);
    const viewUniform = createViewUniformResource(options, diagnostics);
    const worldTransforms = createWorldTransformResource(options, diagnostics);
    const material = options.preparedMaterial?.material ??
        createMaterialResource(options, diagnostics);
    const sharedBindGroups = createSharedBindGroups(options, viewUniform, worldTransforms, diagnostics);
    const materialBindGroup = options.preparedMaterial?.bindGroup ??
        createMaterialBindGroup(options, material, diagnostics);
    if (mesh === null ||
        viewUniform === null ||
        worldTransforms === null ||
        material === null ||
        !sharedBindGroups.valid ||
        materialBindGroup === null) {
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
            material,
            materialBindGroup,
            bindGroups: [...sharedBindGroups.resources, materialBindGroup],
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
            code: "matcapFrameResources.missingMesh",
            message: "Matcap frame GPU resource creation requires a mesh asset.",
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
            code: "matcapFrameResources.missingViewUniforms",
            message: "Matcap frame GPU resource creation requires packed view uniforms.",
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
            code: "matcapFrameResources.missingWorldTransforms",
            message: "Matcap frame GPU resource creation requires packed world transforms.",
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
            code: "matcapFrameResources.missingMaterial",
            message: "Matcap frame GPU resource creation requires a matcap material asset.",
        });
        return null;
    }
    const preparation = createMatcapMaterialGpuPreparationPlan(options.material, {
        label: `${options.material.label}/uniform`,
    });
    diagnostics.push(...preparation.diagnostics);
    const resource = createMatcapMaterialGpuBuffer({
        device: options.device,
        plan: preparation.plan?.materialBuffer ?? null,
    });
    diagnostics.push(...resource.diagnostics);
    return resource.valid ? resource.resource : null;
}
function createSharedBindGroups(options, viewUniform, worldTransforms, diagnostics) {
    const plan = createSharedBindGroupDescriptorPlan({
        viewUniformResourceKey: viewUniform?.resourceKey ?? null,
        worldTransformResourceKey: worldTransforms?.resourceKey ?? null,
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
        bindGroupCache: options.bindGroupCache,
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
        : createMatcapMaterialBindGroupDescriptorPlan({
            materialResourceKey: material.resourceKey,
            dependencies: material.dependencies,
        });
    if (plan !== null) {
        diagnostics.push(...plan.diagnostics);
    }
    const result = createMatcapMaterialBindGroupResource({
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
        textures: options.textures,
        samplers: options.samplers,
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
            message: "Matcap shared bind group planning requires a view uniform.",
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
            message: "Matcap shared bind group planning requires a world transform buffer.",
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
                message: "Matcap motion-vector shared bind group planning requires a previous world transform buffer.",
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
//# sourceMappingURL=matcap-frame-resources.js.map