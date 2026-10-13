// One-time GPU dispatch that integrates the split-sum environment-BRDF (DFG)
// LUT into a renderer-owned rg16float 2D texture, modeled on
// createSpecularIblPmremTextureResource in ibl-texture-resource-specular.ts
// (createTexture STORAGE_BINDING|TEXTURE_BINDING, beginComputePass, dispatch,
// submit, return a TextureGpuResource with a 2d view).
import { BRDF_LUT_DEFAULT_SAMPLE_COUNT, createBrdfLutComputeDispatchSize, createBrdfLutComputePipeline, } from "./brdf-lut-compute-pipeline.js";
import { WEBGPU_TEXTURE_USAGE_FLAGS, } from "../resources/textures/texture-resources.js";
const DEFAULT_BRDF_LUT_SIZE = 256;
const DEFAULT_BRDF_LUT_FORMAT = "rg16float";
export function hasBrdfLutDeviceSupport(device) {
    const maybeDevice = device;
    return (maybeDevice.createTexture !== undefined &&
        maybeDevice.createShaderModule !== undefined &&
        maybeDevice.createBindGroupLayout !== undefined &&
        maybeDevice.createPipelineLayout !== undefined &&
        maybeDevice.createComputePipeline !== undefined &&
        maybeDevice.createBuffer !== undefined &&
        maybeDevice.createBindGroup !== undefined &&
        maybeDevice.createCommandEncoder !== undefined &&
        maybeDevice.queue?.writeBuffer !== undefined &&
        maybeDevice.queue.submit !== undefined);
}
export function createBrdfIntegrationLutResource(options) {
    const size = options.size ?? DEFAULT_BRDF_LUT_SIZE;
    const sampleCount = options.sampleCount ?? BRDF_LUT_DEFAULT_SAMPLE_COUNT;
    const format = DEFAULT_BRDF_LUT_FORMAT;
    const resourceKey = options.resourceKey ?? "ibl:brdf-integration-lut";
    const label = options.label ?? resourceKey;
    if (!hasBrdfLutDeviceSupport(options.device)) {
        return {
            ready: false,
            size,
            format,
            resource: null,
            diagnostics: [
                {
                    code: "brdfLutResource.deviceUnsupported",
                    severity: "warning",
                    message: "BRDF integration LUT requires texture, compute pipeline, bind group, command encoder, uniform buffer, and queue support.",
                },
            ],
        };
    }
    const device = options.device;
    const pipeline = createBrdfLutComputePipeline({
        device,
        storageFormat: format,
        label: `${label}:pipeline`,
    });
    if (!pipeline.valid || pipeline.resource === null) {
        return {
            ready: false,
            size,
            format,
            resource: null,
            diagnostics: pipeline.diagnostics.map((diagnostic) => ({
                code: "brdfLutResource.pipelineUnavailable",
                severity: "warning",
                message: diagnostic.message,
            })),
        };
    }
    try {
        const texture = device.createTexture({
            label: `${label}:texture`,
            size: [size, size, 1],
            format,
            usage: WEBGPU_TEXTURE_USAGE_FLAGS.TEXTURE_BINDING |
                WEBGPU_TEXTURE_USAGE_FLAGS.STORAGE_BINDING,
        });
        const params = device.createBuffer({
            label: `${label}:params`,
            size: 8,
            usage: 0x40 | 0x08,
        });
        device.queue.writeBuffer(params, 0, new Uint32Array([size, sampleCount]));
        const storageView = texture.createView?.({
            label: `${label}:storage-view`,
            dimension: "2d",
        });
        if (storageView === undefined) {
            throw new Error("BRDF LUT texture cannot create a 2d storage view.");
        }
        const bindGroup = device.createBindGroup({
            label: `${label}:bind-group`,
            layout: pipeline.resource.bindGroupLayout,
            entries: [
                { binding: 0, resource: storageView },
                { binding: 1, resource: { buffer: params } },
            ],
        });
        const encoder = device.createCommandEncoder({ label: `${label}:dispatch` });
        const pass = encoder.beginComputePass?.({ label: `${label}:integrate` });
        if (pass?.setPipeline === undefined ||
            pass.setBindGroup === undefined ||
            pass.dispatchWorkgroups === undefined ||
            pass.end === undefined) {
            throw new Error("BRDF LUT compute pass is missing required methods.");
        }
        const dispatch = createBrdfLutComputeDispatchSize({ size });
        pass.setPipeline(pipeline.resource.pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(dispatch.x, dispatch.y, dispatch.z);
        pass.end();
        if (encoder.finish === undefined) {
            throw new Error("BRDF LUT command encoder cannot finish command buffers.");
        }
        device.queue.submit([encoder.finish()]);
        const view = texture.createView?.({
            label: `${label}:view`,
            dimension: "2d",
        });
        if (view === undefined) {
            throw new Error("BRDF LUT texture cannot create a 2d sampling view.");
        }
        const resource = {
            resourceKey,
            texture,
            view,
            descriptor: {
                label: `${label}:texture`,
                size: [size, size, 1],
                format,
                usage: WEBGPU_TEXTURE_USAGE_FLAGS.TEXTURE_BINDING |
                    WEBGPU_TEXTURE_USAGE_FLAGS.STORAGE_BINDING,
            },
            viewDescriptor: { dimension: "2d" },
            prefiltered: true,
        };
        return {
            ready: true,
            size,
            format,
            resource,
            diagnostics: [],
        };
    }
    catch (error) {
        return {
            ready: false,
            size,
            format,
            resource: null,
            diagnostics: [
                {
                    code: "brdfLutResource.dispatchFailed",
                    severity: "warning",
                    message: error instanceof Error
                        ? error.message
                        : "BRDF integration LUT dispatch failed.",
                },
            ],
        };
    }
}
//# sourceMappingURL=brdf-lut-resource.js.map