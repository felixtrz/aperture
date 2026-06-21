import { createWebGpuColorTargetDescriptor, createWebGpuDepthStencilDescriptor, resolveWebGpuPipelineRenderState, } from "../core/material-render-state.js";
import { createWebGpuShaderModule, } from "../../gpu/shader.js";
import { createInstanceAttributeVertexBufferLayout } from "../../resources/attributes/instance-attribute-buffer.js";
import { UNLIT_PRIMITIVE_VERTEX_BUFFER_LAYOUT } from "../unlit/unlit-pipeline.js";
const WEBGPU_SHADER_STAGE_VERTEX = 1;
const WEBGPU_SHADER_STAGE_FRAGMENT = 2;
export async function createCustomWgslMaterialRenderPipelineResource(options) {
    const shaderModule = await createWebGpuShaderModule({
        device: options.device,
        descriptor: {
            label: options.material.shader.moduleKey,
            code: options.material.shader.code,
            entryPoints: [
                options.material.shader.vertexEntryPoint,
                options.material.shader.fragmentEntryPoint,
            ],
        },
    });
    const shaderDiagnostics = shaderModule.diagnostics.map(mapShaderDiagnostic);
    if (!shaderModule.ok) {
        return {
            valid: false,
            resource: null,
            diagnostics: [
                ...shaderDiagnostics,
                {
                    code: "customWgslMaterial.shaderCreationFailed",
                    reason: shaderModule.reason,
                    message: shaderModule.message,
                },
            ],
        };
    }
    if (options.device.createRenderPipeline === undefined) {
        return {
            valid: false,
            resource: null,
            diagnostics: [
                ...shaderDiagnostics,
                {
                    code: "customWgslMaterial.createRenderPipelineUnavailable",
                    message: "WebGPU device cannot create custom WGSL render pipelines.",
                },
            ],
        };
    }
    const descriptor = createBrowserCustomWgslMaterialPipelineDescriptor({
        material: options.material,
        shaderModule: shaderModule.module,
        colorFormat: options.colorFormat,
        ...(options.sampleCount === undefined
            ? {}
            : { sampleCount: options.sampleCount }),
        ...(options.depthFormat === undefined
            ? {}
            : { depthFormat: options.depthFormat }),
    });
    try {
        return {
            valid: true,
            resource: {
                cacheKey: customWgslMaterialRenderPipelineCacheKey({
                    material: options.material,
                    colorFormat: options.colorFormat,
                    ...(options.sampleCount === undefined
                        ? {}
                        : { sampleCount: options.sampleCount }),
                    ...(options.depthFormat === undefined
                        ? {}
                        : { depthFormat: options.depthFormat }),
                }),
                shaderModule: shaderModule.module,
                pipeline: options.device.createRenderPipeline(descriptor),
                descriptor,
            },
            diagnostics: shaderDiagnostics,
        };
    }
    catch (cause) {
        return {
            valid: false,
            resource: null,
            diagnostics: [
                ...shaderDiagnostics,
                {
                    code: "customWgslMaterial.pipelineCreationFailed",
                    message: `Failed to create custom WGSL render pipeline '${options.material.pipeline.pipelineKey}': ${messageFromCause(cause)}`,
                },
            ],
        };
    }
}
export function createBrowserCustomWgslMaterialPipelineDescriptor(input) {
    const renderState = resolveWebGpuPipelineRenderState(input.material.pipeline.pipelineKey, input.depthFormat);
    const colorTarget = createWebGpuColorTargetDescriptor(input.colorFormat, renderState);
    const descriptor = {
        label: `${input.material.label}:${input.colorFormat}:triangle-list`,
        layout: "auto",
        vertex: {
            module: input.shaderModule,
            entryPoint: input.material.shader.vertexEntryPoint,
            buffers: input.material.pipeline.instanceAttributes === null
                ? [UNLIT_PRIMITIVE_VERTEX_BUFFER_LAYOUT]
                : [
                    UNLIT_PRIMITIVE_VERTEX_BUFFER_LAYOUT,
                    createInstanceAttributeVertexBufferLayout(input.material.pipeline.instanceAttributes),
                ],
        },
        fragment: {
            module: input.shaderModule,
            entryPoint: input.material.shader.fragmentEntryPoint,
            targets: [colorTarget],
        },
        primitive: {
            topology: "triangle-list",
            frontFace: input.material.pipeline.renderState.frontFace,
            cullMode: renderState.cullMode,
        },
        multisample: {
            count: input.sampleCount ?? 1,
        },
    };
    const depthStencil = createWebGpuDepthStencilDescriptor(input.depthFormat, renderState);
    if (depthStencil === null) {
        return descriptor;
    }
    return { ...descriptor, depthStencil };
}
export function createCustomWgslMaterialBindGroupLayoutDescriptor(material) {
    return {
        label: material.bindGroupLayout.resourceKey,
        entries: material.bindGroupLayout.entries.map((entry) => createBindGroupLayoutEntryDescriptor(entry)),
    };
}
export async function createCustomWgslMaterialRenderResources(options) {
    const pipeline = await createCustomWgslMaterialRenderPipelineResource(options);
    if (!pipeline.valid || pipeline.resource === null) {
        return {
            valid: false,
            resources: null,
            pipeline,
            bindGroup: null,
            diagnostics: pipeline.diagnostics,
        };
    }
    const bindGroup = createCustomWgslMaterialBindGroupResource({
        device: options.device,
        material: options.material,
        pipeline: pipeline.resource
            .pipeline,
        resources: options.resources,
    });
    const valid = bindGroup.valid && bindGroup.resource !== null;
    return {
        valid,
        resources: valid
            ? {
                pipeline: pipeline.resource,
                bindGroup: bindGroup.resource,
            }
            : null,
        pipeline,
        bindGroup,
        diagnostics: [...pipeline.diagnostics, ...bindGroup.diagnostics],
    };
}
export function createCustomWgslMaterialBindGroupResource(options) {
    const diagnostics = [];
    const layout = options.pipeline.getBindGroupLayout?.(2);
    if (layout === undefined) {
        diagnostics.push({
            code: "customWgslMaterial.missingPipelineLayout",
            message: "Custom WGSL material bind group creation requires pipeline bind group layout 2.",
        });
    }
    if (options.device.createBindGroup === undefined) {
        return {
            valid: false,
            resource: null,
            diagnostics: [
                ...diagnostics,
                {
                    code: "customWgslMaterial.createBindGroupUnavailable",
                    message: "WebGPU device cannot create custom WGSL bind groups.",
                },
            ],
        };
    }
    if (layout === undefined) {
        return { valid: false, resource: null, diagnostics };
    }
    const descriptor = createCustomWgslMaterialBindGroupCreationDescriptor(options.material, layout, options.resources, diagnostics);
    if (descriptor === null) {
        return { valid: false, resource: null, diagnostics };
    }
    try {
        return {
            valid: true,
            resource: {
                group: 2,
                resourceKey: options.material.bindGroup.resourceKey,
                layoutKey: options.material.bindGroup.layoutResourceKey,
                bindGroup: options.device.createBindGroup(descriptor),
                entryResourceKeys: customWgslMaterialBindGroupMatchKeys(options.material),
                descriptor,
            },
            diagnostics,
        };
    }
    catch (cause) {
        return {
            valid: false,
            resource: null,
            diagnostics: [
                ...diagnostics,
                {
                    code: "customWgslMaterial.bindGroupCreationFailed",
                    resourceKey: options.material.bindGroup.resourceKey,
                    message: `Failed to create custom WGSL bind group '${options.material.bindGroup.resourceKey}': ${messageFromCause(cause)}`,
                },
            ],
        };
    }
}
function createCustomWgslMaterialBindGroupCreationDescriptor(material, layout, resources, diagnostics) {
    const resourcesByKey = new Map(resources.map((resource) => [resource.resourceKey, resource.resource]));
    const entries = material.bindGroup.entries.flatMap((entry) => {
        const resource = resourcesByKey.get(entry.resourceKey);
        if (resource === undefined) {
            diagnostics.push(missingResourceDiagnostic(entry));
            return [];
        }
        return [{ binding: entry.binding, resource }];
    });
    if (entries.length !== material.bindGroup.entries.length) {
        return null;
    }
    return {
        label: material.bindGroup.resourceKey,
        layout,
        entries,
    };
}
function createBindGroupLayoutEntryDescriptor(entry) {
    const base = {
        binding: entry.binding,
        visibility: shaderVisibility(entry),
    };
    switch (entry.kind) {
        case "uniform-buffer":
            return { ...base, buffer: { type: "uniform" } };
        case "storage-buffer":
            return { ...base, buffer: { type: "read-only-storage" } };
        case "texture":
            return {
                ...base,
                texture: {
                    sampleType: "float",
                    viewDimension: "2d",
                    multisampled: false,
                },
            };
        case "sampler":
            return { ...base, sampler: { type: "filtering" } };
    }
}
function shaderVisibility(entry) {
    let visibility = 0;
    if (entry.visibility.includes("vertex")) {
        visibility |= WEBGPU_SHADER_STAGE_VERTEX;
    }
    if (entry.visibility.includes("fragment")) {
        visibility |= WEBGPU_SHADER_STAGE_FRAGMENT;
    }
    return visibility;
}
function missingResourceDiagnostic(entry) {
    return {
        code: "customWgslMaterial.missingBindingResource",
        binding: entry.binding,
        resourceKey: entry.resourceKey,
        message: `Missing GPU resource '${entry.resourceKey}' for custom WGSL binding ${entry.binding}.`,
    };
}
function customWgslMaterialBindGroupMatchKeys(material) {
    return uniqueStrings([
        material.materialKey,
        material.sourceMaterialKey,
        material.bindGroup.resourceKey,
        ...material.bindGroup.entries.map((entry) => entry.resourceKey),
    ]);
}
function uniqueStrings(values) {
    return [...new Set(values)];
}
function mapShaderDiagnostic(diagnostic) {
    return {
        code: "customWgslMaterial.shaderDiagnostic",
        message: diagnostic.message,
        severity: diagnostic.severity,
    };
}
export function customWgslMaterialRenderPipelineCacheKey(input) {
    return [
        "custom-wgsl",
        input.colorFormat,
        input.depthFormat ?? "none",
        `samples-${input.sampleCount ?? 1}`,
        input.material.pipeline.pipelineKey,
    ].join("|");
}
function messageFromCause(cause) {
    return cause instanceof Error ? cause.message : String(cause);
}
//# sourceMappingURL=custom-wgsl-material.js.map