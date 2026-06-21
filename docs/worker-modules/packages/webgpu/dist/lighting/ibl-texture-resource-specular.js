import { createPmremComputeDispatchSize, createPmremComputePipeline, } from "./pmrem-compute-pipeline.js";
import { bytesPerPixelForPmremFormat, createDefaultSpecularIblUpload, createPaddedCubeFaceUpload, mipLevelCountForSize, missingTextureResult, } from "./ibl-texture-resource-utils.js";
import { createTextureGpuResource, WEBGPU_TEXTURE_USAGE_FLAGS, } from "../resources/textures/texture-resources.js";
function findSpecularPmremSource(sources, resourceKey, slot) {
    return sources?.find((source) => source.resourceKey === resourceKey ||
        (source.sourceResourceKey !== undefined &&
            source.sourceResourceKey === slot.sourceResourceKey) ||
        (source.environmentMapResourceKey !== undefined &&
            source.environmentMapResourceKey === slot.environmentMapResourceKey));
}
function createSpecularIblPmremTextureResource(input) {
    const diagnostics = [];
    const sourceDiagnostic = validateSpecularPmremSource(input.resourceKey, input.source);
    if (sourceDiagnostic !== null) {
        return {
            result: missingTextureResult(),
            diagnostics: [sourceDiagnostic],
        };
    }
    if (!hasSpecularPmremDeviceSupport(input.device)) {
        return {
            result: missingTextureResult(),
            diagnostics: [
                {
                    code: "iblTextureResource.specularPmremDeviceUnsupported",
                    severity: "warning",
                    resourceKey: input.resourceKey,
                    message: "Specular IBL PMREM execution requires texture, sampler, compute pipeline, bind group, command encoder, uniform buffer, and queue support.",
                },
            ],
        };
    }
    const device = input.device;
    const label = input.source.label ?? input.slot.environmentMapResourceKey;
    const faceSize = input.source.faceSize;
    const format = input.source.format ?? "rgba8unorm";
    const mipLevelCount = input.source.mipLevelCount ?? mipLevelCountForSize(faceSize);
    const pipeline = createPmremComputePipeline({
        device,
        storageFormat: format,
        label: `${label}:pmrem`,
    });
    if (!pipeline.valid || pipeline.resource === null) {
        return {
            result: missingTextureResult(),
            diagnostics: [
                ...pipeline.diagnostics.map((diagnostic) => ({
                    code: "iblTextureResource.specularPmremDeviceUnsupported",
                    severity: "warning",
                    resourceKey: input.resourceKey,
                    message: diagnostic.message,
                })),
            ],
        };
    }
    try {
        let sourceView = input.source.sourceTexture?.view;
        const texture = device.createTexture({
            label: `${label}:specular-ibl-pmrem-mip-chain`,
            size: [faceSize, faceSize, 6],
            format,
            usage: WEBGPU_TEXTURE_USAGE_FLAGS.TEXTURE_BINDING |
                WEBGPU_TEXTURE_USAGE_FLAGS.STORAGE_BINDING |
                WEBGPU_TEXTURE_USAGE_FLAGS.RENDER_ATTACHMENT,
            mipLevelCount,
        });
        if (sourceView === undefined) {
            if (input.source.faces === undefined) {
                throw new Error("PMREM source requires cube faces or a projected source texture.");
            }
            const sourceTexture = device.createTexture({
                label: `${label}:specular-ibl-source`,
                size: [faceSize, faceSize, 6],
                format,
                usage: WEBGPU_TEXTURE_USAGE_FLAGS.TEXTURE_BINDING |
                    WEBGPU_TEXTURE_USAGE_FLAGS.COPY_DST,
            });
            input.source.faces.forEach((face, layer) => {
                const upload = createPaddedCubeFaceUpload(face, faceSize, format);
                device.queue.writeTexture({ texture: sourceTexture, origin: [0, 0, layer] }, upload.data, { bytesPerRow: upload.bytesPerRow, rowsPerImage: faceSize }, [faceSize, faceSize, 1]);
            });
            sourceView = sourceTexture.createView?.({
                label: `${label}:pmrem-source-view`,
                dimension: "cube",
            });
        }
        const sampler = device.createSampler({
            label: `${label}:pmrem-source-sampler`,
            addressModeU: "clamp-to-edge",
            addressModeV: "clamp-to-edge",
            addressModeW: "clamp-to-edge",
            magFilter: "nearest",
            minFilter: "nearest",
        });
        if (sourceView === undefined) {
            throw new Error("PMREM source texture cannot create a cube view.");
        }
        const encoder = device.createCommandEncoder({
            label: `${label}:pmrem-dispatch`,
        });
        const pass = encoder.beginComputePass?.({
            label: `${label}:pmrem-mip-chain`,
        });
        if (pass?.setPipeline === undefined ||
            pass.setBindGroup === undefined ||
            pass.dispatchWorkgroups === undefined ||
            pass.end === undefined) {
            throw new Error("PMREM compute pass is missing required methods.");
        }
        pass.setPipeline(pipeline.resource.pipeline);
        for (let mipLevel = 0; mipLevel < mipLevelCount; mipLevel += 1) {
            const mipSize = Math.max(1, faceSize >> mipLevel);
            const params = device.createBuffer({
                label: `${label}:pmrem-mip-${mipLevel}-params`,
                size: 16,
                usage: 0x40 | 0x08,
            });
            device.queue.writeBuffer(params, 0, new Uint32Array([mipSize, mipSize, 6, mipLevel]));
            const outputView = texture.createView?.({
                dimension: "2d-array",
                baseMipLevel: mipLevel,
                mipLevelCount: 1,
            });
            if (outputView === undefined) {
                throw new Error("PMREM output texture cannot create a mip view.");
            }
            const bindGroup = device.createBindGroup({
                label: `${label}:pmrem-mip-${mipLevel}`,
                layout: pipeline.resource.bindGroupLayout,
                entries: [
                    { binding: 0, resource: sampler },
                    { binding: 1, resource: sourceView },
                    { binding: 2, resource: outputView },
                    { binding: 3, resource: { buffer: params } },
                ],
            });
            const dispatch = createPmremComputeDispatchSize({
                width: mipSize,
                height: mipSize,
                layers: 6,
            });
            pass.setBindGroup(0, bindGroup);
            pass.dispatchWorkgroups(dispatch.x, dispatch.y, dispatch.z);
        }
        pass.end();
        if (encoder.finish === undefined) {
            throw new Error("PMREM command encoder cannot finish command buffers.");
        }
        device.queue.submit([encoder.finish()]);
        const view = texture.createView?.({
            label: `${label}:specular-ibl-pmrem-mip-chain-view`,
            dimension: "cube",
        });
        if (view === undefined) {
            throw new Error("PMREM output texture cannot create a cube view.");
        }
        return {
            result: {
                valid: true,
                resource: {
                    resourceKey: input.resourceKey,
                    texture,
                    view,
                    descriptor: {
                        label: `${label}:specular-ibl-pmrem-mip-chain`,
                        size: [faceSize, faceSize, 6],
                        format,
                        usage: WEBGPU_TEXTURE_USAGE_FLAGS.TEXTURE_BINDING |
                            WEBGPU_TEXTURE_USAGE_FLAGS.STORAGE_BINDING |
                            WEBGPU_TEXTURE_USAGE_FLAGS.RENDER_ATTACHMENT,
                        mipLevelCount,
                    },
                    viewDescriptor: { dimension: "cube" },
                    prefiltered: true,
                },
                diagnostics: [],
            },
            diagnostics,
        };
    }
    catch (error) {
        return {
            result: missingTextureResult(),
            diagnostics: [
                {
                    code: "iblTextureResource.specularPmremDispatchFailed",
                    severity: "warning",
                    resourceKey: input.resourceKey,
                    message: error instanceof Error
                        ? error.message
                        : "Specular IBL PMREM dispatch failed.",
                },
            ],
        };
    }
}
function validateSpecularPmremSource(resourceKey, source) {
    const format = source.format ?? "rgba8unorm";
    const bytesPerPixel = bytesPerPixelForPmremFormat(format);
    if (!Number.isInteger(source.faceSize) || source.faceSize <= 0) {
        return invalidSpecularPmremSource(resourceKey, "Specular IBL PMREM source faceSize must be a positive integer.");
    }
    if (bytesPerPixel === null) {
        return invalidSpecularPmremSource(resourceKey, `Specular IBL PMREM source format '${format}' is unsupported.`);
    }
    if (source.sourceTexture !== undefined && source.faces === undefined) {
        return null;
    }
    if (source.faces === undefined) {
        return invalidSpecularPmremSource(resourceKey, "Specular IBL PMREM source must provide cube faces or a sourceTexture.");
    }
    if (source.faces.length !== 6) {
        return invalidSpecularPmremSource(resourceKey, "Specular IBL PMREM source must provide exactly six cube faces.");
    }
    const minimumFaceByteLength = source.faceSize * source.faceSize * bytesPerPixel;
    for (let face = 0; face < source.faces.length; face += 1) {
        const faceData = source.faces[face];
        if (faceData === undefined || faceData.byteLength < minimumFaceByteLength) {
            return invalidSpecularPmremSource(resourceKey, `Specular IBL PMREM source face ${face} must contain at least ${minimumFaceByteLength} bytes.`);
        }
    }
    return null;
}
function invalidSpecularPmremSource(resourceKey, message) {
    return {
        code: "iblTextureResource.invalidSpecularPmremSource",
        severity: "warning",
        resourceKey,
        message,
    };
}
function hasSpecularPmremDeviceSupport(device) {
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
export function createSpecularIblTextureResourceReport(options) {
    const diagnostics = [];
    if (options.textures.status === "not-required") {
        return specularReport({
            status: "not-required",
            textureSlotCount: options.textures.slotCount,
            specularSlotCount: 0,
            resources: [],
            diagnostics,
        });
    }
    if (options.textures.status === "missing") {
        diagnostics.push({
            code: "iblTextureResource.missingTexturePreparation",
            severity: "warning",
            message: "Specular IBL texture resource allocation requires valid IBL texture preparation descriptors.",
        });
        return specularReport({
            status: "missing",
            textureSlotCount: options.textures.slotCount,
            specularSlotCount: 0,
            resources: [],
            diagnostics,
        });
    }
    if (options.textures.status === "unsupported") {
        diagnostics.push({
            code: "iblTextureResource.unsupportedTextureSlots",
            severity: "warning",
            message: "Specular IBL texture resource allocation cannot proceed while IBL texture slots are unsupported.",
        });
        return specularReport({
            status: "unsupported",
            textureSlotCount: options.textures.slotCount,
            specularSlotCount: 0,
            resources: [],
            diagnostics,
        });
    }
    const size = options.size ?? 128;
    const specularSlots = options.textures.slots.filter((slot) => slot.kind === "specular" &&
        slot.sourceResourceKey !== null &&
        slot.textureKey !== null);
    let createdTextureCount = 0;
    let reusedTextureCount = 0;
    let placeholderSlotCount = 0;
    const resources = specularSlots.map((slot) => {
        const resourceKey = slot.textureKey ?? `${slot.sourceResourceKey}:texture`;
        const cached = options.cache?.get(resourceKey);
        const pmremSource = findSpecularPmremSource(options.pmremSources, resourceKey, slot);
        // Reuse a cached resource unless it is a non-prefiltered placeholder and a
        // PMREM source is now available, in which case the prefilter replaces it.
        if (cached !== undefined &&
            (cached.prefiltered === true || pmremSource === undefined)) {
            reusedTextureCount += 1;
            if (cached.prefiltered !== true) {
                placeholderSlotCount += 1;
                diagnostics.push(specularSourceNotPreparedDiagnostic(resourceKey));
            }
            return {
                valid: true,
                resource: cached,
                diagnostics: [],
            };
        }
        const pmremResult = pmremSource === undefined
            ? null
            : createSpecularIblPmremTextureResource({
                device: options.device,
                resourceKey,
                slot,
                source: pmremSource,
            });
        if (pmremResult !== null) {
            diagnostics.push(...pmremResult.diagnostics);
        }
        if (pmremResult?.result.valid === true &&
            pmremResult.result.resource !== null) {
            options.cache?.set(resourceKey, pmremResult.result.resource);
            createdTextureCount += 1;
            return pmremResult.result;
        }
        // The prefilter did not produce a texture (the slot has no source, or the
        // dispatch failed with its own diagnostic): bind the neutral placeholder
        // cube, preferring an already-cached one over a fresh allocation.
        if (cached !== undefined) {
            reusedTextureCount += 1;
            placeholderSlotCount += 1;
            return {
                valid: true,
                resource: cached,
                diagnostics: [],
            };
        }
        const result = createTextureGpuResource({
            device: options.device,
            resourceKey,
            descriptor: {
                label: `${slot.environmentMapResourceKey}:specular-ibl`,
                size: [size, size, 6],
                format: slot.format,
                usage: WEBGPU_TEXTURE_USAGE_FLAGS.TEXTURE_BINDING |
                    WEBGPU_TEXTURE_USAGE_FLAGS.COPY_DST |
                    WEBGPU_TEXTURE_USAGE_FLAGS.RENDER_ATTACHMENT,
                mipLevelCount: mipLevelCountForSize(size),
            },
            ...(options.device.queue?.writeTexture === undefined
                ? {}
                : { upload: createDefaultSpecularIblUpload(size, slot.format) }),
            viewDescriptor: { dimension: "cube" },
        });
        if (result.valid && result.resource !== null) {
            options.cache?.set(resourceKey, result.resource);
            createdTextureCount += 1;
            placeholderSlotCount += 1;
            if (pmremSource === undefined) {
                diagnostics.push(specularSourceNotPreparedDiagnostic(resourceKey));
            }
        }
        return result;
    });
    for (const resource of resources) {
        diagnostics.push(...resource.diagnostics.map((diagnostic) => ({
            ...diagnostic,
            severity: "warning",
        })));
    }
    return specularReport({
        status: resources.every((resource) => resource.valid)
            ? "available"
            : "missing",
        textureSlotCount: options.textures.slotCount,
        specularSlotCount: specularSlots.length,
        createdTextureCount,
        reusedTextureCount,
        proofUpload: placeholderSlotCount > 0 &&
            options.device.queue?.writeTexture !== undefined,
        resources,
        diagnostics,
    });
}
function specularSourceNotPreparedDiagnostic(resourceKey) {
    return {
        code: "iblTextureResource.specularSourceNotPrepared",
        severity: "warning",
        resourceKey,
        message: `Specular IBL slot '${resourceKey}' has no prepared source (cube faces, source texture, or equirect projection); a neutral placeholder cube is bound until a source is provided.`,
    };
}
function specularReport(input) {
    const createdTextureCount = input.createdTextureCount ??
        input.resources.filter((resource) => resource.valid).length;
    const reusedTextureCount = input.reusedTextureCount ?? 0;
    return {
        ready: input.status === "available" || input.status === "not-required",
        status: input.status,
        textureSlotCount: input.textureSlotCount,
        specularSlotCount: input.specularSlotCount,
        createdTextureCount,
        reusedTextureCount,
        sections: {
            texturePreparation: input.status !== "missing" && input.status !== "unsupported",
            specularTextureResource: input.status === "available",
            gpuAllocation: input.status === "available",
            proofUpload: input.proofUpload ?? false,
            prefiltering: input.resources.some((resource) => resource.resource?.prefiltered === true),
            bindGroupResource: false,
            shaderSampling: false,
        },
        resources: input.resources,
        diagnostics: input.diagnostics,
    };
}
//# sourceMappingURL=ibl-texture-resource-specular.js.map