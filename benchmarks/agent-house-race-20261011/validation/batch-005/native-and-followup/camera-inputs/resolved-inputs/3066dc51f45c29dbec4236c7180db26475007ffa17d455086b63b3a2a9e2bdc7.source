// One-time GPU dispatch that projects an equirectangular (lat-long) source
// texture into a renderer-owned cube TextureGpuResource, modeled on
// brdf-lut-resource.ts / createSpecularIblPmremTextureResource (createTexture
// source + storage output, beginComputePass, dispatch, submit, return a
// TextureGpuResource with a cube view). The derived cube can then feed the
// diffuse irradiance convolution (M5-T2) and the specular PMREM prefilter so a
// single equirect HDR drives the whole IBL chain.
import { createEquirectToCubeComputePipeline, createEquirectToCubeDispatchSize, } from "./equirect-to-cube-compute-pipeline.js";
import { WEBGPU_TEXTURE_USAGE_FLAGS, } from "../resources/textures/texture-resources.js";
const DEFAULT_FACE_SIZE = 128;
const DEFAULT_FORMAT = "rgba8unorm";
const SOURCE_FORMAT = "rgba8unorm";
export function hasEquirectToCubeDeviceSupport(device) {
    const maybeDevice = device;
    return (maybeDevice.createTexture !== undefined &&
        maybeDevice.createSampler !== undefined &&
        maybeDevice.createShaderModule !== undefined &&
        maybeDevice.createBindGroupLayout !== undefined &&
        maybeDevice.createPipelineLayout !== undefined &&
        maybeDevice.createComputePipeline !== undefined &&
        maybeDevice.createBuffer !== undefined &&
        maybeDevice.createBindGroup !== undefined &&
        maybeDevice.createCommandEncoder !== undefined &&
        maybeDevice.queue?.writeTexture !== undefined &&
        maybeDevice.queue.writeBuffer !== undefined &&
        maybeDevice.queue.submit !== undefined);
}
function alignTo(value, alignment) {
    return Math.ceil(value / alignment) * alignment;
}
export function createEquirectToCubeResource(options) {
    const faceSize = options.faceSize ?? DEFAULT_FACE_SIZE;
    const format = options.format ?? DEFAULT_FORMAT;
    const resourceKey = options.resourceKey ?? "ibl:equirect-to-cube";
    const label = options.label ?? resourceKey;
    const { width, height, data } = options.equirect;
    const report = (ready, resource, diagnostics) => ({
        ready,
        faceSize,
        faceCount: 6,
        format,
        projection: "equirect-to-cube",
        resource,
        diagnostics,
    });
    if (!Number.isInteger(width) ||
        !Number.isInteger(height) ||
        width <= 0 ||
        height <= 0 ||
        data.byteLength < width * height * 4) {
        return report(false, null, [
            {
                code: "equirectToCubeResource.invalidSource",
                severity: "warning",
                message: "Equirect source must be a positive width x height with at least width*height*4 rgba8unorm bytes.",
            },
        ]);
    }
    if (!hasEquirectToCubeDeviceSupport(options.device)) {
        return report(false, null, [
            {
                code: "equirectToCubeResource.deviceUnsupported",
                severity: "warning",
                message: "Equirect-to-cube projection requires texture, compute pipeline, bind group, command encoder, uniform buffer, and queue support.",
            },
        ]);
    }
    const device = options.device;
    const pipeline = createEquirectToCubeComputePipeline({
        device,
        storageFormat: format,
        label: `${label}:pipeline`,
    });
    if (!pipeline.valid || pipeline.resource === null) {
        return report(false, null, pipeline.diagnostics.map((diagnostic) => ({
            code: "equirectToCubeResource.pipelineUnavailable",
            severity: "warning",
            message: diagnostic.message,
        })));
    }
    try {
        const sourceTexture = device.createTexture({
            label: `${label}:equirect-source`,
            size: [width, height, 1],
            format: SOURCE_FORMAT,
            usage: WEBGPU_TEXTURE_USAGE_FLAGS.TEXTURE_BINDING |
                WEBGPU_TEXTURE_USAGE_FLAGS.COPY_DST,
        });
        const sourceBytesPerRow = width * 4;
        const bytesPerRow = alignTo(sourceBytesPerRow, 256);
        const padded = new Uint8Array(bytesPerRow * height);
        for (let y = 0; y < height; y += 1) {
            padded.set(data.subarray(y * sourceBytesPerRow, (y + 1) * sourceBytesPerRow), y * bytesPerRow);
        }
        device.queue.writeTexture({ texture: sourceTexture, origin: [0, 0, 0] }, padded, { bytesPerRow, rowsPerImage: height }, [width, height, 1]);
        const cube = device.createTexture({
            label: `${label}:cube`,
            size: [faceSize, faceSize, 6],
            format,
            usage: WEBGPU_TEXTURE_USAGE_FLAGS.TEXTURE_BINDING |
                WEBGPU_TEXTURE_USAGE_FLAGS.STORAGE_BINDING |
                WEBGPU_TEXTURE_USAGE_FLAGS.COPY_SRC,
            mipLevelCount: 1,
        });
        const sampler = device.createSampler({
            label: `${label}:equirect-sampler`,
            addressModeU: "repeat",
            addressModeV: "clamp-to-edge",
            addressModeW: "clamp-to-edge",
            magFilter: "linear",
            minFilter: "linear",
        });
        const sourceView = sourceTexture.createView?.({
            label: `${label}:equirect-source-view`,
            dimension: "2d",
        });
        if (sourceView === undefined) {
            throw new Error("Equirect source texture cannot create a 2d view.");
        }
        const params = device.createBuffer({
            label: `${label}:params`,
            size: 16,
            usage: 0x40 | 0x08,
        });
        device.queue.writeBuffer(params, 0, new Uint32Array([faceSize, faceSize, 6, 0]));
        const outputView = cube.createView?.({
            label: `${label}:cube-output-view`,
            dimension: "2d-array",
        });
        if (outputView === undefined) {
            throw new Error("Equirect cube texture cannot create a 2d-array view.");
        }
        const bindGroup = device.createBindGroup({
            label: `${label}:bind-group`,
            layout: pipeline.resource.bindGroupLayout,
            entries: [
                { binding: 0, resource: sampler },
                { binding: 1, resource: sourceView },
                { binding: 2, resource: outputView },
                { binding: 3, resource: { buffer: params } },
            ],
        });
        const encoder = device.createCommandEncoder({ label: `${label}:dispatch` });
        const pass = encoder.beginComputePass?.({ label: `${label}:project` });
        if (pass?.setPipeline === undefined ||
            pass.setBindGroup === undefined ||
            pass.dispatchWorkgroups === undefined ||
            pass.end === undefined) {
            throw new Error("Equirect-to-cube compute pass is missing methods.");
        }
        const dispatch = createEquirectToCubeDispatchSize({ faceSize });
        pass.setPipeline(pipeline.resource.pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(dispatch.x, dispatch.y, dispatch.z);
        pass.end();
        if (encoder.finish === undefined) {
            throw new Error("Equirect command encoder cannot finish command buffers.");
        }
        device.queue.submit([encoder.finish()]);
        const view = cube.createView?.({
            label: `${label}:cube-view`,
            dimension: "cube",
        });
        if (view === undefined) {
            throw new Error("Equirect cube texture cannot create a cube view.");
        }
        const resource = {
            resourceKey,
            texture: cube,
            view,
            descriptor: {
                label: `${label}:cube`,
                size: [faceSize, faceSize, 6],
                format,
                usage: WEBGPU_TEXTURE_USAGE_FLAGS.TEXTURE_BINDING |
                    WEBGPU_TEXTURE_USAGE_FLAGS.STORAGE_BINDING,
                mipLevelCount: 1,
            },
            viewDescriptor: { dimension: "cube" },
            prefiltered: false,
        };
        return report(true, resource, []);
    }
    catch (error) {
        return report(false, null, [
            {
                code: "equirectToCubeResource.dispatchFailed",
                severity: "warning",
                message: error instanceof Error
                    ? error.message
                    : "Equirect-to-cube projection dispatch failed.",
            },
        ]);
    }
}
//# sourceMappingURL=equirect-to-cube-resource.js.map